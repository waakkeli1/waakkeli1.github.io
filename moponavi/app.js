/* MopoNavi — mopon reititin (tiet ≤60 km/h + "Sallittu mopoille" -väylät)
   Data: OpenStreetMap Overpass API. Reititys lasketaan selaimessa (A*). */
'use strict';

/* ================= vakiot ================= */
const MAX_TRIP_KM = 35;          // linnuntie-yläraja yhdelle haulle
const MOPED_MAX = 45;            // mopon rakenteellinen nopeus
const PATH_SPEED = 30;           // arvionopeus mopoväylillä (km/h)
const OFFROUTE_M = 45;           // etäisyys, jonka jälkeen lasketaan reitti uudestaan
const OVERPASS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter'
];
// oletusnopeudet jos maxspeed puuttuu (ennen 45 km/h -katkaisua)
const DEF_SPEED = {
  trunk: 60, primary: 50, secondary: 50, tertiary: 45, unclassified: 40,
  residential: 30, living_street: 20, service: 20,
  trunk_link: 40, primary_link: 40, secondary_link: 40, tertiary_link: 40
};
const PATH_TYPES = new Set(['cycleway', 'path', 'footway', 'pedestrian', 'track']);

/* ================= tila ================= */
const state = {
  from: null, to: null,             // {lat,lon,label}
  graph: null,                      // {adj:Map, nodes:Map(id->[lat,lon]), grid:Map, bbox}
  route: null,                      // {coords, legs, steps, distM, timeS, pathShare}
  nav: null,                        // {watchId, lastFix, offCount, spokenIdx}
  voice: false,
  layers: { route: [], markers: [], me: null }
};

/* ================= apurit ================= */
const $ = id => document.getElementById(id);
const R = 6371000;
function havM(a, b) { // metriä [lat,lon]-pisteiden välillä
  const dLat = (b[0] - a[0]) * Math.PI / 180, dLon = (b[1] - a[1]) * Math.PI / 180;
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(a[0] * Math.PI / 180) * Math.cos(b[0] * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
function bearing(a, b) {
  const φ1 = a[0] * Math.PI / 180, φ2 = b[0] * Math.PI / 180, dλ = (b[1] - a[1]) * Math.PI / 180;
  const y = Math.sin(dλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(dλ);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}
function fmtDist(m) { return m < 950 ? Math.round(m / 10) * 10 + ' m' : (m / 1000).toFixed(1).replace('.', ',') + ' km'; }
function fmtTime(s) {
  const min = Math.round(s / 60);
  if (min < 60) return min + ' min';
  return Math.floor(min / 60) + ' h ' + (min % 60) + ' min';
}
let toastT = null;
function toast(msg, err) {
  const t = $('toast');
  t.textContent = msg; t.className = 'toast' + (err ? ' err' : ''); t.style.display = 'block';
  clearTimeout(toastT); toastT = setTimeout(() => t.style.display = 'none', err ? 6000 : 3500);
}
function loading(on, txt) {
  $('loading').classList.toggle('on', !!on);
  if (txt) $('loadingText').textContent = txt;
}

/* ================= kartta ================= */
const map = L.map('map', { zoomControl: false }).setView([60.47, 26.94], 12); // Kotka oletus
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMapin tekijät</a>'
}).addTo(map);
map.attributionControl.setPrefix(false);

const meIcon = L.divIcon({
  className: '', iconSize: [22, 22], iconAnchor: [11, 11],
  html: '<div style="width:22px;height:22px;border-radius:50%;background:#4ea8de;border:3px solid #fff;box-shadow:0 0 0 4px rgba(78,168,222,.35)"></div>'
});
function pinIcon(color) {
  return L.divIcon({
    className: '', iconSize: [18, 18], iconAnchor: [9, 9],
    html: `<div style="width:18px;height:18px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.5)"></div>`
  });
}
function clearRouteLayers() {
  state.layers.route.forEach(l => map.removeLayer(l));
  state.layers.markers.forEach(l => map.removeLayer(l));
  state.layers.route = []; state.layers.markers = [];
}

/* ================= geokoodaus (Photon + varalla Nominatim) ================= */
function fetchT(url, ms) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms || 7000);
  return fetch(url, { signal: c.signal }).finally(() => clearTimeout(t));
}
async function geocodePhoton(q) {
  const c = map.getCenter();
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6&lang=fi&lat=${c.lat}&lon=${c.lng}`;
  const r = await fetchT(url);
  if (!r.ok) throw new Error('Photon ' + r.status);
  const j = await r.json();
  return (j.features || [])
    .filter(f => (f.properties.countrycode || 'FI').toUpperCase() === 'FI')
    .map(f => {
      const p = f.properties;
      const parts = [p.name || p.street, p.housenumber].filter(Boolean);
      return {
        lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0],
        label: parts.join(' ') || q,
        detail: [p.postcode, p.city || p.county, p.state].filter(Boolean).join(', ')
      };
    });
}
async function geocodeNominatim(q) {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&countrycodes=fi&accept-language=fi&q=${encodeURIComponent(q)}`;
  const r = await fetchT(url, 9000);
  if (!r.ok) throw new Error('Nominatim ' + r.status);
  const j = await r.json();
  return j.map(f => {
    const parts = String(f.display_name || '').split(',').map(s => s.trim());
    return { lat: +f.lat, lon: +f.lon, label: f.name || parts[0] || q, detail: parts.slice(1, 4).join(', ') };
  });
}
// fallback=false: vain Photon (ehdotukset kirjoittaessa — Nominatimia ei saa käyttää
// jatkuvaan hakuun sen käyttöehtojen takia). fallback=true: varmistetaan Nominatimilla.
async function geocode(q, opts) {
  const fallback = !opts || opts.fallback !== false;
  try {
    const res = await geocodePhoton(q);
    if (res.length || !fallback) return res;
  } catch (e1) {
    if (!fallback) throw e1;
  }
  try {
    return await geocodeNominatim(q);
  } catch (e2) {
    throw new Error('Paikkahaku ei nyt vastaa (kokeiltiin kahta palvelua). Tarkista nettiyhteys tai yritä hetken päästä uudestaan.');
  }
}

function wireSearchField(inputId, sugId, key) {
  const input = $(inputId), sug = $(sugId);
  let t = null;
  input.addEventListener('input', () => {
    state[key] = null;
    clearTimeout(t);
    const q = input.value.trim();
    if (q.length < 3 || q === 'Oma sijainti') { sug.style.display = 'none'; return; }
    t = setTimeout(async () => {
      try {
        const res = await geocode(q, { fallback: false });
        sug.innerHTML = '';
        res.forEach(hit => {
          const b = document.createElement('button');
          b.innerHTML = `${hit.label}<small>${hit.detail}</small>`;
          b.onclick = () => {
            state[key] = hit;
            input.value = hit.label;
            sug.style.display = 'none';
          };
          sug.appendChild(b);
        });
        sug.style.display = res.length ? 'block' : 'none';
      } catch (e) { sug.style.display = 'none'; }
    }, 350);
  });
  input.addEventListener('blur', () => setTimeout(() => sug.style.display = 'none', 250));
}
wireSearchField('fromInput', 'fromSug', 'from');
wireSearchField('toInput', 'toSug', 'to');

$('useLoc').onclick = async () => {
  $('fromInput').value = 'Oma sijainti'; state.from = null;
  try {
    loading(true, 'Haetaan sijaintiasi…');
    const pos = await getPosition();
    state.from = pos;
    map.setView([pos.lat, pos.lon], 15);
    loading(false);
    toast('Sijainti löytyi ✓');
  } catch (e) {
    loading(false);
    toast(e.message, true);
  }
};

function geoErrText(e) {
  if (e && e.code === 1) return 'Sijaintilupa on estetty tälle sivulle. Safarissa: osoitepalkin "aA"- tai sivuvalikko → Verkkosivuston asetukset → Sijainti → Salli. Tarkista myös: Asetukset → Tietosuoja ja turvallisuus → Sijaintipalvelut → Safarin verkkosivustot → Käytettäessä.';
  if (e && e.code === 2) return 'Sijaintia ei pystytty määrittämään (ei GPS/verkkopaikannusta). Kokeile ikkunan äärellä tai ulkona.';
  if (e && e.code === 3) return 'Sijainnin haku kesti liian kauan. Yritä uudestaan — ensimmäinen GPS-lukko voi kestää hetken.';
  return 'Sijaintia ei saatu: ' + ((e && e.message) || 'tuntematon virhe');
}
function getPosition() {
  return new Promise((res, rej) => {
    if (!navigator.geolocation) return rej(new Error('Tämä selain ei tue sijaintia'));
    if (!window.isSecureContext) return rej(new Error('Sijainti vaatii https-osoitteen — avaa sivu GitHub Pages -osoitteesta'));
    navigator.geolocation.getCurrentPosition(
      p => res({ lat: p.coords.latitude, lon: p.coords.longitude, label: 'Oma sijainti' }),
      e => rej(new Error(geoErrText(e))),
      { enableHighAccuracy: true, timeout: 25000, maximumAge: 30000 }
    );
  });
}

/* ================= Overpass-haku ================= */
function tripBbox(a, b) {
  const distKm = havM([a.lat, a.lon], [b.lat, b.lon]) / 1000;
  const marginKm = Math.min(6, Math.max(1.2, distKm * 0.35));
  const dLat = marginKm / 111;
  const midLat = (a.lat + b.lat) / 2;
  const dLon = marginKm / (111 * Math.cos(midLat * Math.PI / 180));
  return {
    s: Math.min(a.lat, b.lat) - dLat, n: Math.max(a.lat, b.lat) + dLat,
    w: Math.min(a.lon, b.lon) - dLon, e: Math.max(a.lon, b.lon) + dLon
  };
}
function bboxContains(outer, inner) {
  return outer && outer.s <= inner.s && outer.n >= inner.n && outer.w <= inner.w && outer.e >= inner.e;
}
async function fetchOSM(bbox) {
  const bb = `${bbox.s},${bbox.w},${bbox.n},${bbox.e}`;
  const q = `[out:json][timeout:90];
(
  way["highway"~"^(trunk|primary|secondary|tertiary|unclassified|residential|living_street|service|trunk_link|primary_link|secondary_link|tertiary_link)$"](${bb});
  way["highway"~"^(cycleway|path|footway|pedestrian|track)$"]["moped"~"^(yes|designated)$"](${bb});
);
out geom;`;
  let lastErr = null;
  for (const ep of OVERPASS) {
    try {
      const r = await fetch(ep, { method: 'POST', body: 'data=' + encodeURIComponent(q),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
      if (!r.ok) throw new Error('Overpass ' + r.status);
      return await r.json();
    } catch (e) { lastErr = e; }
  }
  throw new Error('Karttadatan haku epäonnistui (' + (lastErr && lastErr.message) + '). Yritä hetken päästä uudestaan.');
}

/* ================= graafin rakennus ================= */
function parseMaxspeed(v) {
  if (!v) return null;
  if (/^FI:urban/i.test(v)) return 50;
  if (/^FI:rural/i.test(v)) return 80;
  if (/walk/i.test(v)) return 10;
  const n = parseInt(v, 10);
  return isNaN(n) ? null : n; // km/h (mph-teitä ei Suomessa)
}
function edgeAllowedAndSpeed(tags) {
  const hw = tags.highway;
  if (PATH_TYPES.has(hw)) {
    // mopoväylä: vaadittu moped=yes/designated jo kyselyssä
    if (tags.access === 'no' || tags.access === 'private') return null;
    return { speed: PATH_SPEED, kind: 'moped' };
  }
  // ajotie
  if (!(hw in DEF_SPEED)) return null;                             // mm. motorway: ei mopolla
  if (tags.motorroad === 'yes') return null;                       // moottoriliikennetie
  if (tags.moped === 'no' || tags.mofa === 'no') return null;
  if (tags.access === 'no' || tags.access === 'private') {
    if (tags.motor_vehicle !== 'yes' && tags.moped !== 'yes') return null;
  }
  if (tags.motor_vehicle === 'no' && tags.moped !== 'yes') return null;
  const ms = parseMaxspeed(tags.maxspeed);
  if (ms !== null && ms > 60) return null;                         // käyttäjän sääntö: vain ≤60 km/h tiet
  if (ms === null && (tags.highway === 'trunk' || tags.highway === 'trunk_link')) return null; // varmuuden vuoksi
  let v = ms !== null ? ms : (DEF_SPEED[hw] || 40);
  v = Math.min(v, MOPED_MAX);
  // hidastetaan parkkipaikkojen läpiajoa, ettei reitti oikaise pihojen kautta
  if (hw === 'service' && ['parking_aisle', 'driveway', 'drive-through'].includes(tags.service)) v = Math.min(v, 12);
  return { speed: Math.max(v, 5), kind: 'road' };
}
function onewayDir(tags) {
  const ow = tags.oneway;
  if (ow === 'yes' || ow === '1' || ow === 'true') return 1;
  if (ow === '-1' || ow === 'reverse') return -1;
  if (tags.junction === 'roundabout' || tags.junction === 'circular') return 1;
  return 0;
}

function buildGraph(osm, bbox) {
  const nodes = new Map();   // id -> [lat,lon]
  const adj = new Map();     // id -> [{to, dist, time, kind, name, hw}]
  const addEdge = (a, b, dist, spd, kind, name, hw) => {
    if (!adj.has(a)) adj.set(a, []);
    adj.get(a).push({ to: b, dist, time: dist / (spd / 3.6), kind, name, hw });
  };
  for (const el of osm.elements) {
    if (el.type !== 'way' || !el.geometry || !el.nodes) continue;
    const ok = edgeAllowedAndSpeed(el.tags || {});
    if (!ok) continue;
    const dir = ok.kind === 'road' ? onewayDir(el.tags) : 0; // mopoväylät kaksisuuntaisia
    const name = el.tags.name || (ok.kind === 'moped' ? 'mopoväylä' : nimiTyypille(el.tags.highway));
    for (let i = 0; i < el.nodes.length - 1; i++) {
      const idA = el.nodes[i], idB = el.nodes[i + 1];
      const gA = el.geometry[i], gB = el.geometry[i + 1];
      if (!gA || !gB) continue;
      const A = [gA.lat, gA.lon], B = [gB.lat, gB.lon];
      nodes.set(idA, A); nodes.set(idB, B);
      const d = havM(A, B);
      if (d <= 0) continue;
      if (dir >= 0) addEdge(idA, idB, d, ok.speed, ok.kind, name, el.tags.highway);
      if (dir <= 0) addEdge(idB, idA, d, ok.speed, ok.kind, name, el.tags.highway);
    }
  }
  // ruudukko lähimmän solmun hakuun
  const grid = new Map();
  const cell = 0.004; // ~400 m
  for (const [id, ll] of nodes) {
    if (!adj.has(id)) continue; // vain solmut joista pääsee eteenpäin
    const k = Math.floor(ll[0] / cell) + '_' + Math.floor(ll[1] / cell);
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(id);
  }
  return { nodes, adj, grid, cell, bbox };
}
function nimiTyypille(hw) {
  return ({ service: 'huoltotie', residential: 'asuinkatu', living_street: 'pihakatu' })[hw] || 'tie';
}
function nearestNode(g, lat, lon) {
  const ci = Math.floor(lat / g.cell), cj = Math.floor(lon / g.cell);
  let best = null, bestD = Infinity, foundAt = -1;
  for (let r = 0; r <= 8; r++) {
    for (let i = ci - r; i <= ci + r; i++) for (let j = cj - r; j <= cj + r; j++) {
      if (Math.max(Math.abs(i - ci), Math.abs(j - cj)) !== r) continue; // vain renkaan reuna
      const arr = g.grid.get(i + '_' + j);
      if (!arr) continue;
      for (const id of arr) {
        const d = havM([lat, lon], g.nodes.get(id));
        if (d < bestD) { bestD = d; best = id; }
      }
    }
    if (best !== null && foundAt === -1) foundAt = r;
    if (foundAt !== -1 && r >= foundAt + 1) break; // yksi lisärengas varmuudeksi
  }
  return best !== null && bestD < 1500 ? best : null;
}

/* ================= A* ================= */
class Heap {
  constructor() { this.a = []; }
  push(item) { const a = this.a; a.push(item); let i = a.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (a[p].f <= a[i].f) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }
  pop() { const a = this.a, top = a[0], last = a.pop();
    if (a.length) { a[0] = last; let i = 0;
      for (;;) { const l = 2 * i + 1, r = l + 1; let m = i;
        if (l < a.length && a[l].f < a[m].f) m = l;
        if (r < a.length && a[r].f < a[m].f) m = r;
        if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } }
    return top; }
  get size() { return this.a.length; }
}
function astar(g, startId, goalId) {
  const goal = g.nodes.get(goalId);
  const h = id => havM(g.nodes.get(id), goal) / (MOPED_MAX / 3.6); // sekunteja, sallittu heuristiikka
  const gScore = new Map([[startId, 0]]);
  const came = new Map();
  const open = new Heap();
  open.push({ id: startId, f: h(startId) });
  const closed = new Set();
  while (open.size) {
    const cur = open.pop();
    if (closed.has(cur.id)) continue;
    if (cur.id === goalId) break;
    closed.add(cur.id);
    const edges = g.adj.get(cur.id);
    if (!edges) continue;
    const gc = gScore.get(cur.id);
    for (const e of edges) {
      if (closed.has(e.to)) continue;
      const ng = gc + e.time;
      if (ng < (gScore.get(e.to) ?? Infinity)) {
        gScore.set(e.to, ng);
        came.set(e.to, { from: cur.id, edge: e });
        open.push({ id: e.to, f: ng + h(e.to) });
      }
    }
  }
  if (!came.has(goalId)) return null;
  const legs = [];
  let cur = goalId;
  while (cur !== startId) {
    const c = came.get(cur);
    legs.push({ from: c.from, to: cur, ...c.edge });
    cur = c.from;
  }
  legs.reverse();
  return legs;
}

/* ================= ohjeet ================= */
function buildRoute(g, legs, fromLL, toLL) {
  const coords = [g.nodes.get(legs[0].from)];
  let distM = 0, timeS = 0, pathM = 0;
  for (const l of legs) {
    coords.push(g.nodes.get(l.to));
    distM += l.dist; timeS += l.time;
    if (l.kind === 'moped') pathM += l.dist;
  }
  // ryhmitellään osuudet nimen+tyypin mukaan
  const groups = [];
  for (const l of legs) {
    const last = groups[groups.length - 1];
    if (last && last.name === l.name && last.kind === l.kind) {
      last.dist += l.dist; last.legs.push(l);
    } else groups.push({ name: l.name, kind: l.kind, dist: l.dist, legs: [l] });
  }
  // käännösohjeet ryhmien rajoilla
  const g0 = groups[0];
  const startVia = g0.kind === 'moped'
    ? 'mopoväylää' + (g0.name && g0.name !== 'mopoväylä' ? ' (' + g0.name + ')' : '') + ' pitkin'
    : 'kadulle ' + g0.name;
  const steps = [{ ic: '🟢', text: 'Lähde ' + startVia, dist: 0, at: coords[0], kind: g0.kind }];
  let acc = 0;
  for (let i = 0; i < groups.length; i++) {
    const grp = groups[i];
    if (i > 0) {
      const prev = groups[i - 1];
      const pl = prev.legs[prev.legs.length - 1], nl = grp.legs[0];
      const b1 = bearing(g.nodes.get(pl.from), g.nodes.get(pl.to));
      const b2 = bearing(g.nodes.get(nl.from), g.nodes.get(nl.to));
      let turn = ((b2 - b1 + 540) % 360) - 180; // -180..180, + = oikealle
      let ic = '↑', verb = 'Jatka';
      const a = Math.abs(turn);
      if (a >= 160) { ic = '⟲'; verb = 'Tee U-käännös'; }
      else if (a >= 100) { ic = turn > 0 ? '↳' : '↰'; verb = turn > 0 ? 'Käänny jyrkästi oikealle' : 'Käänny jyrkästi vasemmalle'; }
      else if (a >= 45) { ic = turn > 0 ? '→' : '←'; verb = turn > 0 ? 'Käänny oikealle' : 'Käänny vasemmalle'; }
      else if (a >= 20) { ic = turn > 0 ? '↗' : '↖'; verb = turn > 0 ? 'Pidä oikealla' : 'Pidä vasemmalla'; }
      let text = verb + (verb === 'Jatka' ? ' kadulle ' : ', ') + grp.name;
      if (verb === 'Jatka') text = 'Jatka: ' + grp.name;
      if (grp.kind === 'moped' && prev.kind !== 'moped') {
        text = verb !== 'Jatka' ? verb + ' mopoväylälle' : 'Siirry mopoväylälle';
        if (grp.name && grp.name !== 'mopoväylä') text += ' (' + grp.name + ')';
        ic = a < 20 ? '⇢' : ic;
      } else if (grp.kind !== 'moped' && prev.kind === 'moped') {
        text = (verb !== 'Jatka' ? verb + ', ' : 'Palaa ajotielle: ') + grp.name;
      }
      steps.push({ ic, text, dist: acc, at: g.nodes.get(nl.from), kind: grp.kind });
    }
    acc += grp.dist;
  }
  steps.push({ ic: '🏁', text: 'Perillä: ' + (toLL.label || 'määränpää'), dist: acc, at: coords[coords.length - 1], kind: 'road' });
  return { coords, legs, steps, distM, timeS, pathShare: distM ? pathM / distM : 0 };
}

/* ================= piirto ================= */
function drawRoute(rt, fromLL, toLL) {
  clearRouteLayers();
  // jaetaan väri­osuuksiin tyypin mukaan
  let seg = [state.graph.nodes.get(rt.legs[0].from)], kind = rt.legs[0].kind;
  const flush = () => {
    if (seg.length < 2) return;
    const style = kind === 'moped'
      ? { color: '#111', weight: 9, opacity: .85 }
      : { color: '#2f6fa5', weight: 9, opacity: .9 };
    state.layers.route.push(L.polyline(seg, style).addTo(map));
    const top = kind === 'moped'
      ? { color: '#ffc72c', weight: 5, dashArray: '10 8' }
      : { color: '#4ea8de', weight: 5 };
    state.layers.route.push(L.polyline(seg, top).addTo(map));
  };
  for (const l of rt.legs) {
    if (l.kind !== kind) { flush(); seg = [state.graph.nodes.get(l.from)]; kind = l.kind; }
    seg.push(state.graph.nodes.get(l.to));
  }
  flush();
  state.layers.markers.push(L.marker([fromLL.lat, fromLL.lon], { icon: pinIcon('#63d471') }).addTo(map));
  state.layers.markers.push(L.marker([toLL.lat, toLL.lon], { icon: pinIcon('#ff5c5c') }).addTo(map));
  map.fitBounds(L.latLngBounds(rt.coords), { padding: [40, 40] });
}
function renderSummary(rt) {
  $('sumTime').textContent = fmtTime(rt.timeS);
  $('sumDist').textContent = fmtDist(rt.distM);
  $('sumVia').textContent = Math.round(rt.pathShare * 100) + ' % matkasta\nmopoväylillä';
  const div = $('steps'); div.innerHTML = '';
  rt.steps.forEach(s => {
    const el = document.createElement('div');
    el.className = 'step' + (s.kind === 'moped' ? ' moped' : '');
    el.innerHTML = `<span class="ic">${s.ic}</span><span>${s.text}</span><span class="d">${fmtDist(s.dist)}</span>`;
    div.appendChild(el);
  });
  $('sheet').classList.add('open');
}

/* ================= reitin haku ================= */
async function computeRoute() {
  try {
    let fromLL = state.from, toLL = state.to;
    if (!fromLL && ($('fromInput').value.trim() === 'Oma sijainti' || !$('fromInput').value.trim())) {
      loading(true, 'Haetaan sijaintiasi…');
      fromLL = await getPosition();
    }
    if (!fromLL) {
      const res = await geocode($('fromInput').value.trim());
      if (!res.length) throw new Error('Lähtöpaikkaa ei löytynyt');
      fromLL = res[0];
    }
    if (!toLL) {
      const q = $('toInput').value.trim();
      if (!q) throw new Error('Kirjoita määränpää');
      loading(true, 'Haetaan määränpäätä…');
      const res = await geocode(q);
      if (!res.length) throw new Error('Määränpäätä ei löytynyt');
      toLL = res[0];
    }
    const bee = havM([fromLL.lat, fromLL.lon], [toLL.lat, toLL.lon]);
    if (bee / 1000 > MAX_TRIP_KM) throw new Error(`Reitti on liian pitkä yhdellä haulla (max ${MAX_TRIP_KM} km linnuntietä). Jaa matka osiin.`);
    if (bee < 30) throw new Error('Lähtö ja määränpää ovat samassa paikassa');

    const bbox = tripBbox(fromLL, toLL);
    if (!bboxContains(state.graph && state.graph.bbox, bbox)) {
      loading(true, 'Ladataan tiet ja mopoväylät (OpenStreetMap)…');
      const osm = await fetchOSM(bbox);
      loading(true, 'Rakennetaan reititysverkkoa…');
      await new Promise(r => setTimeout(r, 30)); // anna spinnerin päivittyä
      state.graph = buildGraph(osm, bbox);
      if (state.graph.nodes.size === 0) throw new Error('Alueelta ei löytynyt ajokelpoisia teitä');
    }
    loading(true, 'Lasketaan nopeinta reittiä…');
    await new Promise(r => setTimeout(r, 30));
    const g = state.graph;
    const s = nearestNode(g, fromLL.lat, fromLL.lon);
    const t = nearestNode(g, toLL.lat, toLL.lon);
    if (s === null || t === null) throw new Error('Lähtö tai määränpää on liian kaukana mopolle sallituista teistä');
    const legs = astar(g, s, t);
    if (!legs) throw new Error('Reittiä ei löytynyt mopolle sallittuja teitä pitkin. Kohde voi olla esim. moottoritien takana ilman rinnakkaisyhteyttä tällä alueella.');
    const rt = buildRoute(g, legs, fromLL, toLL);
    state.route = rt; state.routeFrom = fromLL; state.routeTo = toLL;
    drawRoute(rt, fromLL, toLL);
    renderSummary(rt);
    loading(false);
  } catch (e) {
    loading(false);
    toast(e.message || 'Jokin meni pieleen', true);
  }
}
$('routeBtn').onclick = computeRoute;

/* ================= navigointi ================= */
let wakeLock = null;
async function keepAwake(on) {
  try {
    if (on && 'wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen');
    else if (wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch (e) { /* ei tuettu -> ei haittaa */ }
}
function speak(txt) {
  if (!state.voice || !('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(txt);
  u.lang = 'fi-FI'; u.rate = 1.0;
  speechSynthesis.cancel(); speechSynthesis.speak(u);
}
// lähin piste reitillä -> {idx, distTo, along}
function snapToRoute(rt, lat, lon) {
  let best = { idx: 0, d: Infinity };
  for (let i = 0; i < rt.coords.length; i++) {
    const d = havM([lat, lon], rt.coords[i]);
    if (d < best.d) best = { idx: i, d };
  }
  return best;
}
function remaining(rt, idx) {
  let dist = 0, time = 0, acc = 0;
  for (let i = 0; i < rt.legs.length; i++) {
    acc += rt.legs[i].dist;
    if (i >= idx) { dist += rt.legs[i].dist; time += rt.legs[i].time; }
  }
  return { dist, time };
}
function distAlong(rt, idx) {
  let d = 0;
  for (let i = 0; i < Math.min(idx, rt.legs.length); i++) d += rt.legs[i].dist;
  return d;
}
function nextStep(rt, alongM) {
  for (const s of rt.steps) if (s.dist > alongM + 5) return s;
  return rt.steps[rt.steps.length - 1];
}

function startNav() {
  if (!state.route) return;
  $('topPanel').style.display = 'none';
  $('sheet').classList.remove('open');
  $('hud').classList.add('on'); $('hudbar').classList.add('on');
  keepAwake(true);
  state.nav = { offCount: 0, lastSpoken: null, follow: true };
  if (!state.layers.me) state.layers.me = L.marker(map.getCenter(), { icon: meIcon }).addTo(map);
  map.setZoom(17);
  state.nav.watchId = navigator.geolocation.watchPosition(onFix, err => {
    toast(geoErrText(err), true);
  }, { enableHighAccuracy: true, maximumAge: 1000, timeout: 25000 });
  toast('Navigointi käynnissä. Aja varovasti!');
}
function stopNav(arrived) {
  if (state.nav && state.nav.watchId != null) navigator.geolocation.clearWatch(state.nav.watchId);
  state.nav = null;
  keepAwake(false);
  $('hud').classList.remove('on'); $('hudbar').classList.remove('on');
  $('topPanel').style.display = '';
  if (state.route) $('sheet').classList.add('open');
  if (arrived) { speak('Olet perillä.'); toast('Perillä! 🏁'); }
}
async function onFix(p) {
  if (!state.nav || !state.route) return;
  const lat = p.coords.latitude, lon = p.coords.longitude;
  const spd = p.coords.speed != null ? Math.max(0, p.coords.speed * 3.6) : null;
  state.layers.me.setLatLng([lat, lon]);
  if (state.nav.follow) map.panTo([lat, lon], { animate: true, duration: .4 });

  const rt = state.route;
  const snap = snapToRoute(rt, lat, lon);
  const along = distAlong(rt, snap.idx);
  const rem = remaining(rt, snap.idx);

  // perillä?
  if (rem.dist < 25 || havM([lat, lon], rt.coords[rt.coords.length - 1]) < 25) { stopNav(true); return; }

  // reitiltä pois?
  if (snap.d > OFFROUTE_M) {
    state.nav.offCount++;
    if (state.nav.offCount >= 3) {
      state.nav.offCount = 0;
      toast('Poikkesit reitiltä — lasketaan uusi reitti…');
      speak('Lasketaan reitti uudelleen.');
      await reroute(lat, lon);
      return;
    }
  } else state.nav.offCount = 0;

  const ns = nextStep(rt, along);
  const dToTurn = Math.max(0, ns.dist - along);
  $('hudArrow').textContent = ns.ic;
  $('hudText').textContent = ns.text;
  $('hudSub').textContent = dToTurn > 15 ? fmtDist(dToTurn) : 'nyt';
  $('hudLeft').textContent = fmtDist(rem.dist) + ' jäljellä';
  $('hudEta').textContent = fmtTime(rem.time);
  $('hudSpeed').textContent = spd != null ? Math.round(spd) + ' km/h' : '– km/h';

  if (dToTurn < 90 && state.nav.lastSpoken !== ns) {
    state.nav.lastSpoken = ns;
    speak(ns.text);
  }
}
async function reroute(lat, lon) {
  try {
    const from = { lat, lon, label: 'Nykyinen sijainti' };
    const to = state.routeTo;
    const bbox = tripBbox(from, to);
    if (!bboxContains(state.graph.bbox, bbox)) {
      loading(true, 'Ladataan karttadataa…');
      const osm = await fetchOSM(bbox);
      state.graph = buildGraph(osm, bbox);
      loading(false);
    }
    const g = state.graph;
    const s = nearestNode(g, lat, lon), t = nearestNode(g, to.lat, to.lon);
    if (s === null || t === null) throw new Error('ei solmua');
    const legs = astar(g, s, t);
    if (!legs) throw new Error('ei reittiä');
    const rt = buildRoute(g, legs, from, to);
    state.route = rt;
    drawRoute(rt, from, to);
    map.setZoom(17);
    if (state.nav) state.nav.lastSpoken = null;
  } catch (e) {
    loading(false);
    toast('Uutta reittiä ei saatu laskettua — palaa reitille', true);
  }
}
$('navBtn').onclick = startNav;
$('stopBtn').onclick = () => stopNav(false);
$('centerBtn').onclick = () => { if (state.nav) state.nav.follow = true; if (state.layers.me) map.panTo(state.layers.me.getLatLng()); };
map.on('dragstart', () => { if (state.nav) state.nav.follow = false; });
$('voiceBtn').onclick = () => {
  state.voice = !state.voice;
  $('voiceBtn').textContent = (state.voice ? '🔊' : '🔇') + ' Ääni';
  if (state.voice) speak('Ääniohjeet käytössä.');
};

/* ================= muu UI ================= */
$('stepsBtn').onclick = () => $('steps').classList.toggle('open');
$('infoBtn').onclick = () => $('infoDlg').showModal();
$('infoClose').onclick = () => $('infoDlg').close();

// pitkä painallus / hiiren oikea kartalla = aseta määränpää
map.on('contextmenu', e => {
  state.to = { lat: e.latlng.lat, lon: e.latlng.lng, label: 'Kartalta valittu piste' };
  $('toInput').value = 'Kartalta valittu piste';
  toast('Määränpää asetettu kartalta');
});

// keskitä käyttäjän sijaintiin alussa (jos lupa on jo annettu)
if (navigator.geolocation && navigator.permissions) {
  navigator.permissions.query({ name: 'geolocation' }).then(st => {
    if (st.state === 'granted') navigator.geolocation.getCurrentPosition(
      p => map.setView([p.coords.latitude, p.coords.longitude], 14), () => {});
  }).catch(() => {});
}
