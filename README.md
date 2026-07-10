<!DOCTYPE html>
<html lang="fi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<title>Kaarre — VR Aika-ajo</title>
<style>
  :root{ --gold:#ffcf6b; --ink:#f5ecff; --dim:#b9a8d8; }
  *{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent}
  html,body{width:100%;height:100%;overflow:hidden;background:#14132e;
    font-family:-apple-system,"SF Pro Display",system-ui,sans-serif;color:var(--ink);
    -webkit-user-select:none;user-select:none;touch-action:none}
  #c{position:fixed;inset:0;width:100%;height:100%;display:block}
  .overlay{position:fixed;inset:0;display:flex;overflow-y:auto;touch-action:pan-y;
    padding:calc(14px + env(safe-area-inset-top)) calc(14px + env(safe-area-inset-right))
            calc(14px + env(safe-area-inset-bottom)) calc(14px + env(safe-area-inset-left));
    background:linear-gradient(180deg,#141230 0%,#2b2a55 55%,#7c4064 85%,#ff9a5a 130%);
    z-index:10;transition:opacity .4s;-webkit-overflow-scrolling:touch}
  .overlay.hidden{opacity:0;pointer-events:none}
  .inner{margin:auto;display:flex;flex-direction:column;align-items:center;
    text-align:center;max-width:620px;width:100%}
  .eyebrow{font-size:11px;letter-spacing:.34em;text-transform:uppercase;color:var(--gold);margin-bottom:10px}
  h1{font-size:clamp(34px,9vw,58px);font-weight:800;letter-spacing:-.02em;line-height:1.02}
  h1 em{font-style:normal;color:var(--gold)}
  .sub{margin-top:10px;font-size:14px;color:var(--dim);max-width:460px;line-height:1.5}
  .pad-status{margin-top:18px;font-size:13px;padding:8px 14px;border:1px solid rgba(255,207,107,.35);
    border-radius:999px;color:var(--dim)}
  .pad-status.ok{color:var(--gold);border-color:var(--gold)}
  .tracks{margin-top:20px;display:flex;gap:10px;width:100%;justify-content:center;flex-wrap:wrap}
  .track{flex:1;min-width:130px;max-width:180px;padding:12px 10px;border-radius:14px;cursor:pointer;
    border:1px solid rgba(245,236,255,.25);background:rgba(20,19,46,.35)}
  .track.sel{border-color:var(--gold);background:rgba(255,207,107,.12)}
  .track b{display:block;font-size:15px}
  .track span{display:block;margin-top:4px;font-size:11px;color:var(--dim)}
  .btns{margin-top:20px;display:flex;flex-direction:column;gap:12px;width:min(320px,80vw)}
  button{font:inherit;font-size:16px;font-weight:700;padding:15px 18px;border-radius:14px;
    border:none;cursor:pointer;color:#231c3a;background:var(--gold)}
  button.ghost{background:transparent;color:var(--ink);border:1px solid rgba(245,236,255,.35);font-weight:600}
  button:active{transform:scale(.98)}
  .hint{margin-top:18px;font-size:12px;color:var(--dim);line-height:1.7;max-width:460px}
  .hint b{color:var(--ink);font-weight:600}
  #rotate{display:none;position:fixed;inset:0;z-index:20;background:#14132e;color:var(--ink);
    align-items:center;justify-content:center;font-size:17px;font-weight:600;text-align:center;padding:30px}
  #divider{display:none;position:fixed;left:50%;top:0;width:3px;height:100%;
    margin-left:-1.5px;background:#0a0920;z-index:5}
  .ctrl-table{margin-top:14px;font-size:13px;color:var(--dim);line-height:2;text-align:left}
  .ctrl-table b{color:var(--gold);font-weight:700;display:inline-block;min-width:118px}
  @media (max-height:560px){
    h1{font-size:30px}
    .eyebrow{margin-bottom:4px;font-size:10px}
    .sub{margin-top:5px;font-size:12px}
    .pad-status{margin-top:8px;font-size:11px;padding:6px 12px}
    .tracks{margin-top:10px;gap:8px}
    .track{padding:8px}
    .track b{font-size:13px}
    .btns{margin-top:10px;flex-direction:row;width:auto;gap:10px}
    button{font-size:14px;padding:11px 16px}
    .hint{margin-top:8px;font-size:10px;line-height:1.6}
    .ctrl-table{font-size:11px;line-height:1.7;margin-top:8px}
  }
</style>
</head>
<body>
<canvas id="c"></canvas>

<div id="start" class="overlay">
 <div class="inner">
  <div class="eyebrow">Safari · Cardboard · Gamepad · v2.1</div>
  <h1>Kaa<em>rre</em></h1>
  <p class="sub">VR-aika-ajo. Valitse rata, aja puhtaasti, jahtaa parasta kierrosta.</p>
  <div id="padStatus" class="pad-status">Ohjain: paina mitä tahansa nappia herättääksesi…</div>
  <div id="wheelStatus" class="pad-status" style="cursor:pointer">🏎 Yhdistä ratti (PC-silta) — napauta</div>
  <div id="wheelLog" style="display:none;margin-top:8px;max-height:110px;overflow-y:auto;width:100%;
    font-family:ui-monospace,Menlo,monospace;font-size:10px;color:var(--dim);
    text-align:left;background:rgba(10,9,32,.5);border-radius:10px;padding:8px;white-space:pre-wrap"></div>
  <div class="tracks" id="trackList"></div>
  <div class="btns">
    <button id="btnVR">Aja VR:ssä</button>
    <button id="btnMono" class="ghost">Testaa ilman laseja (2D)</button>
  </div>
  <p class="hint">
    <b>R2</b> kaasu · <b>L2</b> jarru · <b>○</b> pakki · <b>vasen tatti</b> ohjaus · <b>□</b> vaihda näkymä<br>
    <b>△</b> keskitä · <b>R1</b> ääni · <b>ristiohjain</b> linssisäätö · <b>Options</b> valikko (↑↓ + ✕)<br>
    Kierrosaika käynnistyy, kun ylität lähtöviivan ensimmäisen kerran.<br>
    Rattisilta PC:lle: <a href="ratti-silta.html" target="_blank" style="color:var(--gold)">avaa tästä</a>
    (sama osoite + /ratti-silta.html)
  </p>
 </div>
</div>

<div id="rotate"><div>Käännä puhelin vaakatasoon 🏁</div></div>
<div id="divider"></div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/peerjs/1.5.2/peerjs.min.js"></script>
<script>
'use strict';
/* virheet näkyviin aloitusruudulle hiljaisen kaatumisen sijaan */
window.addEventListener('error', function(e){
  var el = document.getElementById('padStatus');
  if(el){ el.textContent = 'Virhe: ' + (e.message || 'tuntematon'); el.style.color = '#ff8f8f'; }
});
if(!window.THREE){
  document.getElementById('padStatus').textContent = 'three.js ei latautunut — tarkista verkkoyhteys';
  throw new Error('THREE puuttuu');
}

/* ============ perusrunko ============ */
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({canvas, antialias:true, powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputEncoding = THREE.sRGBEncoding;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xff9a5a, 200, 1500);

let mode = null, running = false, paused = false;
const rng = (a,b)=>a+Math.random()*(b-a);

/* ============ taivas, aurinko, valot, maa ============ */
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite:false, fog:false,
  uniforms:{ top:{value:new THREE.Color('#2b2a55')}, mid:{value:new THREE.Color('#83446b')},
             bot:{value:new THREE.Color('#ff9a5a')} },
  vertexShader:`varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
  fragmentShader:`varying vec3 vP; uniform vec3 top,mid,bot;
    void main(){ float h=normalize(vP).y;
      vec3 c = h>0.12 ? mix(mid,top,smoothstep(0.12,0.75,h)) : mix(bot,mid,smoothstep(-0.05,0.12,h));
      gl_FragColor=vec4(c,1.0);} `
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(3000, 24, 12), skyMat); scene.add(sky);
const sun = new THREE.Mesh(new THREE.CircleGeometry(150, 40),
  new THREE.MeshBasicMaterial({color:'#ffd27d', fog:false}));
sun.position.set(600, 240, -2600); scene.add(sun);
const hemi = new THREE.HemisphereLight(0xffc7a0, 0x2a2450, 0.95); scene.add(hemi);
const dirL = new THREE.DirectionalLight(0xffd7a8, 0.75);
dirL.position.set(0.3, 0.5, -1); scene.add(dirL);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000),
  new THREE.MeshLambertMaterial({color:'#8a5a45'}));
ground.rotation.x = -Math.PI/2; ground.position.y = -0.06; scene.add(ground);

/* ============ auton rigi (ennen kaikkea muuta mikä siihen viittaa) ============ */
const rig = new THREE.Group(); scene.add(rig);
const head = new THREE.Group(); rig.add(head);
const camL = new THREE.PerspectiveCamera(80, 1, 0.05, 3500);
const camR = new THREE.PerspectiveCamera(80, 1, 0.05, 3500);
const camM = new THREE.PerspectiveCamera(78, 1, 0.05, 3500);
camL.position.x = -0.032; camR.position.x = 0.032;
head.add(camL); head.add(camR); head.add(camM);

/* näkymät: cockpit & tuulilasi (konepelti) */
const VIEWS = {
  cockpit:{ eye:new THREE.Vector3(0, 1.17, 0.28), hud:new THREE.Vector3(0, 1.3, -0.85) },
  hood:   { eye:new THREE.Vector3(0, 1.22, -0.7), hud:new THREE.Vector3(0, 1.32, -2.35) }
};
let view = 'cockpit';

/* ============ linssikalibrointi + toast ============ */
let lensShiftPx = -78, eyeFov = 80, noticeUntil = 0;
function applyEyeSettings(){
  const w = window.innerWidth, h = window.innerHeight;
  camL.fov = eyeFov; camR.fov = eyeFov;
  camL.setViewOffset(w/2, h,  lensShiftPx, 0, w/2, h);
  camR.setViewOffset(w/2, h, -lensShiftPx, 0, w/2, h);
  camL.updateProjectionMatrix(); camR.updateProjectionMatrix();
}
function showNotice(t){
  noticeUntil = performance.now() + 2500;
  drawToast(t); toast.visible = true;
}
function adjustLens(d){
  lensShiftPx = Math.max(-140, Math.min(140, lensShiftPx + d*4));
  applyEyeSettings(); showNotice('Linssiväli: ' + lensShiftPx);
}
function adjustZoom(d){
  eyeFov = Math.max(58, Math.min(100, eyeFov - d*2));
  applyEyeSettings(); showNotice('FOV: ' + eyeFov);
}

/* ============ auton korimalli ============ */
const matBody  = new THREE.MeshLambertMaterial({color:'#b8452f', flatShading:true});
const matDark  = new THREE.MeshLambertMaterial({color:'#231c3a', flatShading:true});
const matTrim  = new THREE.MeshLambertMaterial({color:'#171330', flatShading:true});
const matGold  = new THREE.MeshLambertMaterial({color:'#ffcf6b', flatShading:true});

/* ulkokuori: konepelti, lokasuojat, peilit — näkyy molemmissa näkymissä */
const exterior = new THREE.Group(); rig.add(exterior);
const hoodMesh = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.16, 1.5), matBody);
hoodMesh.position.set(0, 0.82, -1.65); hoodMesh.rotation.x = 0.05; exterior.add(hoodMesh);
const noseMesh = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.3, 0.5), matBody);
noseMesh.position.set(0, 0.68, -2.45); exterior.add(noseMesh);
for(const s of [-1,1]){
  const fender = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.22, 1.5), matBody);
  fender.position.set(s*0.86, 0.86, -1.6); exterior.add(fender);
  const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.09), matDark);
  mirror.position.set(s*1.02, 1.05, -0.62); exterior.add(mirror);
}

/* sisusta: kojelauta, ratti, pilarit, katto — piilotetaan tuulilasinäkymässä */
const interior = new THREE.Group(); rig.add(interior);

/* elävä mittaristo: nopeusneula + tehomittari */
const gaugeCanvas = document.createElement('canvas'); gaugeCanvas.width=512; gaugeCanvas.height=224;
const gaugeCtx = gaugeCanvas.getContext('2d');
const gaugeTex = new THREE.CanvasTexture(gaugeCanvas);
function dial(g, cx, cy, r, frac, color, ticks){
  g.strokeStyle='rgba(185,168,216,0.45)'; g.lineWidth=3;
  g.beginPath(); g.arc(cx, cy, r, 0.75*Math.PI, 2.25*Math.PI); g.stroke();
  g.strokeStyle='rgba(185,168,216,0.8)'; g.lineWidth=2;
  for(let i=0;i<=ticks;i++){
    const a = 0.75*Math.PI + i/ticks*1.5*Math.PI;
    g.beginPath();
    g.moveTo(cx+Math.cos(a)*(r-9), cy+Math.sin(a)*(r-9));
    g.lineTo(cx+Math.cos(a)*r, cy+Math.sin(a)*r);
    g.stroke();
  }
  const a = 0.75*Math.PI + Math.min(1, Math.max(0, frac))*1.5*Math.PI;
  g.strokeStyle=color; g.lineWidth=5;
  g.beginPath(); g.moveTo(cx,cy);
  g.lineTo(cx+Math.cos(a)*(r-15), cy+Math.sin(a)*(r-15)); g.stroke();
  g.fillStyle=color; g.beginPath(); g.arc(cx,cy,6,0,Math.PI*2); g.fill();
}
function drawGauges(speedKmh, thr){
  const g = gaugeCtx; g.clearRect(0,0,512,224);
  g.fillStyle='#100e26';
  g.beginPath(); g.roundRect ? g.roundRect(0,0,512,224,28) : g.rect(0,0,512,224); g.fill();
  g.strokeStyle='rgba(255,207,107,0.35)'; g.lineWidth=3;
  g.beginPath(); g.roundRect ? g.roundRect(4,4,504,216,24) : g.rect(4,4,504,216); g.stroke();
  dial(g, 160, 112, 88, speedKmh/240, '#ffcf6b', 12);
  g.fillStyle='#ffd98f'; g.font='800 46px -apple-system, sans-serif';
  g.textAlign='center'; g.textBaseline='middle';
  g.fillText(speedKmh, 160, 146);
  g.fillStyle='#b9a8d8'; g.font='500 19px -apple-system, sans-serif';
  g.fillText('km/h', 160, 182);
  dial(g, 384, 112, 62, thr, '#3ad0b0', 8);
  g.fillStyle='#8fe8d2'; g.font='600 19px -apple-system, sans-serif';
  g.fillText('POWER', 384, 172);
  gaugeTex.needsUpdate = true;
}
drawGauges(0, 0);

/* kaksisävyinen urheilullinen kojelauta */
const dashMain = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.18, 0.55), matTrim);
dashMain.position.set(0, 0.87, -0.8); interior.add(dashMain);
const dashPad = new THREE.Mesh(new THREE.BoxGeometry(1.74, 0.05, 0.62), matDark);
dashPad.position.set(0, 0.965, -0.8); interior.add(dashPad);
const dashFascia = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.26, 0.07), matTrim);
dashFascia.position.set(0, 0.74, -0.55); dashFascia.rotation.x = 0.3; interior.add(dashFascia);
const goldStrip = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.018, 0.02), matGold);
goldStrip.position.set(0, 0.86, -0.52); interior.add(goldStrip);
for(const s of [-1,1]){
  const toggle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.025, 0.05), matGold);
  toggle.position.set(s*0.5, 0.9, -0.55); interior.add(toggle);
}

/* mittarikupu ratin takana */
const binnacle = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.15, 0.3), matDark);
binnacle.position.set(0, 1.0, -0.68); interior.add(binnacle);
const binBrow = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.03, 0.36), matTrim);
binBrow.position.set(0, 1.085, -0.69); interior.add(binBrow);
const gaugeFace = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.19),
  new THREE.MeshBasicMaterial({map:gaugeTex}));
gaugeFace.position.set(0, 1.0, -0.525); gaugeFace.rotation.x = -0.28; interior.add(gaugeFace);

/* flat-bottom-sporttiratti — irti kojelaudasta, pyörii ohjauksen mukana */
const wheelGroup = new THREE.Group();
wheelGroup.position.set(0, 0.84, -0.36); wheelGroup.rotation.x = -0.52; interior.add(wheelGroup);
const wheelRim = new THREE.Mesh(new THREE.TorusGeometry(0.185, 0.024, 8, 26, Math.PI*1.62), matDark);
wheelRim.rotation.z = -0.31*Math.PI; wheelGroup.add(wheelRim);
const flatBar = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.028, 0.048), matDark);
flatBar.position.set(0, -0.152, 0); wheelGroup.add(flatBar);
for(const s of [-1,1]){
  const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.032, 0.02), matTrim);
  spoke.position.set(s*0.1, 0, 0.008); wheelGroup.add(spoke);
}
const spokeDown = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.12, 0.02), matTrim);
spokeDown.position.set(0, -0.09, 0.008); wheelGroup.add(spokeDown);
const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.035, 12), matDark);
hub.rotation.x = Math.PI/2; wheelGroup.add(hub);
const hubRing = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.008, 6, 18), matGold);
wheelGroup.add(hubRing);
const topMark = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.03, 0.05), matGold);
topMark.position.set(0, 0.182, 0); wheelGroup.add(topMark);
const column = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.036, 0.34, 8), matTrim);
column.rotation.x = 1.1; column.position.set(0, 0.9, -0.5); interior.add(column);

/* pilarit, katonreuna, taustapeili, tuulilasi */
for(const s of [-1,1]){
  const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.62, 0.09), matDark);
  pillar.position.set(s*0.82, 1.22, -0.55); pillar.rotation.x = 0.42; pillar.rotation.z = s*0.12;
  interior.add(pillar);
  const doorTop = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.14, 1.3), matDark);
  doorTop.position.set(s*0.88, 0.98, 0.15); interior.add(doorTop);
}
const roofBar = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.07, 0.16), matDark);
roofBar.position.set(0, 1.5, -0.28); interior.add(roofBar);
const rearMirror = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.09, 0.03), matTrim);
rearMirror.position.set(0, 1.36, -0.44); interior.add(rearMirror);
const windshield = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.62),
  new THREE.MeshBasicMaterial({color:'#9fd8ff', transparent:true, opacity:0.06,
    side:THREE.DoubleSide, depthWrite:false}));
windshield.position.set(0, 1.18, -0.72); windshield.rotation.x = -0.38; interior.add(windshield);

/* ============ HUD (kierrosaika) — hologrammi, piirtyy aina päällimmäisenä ============ */
const hudCanvas = document.createElement('canvas'); hudCanvas.width=512; hudCanvas.height=224;
const hudCtx = hudCanvas.getContext('2d');
const hudTex = new THREE.CanvasTexture(hudCanvas);
const hud = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.22),
  new THREE.MeshBasicMaterial({map:hudTex, transparent:true, depthWrite:false, depthTest:false, fog:false}));
hud.renderOrder = 10;
hud.position.copy(VIEWS.cockpit.hud); hud.rotation.x = -0.18; rig.add(hud);

function fmt(ms){
  if(ms == null) return '--:--.---';
  const m = Math.floor(ms/60000), s = Math.floor(ms%60000/1000), t = Math.floor(ms%1000);
  return m + ':' + String(s).padStart(2,'0') + '.' + String(t).padStart(3,'0');
}
function drawHUD(curMs, lastMs, bestMs, armed){
  const g = hudCtx; g.clearRect(0,0,512,224);
  g.shadowColor='#ffb84d'; g.shadowBlur=12;
  g.fillStyle='#ffd98f'; g.textBaseline='middle';
  g.font='800 68px -apple-system, sans-serif'; g.textAlign='center';
  g.fillText(armed ? fmt(curMs) : 'LÄHTÖVIIVALLE', 256, 62);
  g.font='600 36px -apple-system, sans-serif';
  g.textAlign='left';  g.fillText('EDEL ' + fmt(lastMs), 16, 160);
  g.textAlign='right'; g.fillText('PARAS ' + fmt(bestMs), 496, 160);
  g.shadowBlur=0; g.textAlign='left';
  hudTex.needsUpdate = true;
}

/* iso toast keskelle näkökenttää */
const toastCanvas = document.createElement('canvas'); toastCanvas.width=768; toastCanvas.height=160;
const toastCtx = toastCanvas.getContext('2d');
const toastTex = new THREE.CanvasTexture(toastCanvas);
const toast = new THREE.Mesh(new THREE.PlaneGeometry(1.35, 0.28),
  new THREE.MeshBasicMaterial({map:toastTex, transparent:true, depthWrite:false, depthTest:false, fog:false}));
toast.renderOrder = 11;
toast.position.set(0, -0.3, -1.6); toast.visible = false; head.add(toast);
function drawToast(text){
  const g = toastCtx; g.clearRect(0,0,768,160);
  g.fillStyle='rgba(20,19,46,0.72)';
  g.beginPath(); g.roundRect ? g.roundRect(40,20,688,120,26) : g.rect(40,20,688,120); g.fill();
  g.fillStyle='#ffcf6b'; g.font='800 66px -apple-system, sans-serif';
  g.textAlign='center'; g.textBaseline='middle';
  g.fillText(text, 384, 82);
  toastTex.needsUpdate = true;
}

/* ============ interaktiivinen VR-valikko (tauko + radanvalinta) ============ */
const menuCanvas = document.createElement('canvas'); menuCanvas.width=1024; menuCanvas.height=640;
const menuCtx = menuCanvas.getContext('2d');
const menuTex = new THREE.CanvasTexture(menuCanvas);
const menuPanel = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.125),
  new THREE.MeshBasicMaterial({map:menuTex, transparent:true, depthWrite:false, depthTest:false, fog:false}));
menuPanel.renderOrder = 12;
menuPanel.position.set(0, 0, -1.9); menuPanel.visible = false; head.add(menuPanel);

let menuState = 'none', menuSel = 0;   // 'none' | 'pause' | 'main'
let pauseT0 = 0;                        // kellon pysäytys valikon ajaksi
function menuItems(){
  if(menuState === 'pause')
    return [['Jatka','takaisin ajoon'],
            ['Aloita alusta', gameMode==='highway' ? 'uusi yritys' : 'auto lähtöviivalle'],
            ['Ohjausherkkyys','◄  ' + Math.round(steerSens*100) + ' %  ►'],
            ['Vaihda rataa','valintaan']];
  if(menuState === 'results')
    return [['Aja uudestaan','sama meno'],['Valikkoon','vaihda moodia']];
  return MENU_TRACKS.map(T=>[T.name, T.desc]);
}
function drawMenu(){
  const g = menuCtx; g.clearRect(0,0,1024,640);
  g.fillStyle='rgba(20,19,46,0.94)';
  g.beginPath(); g.roundRect ? g.roundRect(20,20,984,600,36) : g.rect(20,20,984,600); g.fill();
  g.strokeStyle='#ffcf6b'; g.lineWidth=4;
  g.beginPath(); g.roundRect ? g.roundRect(20,20,984,600,36) : g.rect(20,20,984,600); g.stroke();
  g.fillStyle='#ffcf6b'; g.font='800 72px -apple-system, sans-serif';
  g.textAlign='center'; g.textBaseline='alphabetic';
  g.fillText(menuState==='pause' ? 'TAUKO' : menuState==='results' ? 'KOLARI' : 'VALITSE RATA', 512, 120);
  let y0 = 190;
  if(menuState === 'results'){
    g.font='600 38px -apple-system, sans-serif'; g.fillStyle='#e9defa';
    g.fillText('Pisteet ' + Math.round(hwScore) + '  ·  Matka ' + (hwDist/1000).toFixed(2) + ' km  ·  Paras ' + Math.round(hwBest), 512, 190);
    y0 = 280;
  }
  const items = menuItems();
  items.forEach(([name, desc], i)=>{
    const y = y0 + i*(items.length > 3 ? 100 : 112);
    if(i === menuSel){
      g.fillStyle='rgba(255,207,107,0.16)';
      g.beginPath(); g.roundRect ? g.roundRect(70, y-52, 884, 92, 20) : g.rect(70, y-52, 884, 92); g.fill();
      g.fillStyle='#ffcf6b'; g.font='800 50px -apple-system, sans-serif'; g.textAlign='left';
      g.fillText('►', 96, y+16);
    }
    g.font='700 46px -apple-system, sans-serif'; g.textAlign='left';
    g.fillStyle = i===menuSel ? '#ffcf6b' : '#e9defa';
    g.fillText(name, 160, y+8);
    g.font='400 30px -apple-system, sans-serif'; g.fillStyle='#b9a8d8';
    g.fillText(desc, 560, y+8);
  });
  g.fillStyle='#b9a8d8'; g.font='600 36px -apple-system, sans-serif'; g.textAlign='center';
  g.fillText('ristiohjain ↑↓ · ✕ valitse' + (menuState==='pause' ? ' · ◄ ► säädä · Options jatka' : ''), 512, 590);
  menuTex.needsUpdate = true;
}
function openMenu(s){
  if(menuState === 'none') pauseT0 = performance.now();
  menuState = s;
  menuSel = (s==='main') ? selectedTrack : 0;
  paused = true;
  drawMenu(); menuPanel.visible = true;
}
function closeMenu(){
  if(lapArmed && pauseT0) lapStart += performance.now() - pauseT0;
  pauseT0 = 0;
  menuState = 'none'; paused = false; menuPanel.visible = false;
}
function menuAction(){
  if(menuState === 'pause'){
    if(menuSel === 0) closeMenu();
    else if(menuSel === 1){
      if(gameMode === 'highway'){ resetHighwayRun(); closeMenu(); showNotice('Uusi yritys'); }
      else { placeCarAtGrid(); closeMenu(); showNotice('Lähtöviivalle'); }
    }
    else if(menuSel === 2){
      steerSens = steerSens >= 1.3 ? 0.3 : Math.round((steerSens+0.1)*10)/10;
      drawMenu();
    }
    else openMenu('main');
  } else if(menuState === 'results'){
    if(menuSel === 0){ resetHighwayRun(); closeMenu(); }
    else openMenu('main');
  } else if(menuState === 'main'){
    selectedTrack = menuSel;
    document.querySelectorAll('.track').forEach((el,j)=>el.classList.toggle('sel', j===menuSel));
    if(menuSel === 3){
      startHighwayRun();
      closeMenu(); showNotice('Moottoritie');
    } else {
      gameMode = 'race';
      hwGroup.visible = false;
      mmPlane.visible = true;
      buildTrack(menuSel);
      lastLap = null; bestLap = null;
      placeCarAtGrid();
      closeMenu(); showNotice(TRACKS[menuSel].name);
    }
  }
}

/* ============ minimap ============ */
const mmBase = document.createElement('canvas'); mmBase.width=256; mmBase.height=256;
const mmCanvas = document.createElement('canvas'); mmCanvas.width=256; mmCanvas.height=256;
const mmCtx = mmCanvas.getContext('2d');
const mmTex = new THREE.CanvasTexture(mmCanvas);
const mmPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34),
  new THREE.MeshBasicMaterial({map:mmTex, transparent:true, depthWrite:false, depthTest:false, fog:false}));
mmPlane.renderOrder = 11;
mmPlane.position.set(0.56, -0.27, -1.5); mmPlane.rotation.y = -0.22; head.add(mmPlane);
let mmProject = null;
function drawMinimapBase(samples){
  let minX=Infinity, maxX=-Infinity, minZ=Infinity, maxZ=-Infinity;
  for(const s of samples){
    minX=Math.min(minX,s.p.x); maxX=Math.max(maxX,s.p.x);
    minZ=Math.min(minZ,s.p.z); maxZ=Math.max(maxZ,s.p.z);
  }
  const pad=26, span=256-2*pad;
  const scale = Math.min(span/(maxX-minX), span/(maxZ-minZ));
  const offX = pad + (span-(maxX-minX)*scale)/2;
  const offZ = pad + (span-(maxZ-minZ)*scale)/2;
  mmProject = (x,z)=>[offX+(x-minX)*scale, offZ+(z-minZ)*scale];
  const g = mmBase.getContext('2d');
  g.clearRect(0,0,256,256);
  g.fillStyle='rgba(20,19,46,0.6)';
  g.beginPath(); g.roundRect ? g.roundRect(4,4,248,248,28) : g.rect(4,4,248,248); g.fill();
  g.beginPath();
  for(let i=0;i<samples.length;i+=4){
    const [px,py] = mmProject(samples[i].p.x, samples[i].p.z);
    i ? g.lineTo(px,py) : g.moveTo(px,py);
  }
  g.closePath();
  g.strokeStyle='#0a0920'; g.lineWidth=11; g.stroke();
  g.strokeStyle='#9d92bd'; g.lineWidth=5; g.stroke();
  const [sx,sy] = mmProject(samples[0].p.x, samples[0].p.z);
  g.fillStyle='#e9e2f5';
  g.fillRect(sx-5, sy-5, 10, 10);
}
function updateMinimap(){
  if(!mmProject) return;
  const g = mmCtx;
  g.clearRect(0,0,256,256);
  g.drawImage(mmBase,0,0);
  const [px,py] = mmProject(rig.position.x, rig.position.z);
  const tx = px - Math.sin(car.yaw)*12, ty = py - Math.cos(car.yaw)*12;
  g.strokeStyle='#ffcf6b'; g.lineWidth=4;
  g.beginPath(); g.moveTo(px,py); g.lineTo(tx,ty); g.stroke();
  g.fillStyle='#ffcf6b';
  g.beginPath(); g.arc(px,py,7,0,Math.PI*2); g.fill();
  mmTex.needsUpdate = true;
}

/* ============ MOOTTORITIE-MOODI ============ */
let gameMode = 'race';               // 'race' | 'highway'
let crashed = false, crashT = 0;
let hwScore = 0, hwDist = 0, hwBest = 0, hwPlayerLat = 0, hwPrevZ = 0;
const HW = { laneW:3.4, halfRoad:7.6, barrier:8.7, chunkLen:200, step:4 };
const hwGroup = new THREE.Group(); hwGroup.visible = false; scene.add(hwGroup);

function hwCenterX(z){ return 22*Math.sin(z*0.0031) + 13*Math.sin(z*0.00113 + 2.0); }
function hwSlope(z){ return 22*0.0031*Math.cos(z*0.0031) + 13*0.00113*Math.cos(z*0.00113 + 2.0); }
function hwYaw(z){ return Math.atan2(hwSlope(z), 1); }

/* --- tiepalat (rakentuvat edelle, purkautuvat takaa) --- */
const hwChunks = new Map();
const hwAsphaltMat = new THREE.MeshLambertMaterial({color:'#2e2b40', side:THREE.DoubleSide});
const hwLineMat  = new THREE.MeshBasicMaterial({color:'#e9e2f5', side:THREE.DoubleSide});
const hwDashMat  = new THREE.MeshBasicMaterial({color:'#cfc6e6', side:THREE.DoubleSide});
const hwPoleMat  = new THREE.MeshLambertMaterial({color:'#4a4560', flatShading:true});
const hwBushMat  = new THREE.MeshLambertMaterial({color:'#2f4a3a', flatShading:true});
function hwRibbonRow(pos, z, off, w){
  const th = hwYaw(z), rx = Math.cos(th), rz = -Math.sin(th);
  const cx = hwCenterX(z);
  pos.push(cx + rx*(off-w), 0.02, z + rz*(off-w));
  pos.push(cx + rx*(off+w), 0.02, z + rz*(off+w));
}
function hwStrip(g, z0, z1, step, off, w, mat, dashOn, dashCycle){
  const pos = [], idx = []; let vi = 0;
  for(let z = z0; z < z1; z += step){
    if(dashOn && ((z % dashCycle + dashCycle) % dashCycle) > dashOn) continue;
    hwRibbonRow(pos, z, off, w); hwRibbonRow(pos, z + step*0.999, off, w);
    idx.push(vi, vi+2, vi+1, vi+1, vi+2, vi+3); vi += 4;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos,3));
  geo.setIndex(idx); geo.computeVertexNormals();
  g.add(new THREE.Mesh(geo, mat));
}
function buildChunk(ci){
  const g = new THREE.Group();
  const z0 = ci*HW.chunkLen, z1 = z0 + HW.chunkLen;
  /* asfaltti */
  const pos = [], idx = []; let vi = 0;
  for(let z = z0; z <= z1; z += HW.step){
    const th = hwYaw(z), rx = Math.cos(th), rz = -Math.sin(th), cx = hwCenterX(z);
    pos.push(cx - rx*HW.halfRoad, 0, z - rz*HW.halfRoad);
    pos.push(cx + rx*HW.halfRoad, 0, z + rz*HW.halfRoad);
    if(z < z1){ idx.push(vi, vi+2, vi+1, vi+1, vi+2, vi+3); }
    vi += 2;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos,3));
  geo.setIndex(idx); geo.computeVertexNormals();
  g.add(new THREE.Mesh(geo, hwAsphaltMat));
  /* reunaviivat + kaistakatkot */
  hwStrip(g, z0, z1, HW.step, -(HW.halfRoad-0.35), 0.14, hwLineMat, 0, 0);
  hwStrip(g, z0, z1, HW.step,  (HW.halfRoad-0.35), 0.14, hwLineMat, 0, 0);
  for(const off of [-HW.laneW, 0, HW.laneW])
    hwStrip(g, z0, z1, HW.step, off, 0.09, hwDashMat, 4, 12);
  /* valaisinpylväät + pusikot */
  for(let z = z0; z < z1; z += 48){
    const side = (Math.floor(z/48) % 2) ? 1 : -1;
    const th = hwYaw(z), rx = Math.cos(th), rz = -Math.sin(th), cx = hwCenterX(z);
    const px = cx + rx*side*10.5, pz2 = z + rz*side*10.5;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.11,5.6,6), hwPoleMat);
    pole.position.set(px, 2.8, pz2); g.add(pole);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.7,0.09,0.12), hwPoleMat);
    arm.position.set(px - rx*side*0.85, 5.5, pz2); g.add(arm);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.35,0.08,0.2),
      new THREE.MeshBasicMaterial({color:'#ffd98f'}));
    lamp.position.set(px - rx*side*1.6, 5.44, pz2); g.add(lamp);
  }
  for(let z = z0 + 17; z < z1; z += 41){
    const side = Math.random() < 0.5 ? -1 : 1;
    const d = 13 + Math.random()*24, r0 = rng(1.2, 2.6);
    const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(r0, 0), hwBushMat);
    bush.position.set(hwCenterX(z) + side*d, r0*0.5, z);
    g.add(bush);
  }
  hwGroup.add(g); hwChunks.set(ci, g);
}
function manageChunks(){
  const ciNow = Math.floor(rig.position.z / HW.chunkLen);
  const need = new Set();
  for(let ci = ciNow - 9; ci <= ciNow + 2; ci++) need.add(ci);
  for(const ci of need) if(!hwChunks.has(ci)) buildChunk(ci);
  for(const [ci, g] of hwChunks) if(!need.has(ci)){
    hwGroup.remove(g);
    g.traverse(o=>{ if(o.geometry) o.geometry.dispose(); });
    hwChunks.delete(ci);
  }
}

/* --- NPC-liikenne --- */
const NPC_BODY = ['#c9564a','#5a7fbe','#d8b45a','#7fae6e','#b48ac9','#e9e2f5','#46527a']
  .map(c => new THREE.MeshLambertMaterial({color:c, flatShading:true}));
const npcWinMat   = new THREE.MeshLambertMaterial({color:'#171330'});
const npcWheelMat = new THREE.MeshLambertMaterial({color:'#12102a'});
const npcTailMat  = new THREE.MeshBasicMaterial({color:'#ff5a4a'});
const npcBoxMat   = new THREE.MeshLambertMaterial({color:'#cfc9e0', flatShading:true});
function buildCarMesh(){
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.55, 4.3), NPC_BODY[Math.floor(Math.random()*NPC_BODY.length)]);
  body.position.y = 0.55; g.add(body);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 2.0), npcWinMat);
  cab.position.set(0, 1.02, 0.2); g.add(cab);
  for(const [x,z] of [[-0.85,-1.4],[0.85,-1.4],[-0.85,1.4],[0.85,1.4]]){
    const w = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.55, 0.72), npcWheelMat);
    w.position.set(x, 0.28, z); g.add(w);
  }
  for(const x of [-0.6, 0.6]){
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.06), npcTailMat);
    t.position.set(x, 0.72, 2.16); g.add(t);
  }
  return g;
}
function buildTruckMesh(){
  const g = new THREE.Group();
  const cab = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.6, 2.2), NPC_BODY[Math.floor(Math.random()*NPC_BODY.length)]);
  cab.position.set(0, 1.15, -3.4); g.add(cab);
  const win = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.55, 0.1), npcWinMat);
  win.position.set(0, 1.55, -4.45); g.add(win);
  const box = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.2, 6.6), npcBoxMat);
  box.position.set(0, 1.45, 1.2); g.add(box);
  for(const z of [-3.6, 0.4, 2.6]) for(const x of [-0.95, 0.95]){
    const w = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.75, 0.85), npcWheelMat);
    w.position.set(x, 0.38, z); g.add(w);
  }
  for(const x of [-0.75, 0.75]){
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.06), npcTailMat);
    t.position.set(x, 0.9, 4.52); g.add(t);
  }
  return g;
}
const npcs = [];
function createNpc(){
  const root = new THREE.Group();
  const carG = buildCarMesh(), truckG = buildTruckMesh();
  root.add(carG); root.add(truckG);
  hwGroup.add(root);
  return { root, carG, truckG, truck:false, lane:0, laneF:0, laneChange:null,
    z:0, speed:0, target:0, kx:0, kxv:0, yawOff:0, blocked:0, nmArmed:true, state:'drive' };
}
function ensureNpcs(){ while(npcs.length < 16) npcs.push(createNpc()); }
function laneClearFor(n, lane, margin){
  for(const m of npcs){
    if(m === n) continue;
    if(Math.abs(m.laneF - lane) < 0.7 && Math.abs(m.z - n.z) < margin) return false;
  }
  const pLaneF = hwPlayerLat/HW.laneW + 1.5;
  if(Math.abs(pLaneF - lane) < 0.8 && Math.abs(rig.position.z - n.z) < margin) return false;
  return true;
}
function spawnNpc(n, scatter){
  const pz = rig.position.z;
  n.truck = Math.random() < 0.22;
  n.carG.visible = !n.truck; n.truckG.visible = n.truck;
  for(let tries = 0; tries < 24; tries++){
    n.lane = Math.floor(Math.random()*4);
    n.z = scatter ? pz + 70 - Math.random()*650 : pz - (170 + Math.random()*470);
    if(Math.abs(n.z - pz) > 28 && laneClearFor(n, n.lane, 36)) break;
  }
  n.laneF = n.lane; n.laneChange = null;
  const laneBase = [22.8, 26.4, 29.8, 33.2][n.lane];
  n.target = n.truck ? rng(20.8, 24) : laneBase + rng(-1.5, 1.5);
  n.speed = n.target;
  n.kx = 0; n.kxv = 0; n.yawOff = 0; n.blocked = 0; n.nmArmed = false; n.state = 'drive';
}
function updateNpcs(dt){
  const pz = rig.position.z;
  const pLaneF = hwPlayerLat/HW.laneW + 1.5;
  const kmh = Math.abs(car.vx)*3.6;
  for(const n of npcs){
    if(n.state === 'crashed'){
      n.speed = Math.max(0, n.speed - 7*dt);
    } else {
      /* etsi este edestä (NPC tai pelaaja) */
      let aheadD = 1e9, aheadSpd = 0;
      for(const m of npcs){
        if(m === n || Math.abs(m.laneF - n.laneF) > 0.6 || m.z >= n.z) continue;
        const d = n.z - m.z;
        if(d < aheadD){ aheadD = d; aheadSpd = m.speed; }
      }
      if(Math.abs(pLaneF - n.laneF) < 0.75 && pz < n.z){
        const d = n.z - pz;
        if(d < aheadD){ aheadD = d; aheadSpd = Math.max(0, car.vx); }
      }
      const safe = 10 + n.speed*1.15;
      if(aheadD < safe){
        n.speed -= Math.min(6.5, (safe - aheadD)*0.6) * dt * 3;
        n.blocked += dt;
        if(n.blocked > 2.2 && n.laneChange === null){
          for(const cand of [n.lane-1, n.lane+1]){
            if(cand < 0 || cand > 3) continue;
            if(laneClearFor(n, cand, 30)){ n.laneChange = cand; break; }
          }
        }
      } else {
        n.blocked = 0;
        n.speed += (n.target - n.speed) * Math.min(1, 0.6*dt);
      }
      if(n.laneChange !== null){
        const d = n.laneChange - n.laneF;
        n.laneF += Math.sign(d) * Math.min(Math.abs(d), 0.55*dt);
        if(Math.abs(d) < 0.03){ n.lane = n.laneChange; n.laneF = n.lane; n.laneChange = null; }
      }
      n.speed = Math.max(0, n.speed);
      n.yawOff *= Math.max(0, 1 - 2.2*dt);
    }
    n.z -= n.speed * dt;
    n.kx += n.kxv * dt; n.kxv *= Math.max(0, 1 - 3*dt); n.kx *= Math.max(0, 1 - 1.2*dt);
    const th = hwYaw(n.z), rx = Math.cos(th), rz = -Math.sin(th);
    const off = (n.laneF - 1.5) * HW.laneW + n.kx;
    n.root.position.set(hwCenterX(n.z) + rx*off, 0, n.z + rz*off);
    const steerVis = (n.laneChange !== null) ? Math.sign(n.laneChange - n.laneF)*-0.12 : 0;
    n.root.rotation.y = th + n.yawOff + steerVis;
    /* kierrätys */
    if(n.z > pz + 140 || n.z < pz - 680) spawnNpc(n, false);
    /* lähiohitus */
    const dz2 = Math.abs(n.z - pz);
    if(dz2 > 30) n.nmArmed = true;
    else if(dz2 < 4.2 && n.nmArmed && !crashed && n.state === 'drive'){
      const gap = Math.abs(n.root.position.x - rig.position.x);
      if(gap > 1.6 && gap < 2.8 && kmh > 90 && car.vx > n.speed + 2){
        n.nmArmed = false; hwScore += 100; showNotice('LÄHIOHITUS +100');
      }
    }
  }
}

/* --- törmäysfysiikka (OBB + impulssi + pyörähdys) --- */
function obbData(cx, cz, yaw, hw, hl){
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
  const rx =  Math.cos(yaw), rz = -Math.sin(yaw);
  const corners = [];
  for(const [sr, sf] of [[-1,-1],[1,-1],[1,1],[-1,1]])
    corners.push([cx + rx*hw*sr + fx*hl*sf, cz + rz*hw*sr + fz*hl*sf]);
  return { corners, axes: [[rx,rz],[fx,fz]] };
}
function satMTV(A, B, fromBx, fromBz){
  let best = null;
  for(const [ax, az] of A.axes.concat(B.axes)){
    let minA=1e9, maxA=-1e9, minB=1e9, maxB=-1e9;
    for(const [x,z] of A.corners){ const p = x*ax + z*az; if(p<minA)minA=p; if(p>maxA)maxA=p; }
    for(const [x,z] of B.corners){ const p = x*ax + z*az; if(p<minB)minB=p; if(p>maxB)maxB=p; }
    const ov = Math.min(maxA, maxB) - Math.max(minA, minB);
    if(ov <= 0) return null;
    if(!best || ov < best.depth){
      let nx = ax, nz = az;
      if(nx*fromBx + nz*fromBz < 0){ nx = -nx; nz = -nz; }   // normaali B→A
      best = { nx, nz, depth: ov };
    }
  }
  return best;
}
function bigCrash(){
  crashed = true; crashT = 2.6;
  showNotice('KOLARI!');
  crashSound(1);
}
function handleCollisions(){
  const px = rig.position.x, pz = rig.position.z;
  const A = obbData(px, pz, car.yaw, 0.86, 2.15);
  headingVectors(car.yaw);
  let vPx = _f.x*car.vx + _r.x*car.vLat;
  let vPz = _f.z*car.vx + _r.z*car.vLat;
  for(const n of npcs){
    if(Math.abs(n.z - pz) > (n.truck ? 12 : 8)) continue;
    const nx0 = n.root.position.x, nz0 = n.root.position.z, yawN = n.root.rotation.y;
    const B = obbData(nx0, nz0, yawN, n.truck ? 1.12 : 0.92, n.truck ? 5.0 : 2.25);
    const mtv = satMTV(A, B, px - nx0, pz - nz0);
    if(!mtv) continue;
    /* erottelu */
    rig.position.x += mtv.nx * mtv.depth * 0.6;
    rig.position.z += mtv.nz * mtv.depth * 0.6;
    const thN = hwYaw(n.z), rxN = Math.cos(thN), rzN = -Math.sin(thN);
    n.kx  -= (mtv.nx*rxN + mtv.nz*rzN) * mtv.depth * 0.4;
    /* nopeudet */
    const fNx = -Math.sin(yawN), fNz = -Math.cos(yawN);
    const vNx = fNx*n.speed + rxN*n.kxv, vNz = fNz*n.speed + rzN*n.kxv;
    const vrx = vPx - vNx, vrz = vPz - vNz;
    const vn = vrx*mtv.nx + vrz*mtv.nz;
    if(vn >= 0) continue;
    const mA = CFG.mass, mB = n.truck ? 5200 : 1350, e = 0.3;
    const j = -(1+e)*vn / (1/mA + 1/mB);
    const JAx = mtv.nx * j/mA, JAz = mtv.nz * j/mA;
    vPx += JAx; vPz += JAz;
    const vNx2 = vNx - mtv.nx * j/mB, vNz2 = vNz - mtv.nz * j/mB;
    car.vx  = vPx*_f.x + vPz*_f.z;
    car.vLat = vPx*_r.x + vPz*_r.z;
    /* pyörähdysmomentti kontaktipisteestä */
    const cxp = (px + nx0)/2 - px, czp = (pz + nz0)/2 - pz;
    const lx = cxp*_r.x + czp*_r.z, lz = cxp*_f.x + czp*_f.z;
    const jf = JAx*_f.x + JAz*_f.z, jr = JAx*_r.x + JAz*_r.z;
    car.yawRate += (lx*jf*(-1) + lz*jr) * 0.85;
    /* NPC:n reaktio */
    n.speed = Math.max(0, vNx2*fNx + vNz2*fNz);
    n.kxv  += (vNx2 - vNx)*rxN + (vNz2 - vNz)*rzN;
    const sev = -vn;
    if(sev > 8){ n.state = 'crashed'; n.yawOff += rng(-0.45, 0.45); }
    if(sev > 12){ if(!crashed) bigCrash(); }
    else { hwScore = Math.max(0, hwScore - 50); if(!crashed) showNotice('KOLHU −50'); crashSound(Math.min(0.6, sev/15)); }
  }
}

/* --- moodinhallinta & päivitys --- */
function startHighwayRun(){
  gameMode = 'highway';
  while(trackGroup.children.length){
    const c = trackGroup.children.pop();
    if(c.geometry) c.geometry.dispose();
  }
  skyMat.uniforms.top.value.set('#1c1a44');
  skyMat.uniforms.mid.value.set('#6a3d6e');
  skyMat.uniforms.bot.value.set('#ff8f5a');
  scene.fog.color.setHex(0xee8560);
  ground.material.color.set('#3d4a3c');
  sun.material.color.set('#ffd27d');
  hwGroup.visible = true;
  mmPlane.visible = false;
  ensureNpcs();
  resetHighwayRun();
}
function resetHighwayRun(){
  crashed = false; crashT = 0;
  hwScore = 0; hwDist = 0;
  rig.position.set(hwCenterX(0) + (1 - 1.5)*HW.laneW, 0, 0);
  car.yaw = hwYaw(0); rig.rotation.y = car.yaw;
  car.vx = 0; car.vLat = 0; car.yawRate = 0; car.steer = 0;
  hwPrevZ = 0; hwPlayerLat = (1 - 1.5)*HW.laneW; lapArmed = false;
  manageChunks();
  for(const n of npcs) spawnNpc(n, true);
}
function updateHighway(dt){
  const px = rig.position.x, pz = rig.position.z;
  sky.position.set(px, 0, pz);
  sun.position.set(px + 500, 240, pz - 2600);
  ground.position.x = px; ground.position.z = pz;
  manageChunks();
  updateNpcs(dt);
  handleCollisions();
  if(!crashed){
    const moved = hwPrevZ - pz;
    if(moved > 0) hwDist += moved;
    const kmh = Math.abs(car.vx)*3.6;
    if(kmh > 100) hwScore += (kmh - 100) * dt;
  } else {
    crashT -= dt;
    if(crashT <= 0){
      hwBest = Math.max(hwBest, hwScore);
      openMenu('results');
    }
  }
  hwPrevZ = pz;
}
function drawHUDHW(){
  const g = hudCtx; g.clearRect(0,0,512,224);
  g.shadowColor='#ffb84d'; g.shadowBlur=12;
  g.fillStyle='#ffd98f'; g.textBaseline='middle';
  g.font='800 68px -apple-system, sans-serif'; g.textAlign='center';
  g.fillText(String(Math.round(hwScore)), 256, 62);
  g.font='600 36px -apple-system, sans-serif';
  g.textAlign='left';  g.fillText('MATKA ' + (hwDist/1000).toFixed(2) + ' km', 16, 160);
  g.textAlign='right'; g.fillText('PARAS ' + Math.round(hwBest), 496, 160);
  g.shadowBlur=0; g.textAlign='left';
  hudTex.needsUpdate = true;
}

/* ============ radat ============ */
const TRACKS = [
  { name:'Rannikko', desc:'nopea & virtaava', scale:1.7,
    palette:{ top:'#2b2a55', mid:'#83446b', bot:'#ff9a5a', fog:0xff9a5a,
      ground:'#8a5a45', prop:'#2f5d4a', trunk:'#5a4030', rock:'#7a5a52',
      sun:'#ffd27d', sunPos:[600,240,-2600] },
    pts:[[0,0],[120,-30],[220,-20],[300,40],[330,140],[280,230],[180,260],[80,300],
         [-30,330],[-140,290],[-200,200],[-260,120],[-240,20],[-160,-40],[-80,-40]] },
  { name:'Serpentiini', desc:'tekninen vuoristo', scale:1.45,
    palette:{ top:'#241f4d', mid:'#5b3a70', bot:'#c96a6a', fog:0xc96a6a,
      ground:'#4a3b56', prop:'#5e5273', trunk:'#3c3350', rock:'#6a5c80',
      sun:'#ffb0a0', sunPos:[-800,200,-2400] },
    pts:[[0,0],[150,-10],[210,60],[150,130],[40,140],[-20,210],[60,280],[180,290],
         [250,360],[180,430],[40,440],[-80,420],[-150,340],[-120,250],[-200,180],
         [-230,80],[-160,10],[-80,-20]] },
  { name:'Hämärä', desc:'metsä, iltahämy', scale:1.6,
    palette:{ top:'#101c36', mid:'#2d4a62', bot:'#e08a54', fog:0x2d4a62,
      ground:'#22392f', prop:'#173026', trunk:'#2c2318', rock:'#33475a',
      sun:'#ffc98a', sunPos:[200,180,-2700] },
    pts:[[0,0],[200,0],[300,60],[310,170],[220,220],[240,320],[160,380],[20,370],
         [-60,300],[-40,200],[-140,170],[-220,220],[-300,160],[-290,50],[-200,-10],[-100,-30]] },
];
const MENU_TRACKS = TRACKS.concat([{ name:'Moottoritie', desc:'loputon liikenne' }]);
let selectedTrack = 0;

const ROAD_HALF = 5.5, GRASS_HALF = 12.5;
const trackGroup = new THREE.Group(); scene.add(trackGroup);
let TD = null;  // { samples:[{p,t,r}], N }

function buildTrack(idx){
  const T = TRACKS[idx], P = T.palette;
  /* siivoa vanha */
  while(trackGroup.children.length){
    const c = trackGroup.children.pop();
    if(c.geometry) c.geometry.dispose();
  }
  /* paletti */
  skyMat.uniforms.top.value.set(P.top);
  skyMat.uniforms.mid.value.set(P.mid);
  skyMat.uniforms.bot.value.set(P.bot);
  scene.fog.color.setHex(P.fog);
  ground.material.color.set(P.ground);
  sun.material.color.set(P.sun);
  sun.position.set(P.sunPos[0], P.sunPos[1], P.sunPos[2]);

  /* keskilinja */
  const pts = T.pts.map(([x,z]) => new THREE.Vector3(x*T.scale, 0, z*T.scale));
  const curve = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.5);
  const N = 1000;
  const raw = curve.getSpacedPoints(N); raw.pop();  // viimeinen == ensimmäinen
  const samples = [];
  const up = new THREE.Vector3(0,1,0);
  for(let i=0;i<N;i++){
    const p = raw[i];
    const t = raw[(i+1)%N].clone().sub(raw[(i-1+N)%N]).normalize();
    const r = new THREE.Vector3().crossVectors(t, up).normalize().negate(); // oikea
    samples.push({p, t, r});
  }
  TD = { samples, N };

  /* yhtenäinen asfaltti */
  const pos = [], idxs = [];
  for(let i=0;i<=N;i++){
    const s0 = samples[i%N];
    pos.push(s0.p.x - s0.r.x*ROAD_HALF, 0, s0.p.z - s0.r.z*ROAD_HALF);
    pos.push(s0.p.x + s0.r.x*ROAD_HALF, 0, s0.p.z + s0.r.z*ROAD_HALF);
    if(i<N){ const v=i*2; idxs.push(v,v+2,v+1, v+1,v+2,v+3); }
  }
  const roadGeo = new THREE.BufferGeometry();
  roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos,3));
  roadGeo.setIndex(idxs); roadGeo.computeVertexNormals();
  trackGroup.add(new THREE.Mesh(roadGeo,
    new THREE.MeshLambertMaterial({color:'#2e2b40', side:THREE.DoubleSide})));

  /* reunaviivat + keskikatkoviiva */
  function stripe(offset, width, color, dash){
    const sPos = [], sIdx = []; let vi = 0;
    for(let i=0;i<N;i++){
      if(dash && (i % 20) >= 10) continue;
      const a = samples[i], b = samples[(i+1)%N];
      for(const s0 of [a,b]){
        sPos.push(s0.p.x + s0.r.x*(offset-width), 0.02, s0.p.z + s0.r.z*(offset-width));
        sPos.push(s0.p.x + s0.r.x*(offset+width), 0.02, s0.p.z + s0.r.z*(offset+width));
      }
      sIdx.push(vi, vi+2, vi+1, vi+1, vi+2, vi+3); vi += 4;
    }
    const g2 = new THREE.BufferGeometry();
    g2.setAttribute('position', new THREE.Float32BufferAttribute(sPos,3));
    g2.setIndex(sIdx); g2.computeVertexNormals();
    trackGroup.add(new THREE.Mesh(g2,
      new THREE.MeshBasicMaterial({color, side:THREE.DoubleSide})));
  }
  stripe(-(ROAD_HALF-0.35), 0.14, '#e9e2f5', false);
  stripe( (ROAD_HALF-0.35), 0.14, '#e9e2f5', false);
  stripe(0, 0.1, '#ffcf6b', true);

  /* lähtöportti */
  const s0 = samples[0];
  const gateTex = (function(){
    const c = document.createElement('canvas'); c.width=128; c.height=32;
    const g = c.getContext('2d');
    for(let x=0;x<8;x++) for(let y=0;y<2;y++){
      g.fillStyle = (x+y)%2 ? '#111' : '#eee'; g.fillRect(x*16, y*16, 16, 16);
    }
    return new THREE.CanvasTexture(c);
  })();
  for(const sgn of [-1,1]){
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18,0.18,7,8),
      new THREE.MeshLambertMaterial({color:'#e9e2f5'}));
    pole.position.set(s0.p.x + s0.r.x*sgn*(ROAD_HALF+1), 3.5, s0.p.z + s0.r.z*sgn*(ROAD_HALF+1));
    trackGroup.add(pole);
  }
  const banner = new THREE.Mesh(new THREE.PlaneGeometry((ROAD_HALF+1)*2, 1.4),
    new THREE.MeshBasicMaterial({map:gateTex, side:THREE.DoubleSide}));
  banner.position.set(s0.p.x, 6.2, s0.p.z);
  banner.lookAt(s0.p.x + s0.t.x, 6.2, s0.p.z + s0.t.z);
  trackGroup.add(banner);

  /* maisema: puut/kivet radan varrelle + kaukovuoret */
  const propMat  = new THREE.MeshLambertMaterial({color:P.prop, flatShading:true});
  const trunkMat = new THREE.MeshLambertMaterial({color:P.trunk, flatShading:true});
  const rockMat  = new THREE.MeshLambertMaterial({color:P.rock, flatShading:true});
  for(let i=0;i<N;i+=7){
    const s1 = samples[i], side = Math.random()<0.5 ? -1 : 1;
    const d = GRASS_HALF + 6 + rng(0,55);
    const x = s1.p.x + s1.r.x*side*d, z = s1.p.z + s1.r.z*side*d;
    if(Math.random() < 0.75){
      const h = rng(4,9);
      const crown = new THREE.Mesh(new THREE.ConeGeometry(rng(1.4,2.6), h, 6), propMat);
      crown.position.set(x, h*0.5+1.4, z); trackGroup.add(crown);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22,0.3,1.6,6), trunkMat);
      trunk.position.set(x, 0.8, z); trackGroup.add(trunk);
    } else {
      const r0 = rng(1,3.2);
      const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(r0,0), rockMat);
      rock.position.set(x, r0*0.4, z);
      rock.rotation.set(rng(0,3), rng(0,3), rng(0,3));
      trackGroup.add(rock);
    }
  }
  /* radan keskipiste kaukovuorille */
  let cx=0, cz=0;
  for(const s1 of samples){ cx += s1.p.x; cz += s1.p.z; }
  cx/=N; cz/=N;
  for(let i=0;i<22;i++){
    const a = i/22*Math.PI*2, d = rng(1100,1500);
    const h = rng(90,260), r0 = rng(90,220);
    const m = new THREE.Mesh(new THREE.ConeGeometry(r0, h, 5), rockMat);
    m.position.set(cx+Math.cos(a)*d, h*0.4, cz+Math.sin(a)*d);
    trackGroup.add(m);
  }
  sky.position.set(cx, 0, cz);
  drawMinimapBase(samples);
}

/* ============ ajofysiikka ============ */
const car = { yaw:0, vx:0, vLat:0, yawRate:0, steer:0, lastIdx:0 };
let steerSens = 0.7;   // ohjausherkkyys 0.3–1.3, säädettävissä taukovalikosta
const CFG = {
  mass:1150, wheelbase:2.6, power:6800, brake:11000,
  aero:0.42, roll:16, gripLatK:9, gripLatMax:13, yawFollow:7.5
};
const _f = new THREE.Vector3(), _r = new THREE.Vector3(), _vW = new THREE.Vector3();
let onTrack = true, trackIdxS = 0;

function headingVectors(yaw){
  _f.set(-Math.sin(yaw), 0, -Math.cos(yaw));
  _r.set( Math.cos(yaw), 0, -Math.sin(yaw));
}
function closestSample(){
  const S = TD.samples, N = TD.N;
  let best = car.lastIdx, bd = Infinity;
  for(let k=-60;k<=60;k++){
    const i = (car.lastIdx + k + N) % N;
    const dx = rig.position.x - S[i].p.x, dz = rig.position.z - S[i].p.z;
    const d = dx*dx + dz*dz;
    if(d < bd){ bd = d; best = i; }
  }
  car.lastIdx = best;
  return best;
}
function stepCar(dt, steerIn, thr, brk, rev){
  const grip = onTrack ? 1.0 : 0.42;
  /* nopeusherkkä ohjaus */
  const maxSteer = 0.52 / (1 + Math.max(0,car.vx)*0.03);
  car.steer += (steerIn*steerSens*maxSteer - car.steer) * Math.min(1, 12*dt);

  /* pituusvoimat: R2 kaasu, L2 jarru (molempiin suuntiin), ○ pakki */
  let F = thr * CFG.power * grip;
  if(Math.abs(car.vx) > 0.3) F -= brk * CFG.brake * Math.sign(car.vx);
  if(rev){
    if(car.vx > 0.5) F -= CFG.brake;      // rullaa ensin pysähdyksiin
    else F -= 2800;                        // peruutusvoima
  }
  F -= CFG.aero*car.vx*Math.abs(car.vx) + CFG.roll*car.vx;
  if(!onTrack) F -= 1500*Math.sign(car.vx);
  car.vx += F/CFG.mass*dt;
  if(car.vx < -8) car.vx = -8;

  /* kääntyminen: kinemaattinen tavoite + pidon mukainen seuranta */
  const tgtYR = -car.steer * car.vx / CFG.wheelbase;
  car.yawRate += (tgtYR - car.yawRate) * Math.min(1, CFG.yawFollow*grip*dt);

  /* nopeusvektori maailmassa ennen suunnan muutosta */
  headingVectors(car.yaw);
  _vW.copy(_f).multiplyScalar(car.vx).addScaledVector(_r, car.vLat);

  car.yaw += car.yawRate*dt;
  headingVectors(car.yaw);
  car.vx  = _vW.dot(_f);
  car.vLat = _vW.dot(_r);

  /* sivuttaispito: pieni liuku palautuu nopeasti, iso jää liu'uksi */
  const latDec = Math.min(Math.abs(car.vLat)*CFG.gripLatK*grip, CFG.gripLatMax*grip);
  car.vLat -= Math.sign(car.vLat) * latDec * dt;

  /* liike */
  _vW.copy(_f).multiplyScalar(car.vx).addScaledVector(_r, car.vLat);
  rig.position.addScaledVector(_vW, dt);
  rig.rotation.y = car.yaw;

  /* rata-avaruus: pito & kaide */
  if(gameMode === 'highway'){
    const z = rig.position.z;
    const th = hwYaw(z), rx = Math.cos(th);
    const lat = (rig.position.x - hwCenterX(z)) * rx;
    hwPlayerLat = lat;
    onTrack = Math.abs(lat) < HW.halfRoad;
    if(Math.abs(lat) > HW.barrier){
      const over = Math.abs(lat) - HW.barrier;
      rig.position.x -= Math.sign(lat) * over * rx;
      const vr = _vW.x*rx;
      if(Math.sign(vr) === Math.sign(lat)){
        car.vLat *= 0.15; car.vx *= 0.985;
      }
    }
  } else {
    const i0 = closestSample();
    const s0 = TD.samples[i0];
    const lat = (rig.position.x - s0.p.x)*s0.r.x + (rig.position.z - s0.p.z)*s0.r.z;
    onTrack = Math.abs(lat) < ROAD_HALF + 0.6;
    trackIdxS = i0 / TD.N;
    if(Math.abs(lat) > GRASS_HALF){
      const over = Math.abs(lat) - GRASS_HALF;
      rig.position.x -= s0.r.x * Math.sign(lat) * over;
      rig.position.z -= s0.r.z * Math.sign(lat) * over;
      const vr = _vW.x*s0.r.x + _vW.z*s0.r.z;   // ulospäin suuntautuva nopeus
      if(Math.sign(vr) === Math.sign(lat)){
        car.vLat *= 0.2; car.vx *= 0.96;
      }
    }
  }
  /* ratti */
  wheelGroup.rotation.z = -car.steer * 4.5;
}

/* ============ kierrosajanotto ============ */
let lapArmed = false, lapStart = 0, lastLap = null, bestLap = null;
let prevS = 0, cp1 = false, cp2 = false;
function updateTiming(){
  const s = trackIdxS;
  if(s > 0.3 && s < 0.4) cp1 = true;
  if(s > 0.6 && s < 0.7) cp2 = true;
  if(prevS > 0.9 && s < 0.1){          // maaliviivan ylitys
    const now = performance.now();
    if(lapArmed && cp1 && cp2){
      const lap = now - lapStart;
      lastLap = lap;
      if(bestLap === null || lap < bestLap){ bestLap = lap; showNotice('PARAS  ' + fmt(lap)); }
      else showNotice(fmt(lap));
    }
    lapStart = now; lapArmed = true; cp1 = cp2 = false;
  }
  prevS = s;
}

/* ============ moottoriääni ============ */
let actx = null, engOsc1 = null, engOsc2 = null, engGain = null, soundOn = true;
function initAudio(){
  if(actx) return;
  try{
    actx = new (window.AudioContext||window.webkitAudioContext)();
    engOsc1 = actx.createOscillator(); engOsc1.type='sawtooth';
    engOsc2 = actx.createOscillator(); engOsc2.type='sawtooth'; engOsc2.detune.value = 12;
    const lp = actx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value = 750;
    engGain = actx.createGain(); engGain.gain.value = 0;
    engOsc1.connect(lp); engOsc2.connect(lp); lp.connect(engGain); engGain.connect(actx.destination);
    engOsc1.start(); engOsc2.start();
  }catch(e){}
}
function updateAudio(thr){
  if(!actx || !engGain) return;
  const kmh = Math.abs(car.vx)*3.6;
  const rpmT = (kmh % 46) / 46;
  const f = 52 + rpmT*88 + kmh*0.22;
  engOsc1.frequency.value = f; engOsc2.frequency.value = f*0.5;
  const vol = soundOn ? (0.015 + 0.05*thr + Math.min(0.02, kmh*0.0004)) : 0;
  engGain.gain.value += (vol - engGain.gain.value)*0.1;
}
let noiseBuf = null;
function crashSound(v){
  if(!actx || !soundOn) return;
  try{
    if(!noiseBuf){
      noiseBuf = actx.createBuffer(1, actx.sampleRate*0.35, actx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for(let i=0;i<d.length;i++) d[i] = (Math.random()*2-1) * (1 - i/d.length);
    }
    const t = actx.currentTime;
    const src = actx.createBufferSource(); src.buffer = noiseBuf;
    const lp = actx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value = 500 + v*900;
    const g = actx.createGain();
    g.gain.setValueAtTime(0.25*v, t);
    g.gain.exponentialRampToValueAtTime(0.001, t+0.35);
    src.connect(lp).connect(g).connect(actx.destination); src.start(t);
    const o = actx.createOscillator(); o.type='sine'; o.frequency.setValueAtTime(70, t);
    o.frequency.exponentialRampToValueAtTime(35, t+0.25);
    const g2 = actx.createGain();
    g2.gain.setValueAtTime(0.3*v, t);
    g2.gain.exponentialRampToValueAtTime(0.001, t+0.3);
    o.connect(g2).connect(actx.destination); o.start(t); o.stop(t+0.32);
  }catch(e){}
}

/* ============ deviceorientation → pään kvaternio ============ */
const zee = new THREE.Vector3(0,0,1);
const eul = new THREE.Euler();
const q0 = new THREE.Quaternion();
const qScreen = new THREE.Quaternion();
const qFix = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));
const deviceQ = new THREE.Quaternion();
const calQ = new THREE.Quaternion();
let haveOrientation = false;
window.addEventListener('deviceorientation', (e)=>{
  if(e.alpha===null) return;
  haveOrientation = true;
  const a = THREE.MathUtils.degToRad(e.alpha||0);
  const b = THREE.MathUtils.degToRad(e.beta ||0);
  const g = THREE.MathUtils.degToRad(e.gamma||0);
  const o = THREE.MathUtils.degToRad(screenAngle());
  eul.set(b, a, -g, 'YXZ');
  q0.setFromEuler(eul);
  q0.multiply(qFix);
  q0.multiply(qScreen.setFromAxisAngle(zee, -o));
  deviceQ.copy(q0);
}, true);
function screenAngle(){
  if(screen.orientation && typeof screen.orientation.angle === 'number') return screen.orientation.angle;
  return window.orientation || 0;
}
function recenter(){
  const f = new THREE.Vector3(0,0,-1).applyQuaternion(deviceQ);
  f.y = 0;
  if(f.lengthSq() < 1e-6) return;
  f.normalize();
  const heading = Math.atan2(f.x, -f.z);
  calQ.setFromAxisAngle(new THREE.Vector3(0,1,0), -heading);
}

/* mono-katselu */
let monoYaw = 0, monoPitch = 0, dragging = false, lastX = 0, lastY = 0;
canvas.addEventListener('pointerdown', e=>{ dragging=true; lastX=e.clientX; lastY=e.clientY; });
window.addEventListener('pointermove', e=>{
  if(!dragging || mode!=='mono') return;
  monoYaw   -= (e.clientX-lastX)*0.004;
  monoPitch -= (e.clientY-lastY)*0.004;
  monoPitch = Math.max(-1.2, Math.min(1.2, monoPitch));
  lastX=e.clientX; lastY=e.clientY;
});
window.addEventListener('pointerup', ()=>dragging=false);

/* ============ verkkoratti (PC-silta WebRTC:llä) ============ */
const ICE_CONFIG = { iceServers: [ { urls: 'stun:stun.l.google.com:19302' } ] };
const netWheel = { s:0, t:0, b:0, ts:0 };
let wheelPeer = null, wheelConn = null;
const wheelStatusEl = document.getElementById('wheelStatus');
const wheelLogEl = document.getElementById('wheelLog');
function wlog(msg){
  wheelLogEl.style.display = 'block';
  const t = new Date();
  const ts = String(t.getMinutes()).padStart(2,'0')+':'+String(t.getSeconds()).padStart(2,'0');
  wheelLogEl.textContent += '['+ts+'] '+msg+'\n';
  wheelLogEl.scrollTop = wheelLogEl.scrollHeight;
}
function watchIcePhone(c){
  const t = setInterval(()=>{
    const pc = c.peerConnection;
    if(!pc) return;
    clearInterval(t);
    wlog('pc — gathering:'+pc.iceGatheringState+' ice:'+pc.iceConnectionState+' sig:'+pc.signalingState);
    pc.onicegatheringstatechange = ()=>wlog('gathering: '+pc.iceGatheringState);
    pc.onicecandidate = e=>{
      if(e.candidate){
        const m = / typ (\w+)/.exec(e.candidate.candidate || '');
        wlog('kandidaatti: ' + (m ? m[1] : '?'));
      } else wlog('kandidaatit valmiit');
    };
    pc.oniceconnectionstatechange = ()=>wlog('ICE: '+pc.iceConnectionState);
  }, 20);
}
function startWheelLink(){
  if(!window.Peer){ wheelStatusEl.textContent = 'PeerJS ei latautunut — tarkista verkko'; return; }
  if(wheelPeer) return;
  keepAwake();                                   // näyttö auki parituksen ajan
  const code = String(Math.floor(1000 + Math.random()*9000));
  wheelStatusEl.textContent = 'Rekisteröidytään välityspalveluun…';
  wlog('luodaan peer…');
  wheelPeer = new Peer('kaarre-' + code, { config: ICE_CONFIG });
  wheelPeer.on('open', ()=>{
    wlog('rekisteröity ✓ koodi ' + code);
    wheelStatusEl.textContent = 'Rattikoodi: ' + code + ' — pidä tämä sivu auki, syötä koodi PC:llä';
  });
  wheelPeer.on('disconnected', ()=>{
    wlog('välityspalveluyhteys katkesi — reconnect');
    wheelStatusEl.textContent = 'Yhteys välityspalveluun katkesi — yhdistetään uudelleen…';
    try{ wheelPeer.reconnect(); }catch(e){}
  });
  wheelPeer.on('connection', c=>{
    wheelConn = c;
    wlog('silta löytyi — neuvotellaan…');
    wheelStatusEl.textContent = 'Silta löytyi — muodostetaan suoraa yhteyttä…';
    watchIcePhone(c);
    c.on('open', ()=>{
      wlog('DATAKANAVA AUKI ✓');
      wheelStatusEl.textContent = 'Ratti yhdistetty ✓'; wheelStatusEl.classList.add('ok');
      if(running) showNotice('Ratti käytössä');
    });
    c.on('data', d=>{
      if(d && typeof d.s === 'number'){
        netWheel.s = d.s; netWheel.t = d.t || 0; netWheel.b = d.b || 0;
        netWheel.ts = performance.now();
      }
    });
    c.on('error', err=>{ wlog('YHTEYSVIRHE: ' + (err.type||'') + ' ' + (err.message||err)); });
    c.on('close', ()=>{
      wlog('datakanava sulkeutui');
      wheelConn = null; netWheel.ts = 0;
      wheelStatusEl.textContent = 'Rattiyhteys katkesi — napauta yhdistääksesi uudelleen';
      wheelStatusEl.classList.remove('ok');
      wheelPeer.destroy(); wheelPeer = null;
    });
  });
  wheelPeer.on('error', err=>{
    wlog('VIRHE: ' + err.type + (err.message ? ' — ' + err.message : ''));
    if(err.type === 'unavailable-id'){ wheelPeer.destroy(); wheelPeer = null; startWheelLink(); }
    else if(err.type === 'network'){ wheelStatusEl.textContent = 'Verkkovirhe välityspalveluun — tarkista WiFi'; }
    else wheelStatusEl.textContent = 'Rattivirhe: ' + err.type;
  });
}
wheelStatusEl.addEventListener('click', startWheelLink);
document.addEventListener('visibilitychange', ()=>{
  if(document.visibilityState==='visible' && wheelPeer && wheelPeer.disconnected && !wheelPeer.destroyed){
    try{ wheelPeer.reconnect(); }catch(e){}
  }
});

/* ============ gamepad ============ */
const padStatusEl = document.getElementById('padStatus');
let padIndex = -1, padWasOk = false;
window.addEventListener('gamepadconnected', e=>{ padIndex = e.gamepad.index; updatePadStatus(e.gamepad); });
window.addEventListener('gamepaddisconnected', ()=>{ padIndex = -1; updatePadStatus(null); });
function updatePadStatus(p){
  if(p){ padStatusEl.textContent = 'Ohjain yhdistetty ✓ ' + p.id.slice(0,34); padStatusEl.classList.add('ok'); }
  else { padStatusEl.textContent = 'Ohjain: paina mitä tahansa nappia herättääksesi…'; padStatusEl.classList.remove('ok'); }
}
function getPad(){
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  if(padIndex>=0 && pads[padIndex]) return pads[padIndex];
  for(const p of pads){ if(p){ padIndex=p.index; return p; } }
  return null;
}
const dz = v => Math.abs(v)<0.1 ? 0 : (v - Math.sign(v)*0.1)/0.9;
let prevButtons = {};
function pressed(p, i){
  const now = !!(p.buttons[i] && p.buttons[i].pressed);
  const was = !!prevButtons[i];
  prevButtons[i] = now;
  return now && !was;
}

/* ============ näkymän vaihto & auton asemointi ============ */
function setView(v){
  view = v;
  head.position.copy(VIEWS[v].eye);
  hud.position.copy(VIEWS[v].hud);
  hud.rotation.x = v==='cockpit' ? -0.18 : -0.1;
  interior.visible = (v==='cockpit');
  showNotice(v==='cockpit' ? 'Cockpit' : 'Tuulilasi');
}
function placeCarAtGrid(){
  const S = TD.samples, N = TD.N;
  const i0 = N - 12;                     // hieman ennen lähtöviivaa
  const s0 = S[i0];
  rig.position.set(s0.p.x, 0, s0.p.z);
  car.yaw = Math.atan2(-s0.t.x, -s0.t.z);
  rig.rotation.y = car.yaw;
  car.vx = 0; car.vLat = 0; car.yawRate = 0; car.steer = 0; car.lastIdx = i0;
  prevS = i0/N; cp1 = cp2 = false; lapArmed = false;
}

/* ============ renderöinti ============ */
function resize(){
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camL.aspect = (w/2)/h; camR.aspect = (w/2)/h; camM.aspect = w/h;
  camL.updateProjectionMatrix(); camR.updateProjectionMatrix(); camM.updateProjectionMatrix();
  applyEyeSettings();
  document.getElementById('rotate').style.display =
    (mode==='vr' && running && h > w) ? 'flex' : 'none';
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', ()=>setTimeout(resize,300));

let lastT = 0, hudT = 0;
function loop(t){
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (t-lastT)/1000 || 0.016); lastT = t;
  if(!running) return;

  const p = getPad();
  let steerIn = 0, thr = 0, brk = 0, rev = false;
  if(p){
    if(!padWasOk){ padWasOk=true; updatePadStatus(p); }
    if(pressed(p,9)){
      if(menuState === 'none') openMenu('pause');
      else if(menuState === 'pause') closeMenu();
    }
    if(menuState !== 'none'){
      const n = menuItems().length;
      if(pressed(p,12)){ menuSel = (menuSel-1+n)%n; drawMenu(); }
      if(pressed(p,13)){ menuSel = (menuSel+1)%n; drawMenu(); }
      const sensRow = (menuState === 'pause' && menuSel === 2);
      if(pressed(p,14)){ if(sensRow){ steerSens = Math.max(0.3, Math.round((steerSens-0.1)*10)/10); drawMenu(); } }
      if(pressed(p,15)){ if(sensRow){ steerSens = Math.min(1.3, Math.round((steerSens+0.1)*10)/10); drawMenu(); } }
      if(pressed(p,0)) menuAction();
      if(pressed(p,1) && menuState==='main') openMenu('pause');   // ○ takaisin
    } else {
      if(pressed(p,3)) recenter();
      if(pressed(p,2)) setView(view==='cockpit' ? 'hood' : 'cockpit');
      if(pressed(p,5)){ soundOn = !soundOn; showNotice(soundOn?'Ääni päällä':'Ääni pois'); }
      if(pressed(p,14)) adjustLens(-1);
      if(pressed(p,15)) adjustLens(1);
      if(pressed(p,12)) adjustZoom(1);
      if(pressed(p,13)) adjustZoom(-1);
      rev = !!(p.buttons[1] && p.buttons[1].pressed);              // ○ pakki
    }
    steerIn = dz(p.axes[0]||0);
    thr = (p.buttons[7] && p.buttons[7].value) || 0;
    brk = (p.buttons[6] && p.buttons[6].value) || 0;
  }
  /* verkkoratti ohittaa tatin, polkimet yhdistyvät padin liipaisimiin */
  if(performance.now() - netWheel.ts < 400){
    steerIn = Math.max(-1, Math.min(1, netWheel.s));
    thr = Math.max(thr, Math.min(1, netWheel.t));
    brk = Math.max(brk, Math.min(1, netWheel.b));
  }

  if(gameMode === 'highway' && crashed){ steerIn = 0; thr = 0; rev = false; brk = 0.5; }

  if(!paused){
    stepCar(dt/2, steerIn, thr, brk, rev);
    stepCar(dt/2, steerIn, thr, brk, rev);
    if(gameMode === 'highway') updateHighway(dt);
    else updateTiming();
    updateAudio(thr);
  } else if(engGain){
    engGain.gain.value += (0 - engGain.gain.value)*0.15;
  }

  if(mode==='vr' && haveOrientation){
    head.quaternion.copy(calQ).multiply(deviceQ);
  } else {
    head.quaternion.setFromEuler(new THREE.Euler(monoPitch, monoYaw, 0, 'YXZ'));
  }

  hudT += dt;
  if(hudT > 0.05){
    hudT = 0;
    if(gameMode === 'highway'){
      drawHUDHW();
    } else {
      const nowRef = (paused && pauseT0) ? pauseT0 : performance.now();
      const cur = lapArmed ? nowRef - lapStart : null;
      drawHUD(cur, lastLap, bestLap, lapArmed);
      updateMinimap();
    }
    drawGauges(Math.round(Math.abs(car.vx)*3.6), thr);
    if(performance.now() > noticeUntil) toast.visible = false;
  }

  const w = window.innerWidth, h = window.innerHeight;
  if(mode==='vr'){
    renderer.setScissorTest(true);
    renderer.setViewport(0,0,w/2,h);   renderer.setScissor(0,0,w/2,h);   renderer.render(scene,camL);
    renderer.setViewport(w/2,0,w/2,h); renderer.setScissor(w/2,0,w/2,h); renderer.render(scene,camR);
    renderer.setScissorTest(false);
  } else {
    renderer.setViewport(0,0,w,h);
    renderer.render(scene,camM);
  }
}
requestAnimationFrame(loop);

/* ============ valikko, käynnistys, luvat ============ */
const trackListEl = document.getElementById('trackList');
MENU_TRACKS.forEach((T,i)=>{
  const d = document.createElement('div');
  d.className = 'track' + (i===0?' sel':'');
  d.innerHTML = '<b>'+T.name+'</b><span>'+T.desc+'</span>';
  d.addEventListener('click', ()=>{
    selectedTrack = i;
    document.querySelectorAll('.track').forEach((el,j)=>el.classList.toggle('sel', j===i));
  });
  trackListEl.appendChild(d);
});

let wakeLock = null;
async function keepAwake(){
  try{ if('wakeLock' in navigator){ wakeLock = await navigator.wakeLock.request('screen'); } }catch(e){}
}
document.addEventListener('visibilitychange', ()=>{
  if(document.visibilityState==='visible' && running) keepAwake();
});

async function begin(m){
  mode = m;
  initAudio();
  if(actx && actx.state === 'suspended'){ try{ actx.resume(); }catch(e){} }
  if(m==='vr'){
    try{
      if(typeof DeviceOrientationEvent!=='undefined' && DeviceOrientationEvent.requestPermission){
        const res = await DeviceOrientationEvent.requestPermission();
        if(res!=='granted'){ alert('Gyroskooppilupa tarvitaan VR-tilaan.'); return; }
      }
    }catch(e){}
    try{ await document.documentElement.requestFullscreen({navigationUI:'hide'}); }catch(e){}
  }
  await keepAwake();
  if(selectedTrack === 3){
    startHighwayRun();
  } else {
    gameMode = 'race';
    hwGroup.visible = false;
    mmPlane.visible = true;
    buildTrack(selectedTrack);
    lastLap = null; bestLap = null;
    placeCarAtGrid();
  }
  setView('cockpit');
  toast.visible = false; closeMenu();
  document.getElementById('start').classList.add('hidden');
  document.getElementById('divider').style.display = (m==='vr') ? 'block' : 'none';
  running = true;
  resize();
  setTimeout(recenter, 600);
  setTimeout(recenter, 1500);
}
document.getElementById('btnVR').addEventListener('click', ()=>begin('vr'));
document.getElementById('btnMono').addEventListener('click', ()=>begin('mono'));
setInterval(()=>{
  if(!running){ const p=getPad(); if(p) updatePadStatus(p); }
}, 300);

resize();
</script>
</body>
</html>
