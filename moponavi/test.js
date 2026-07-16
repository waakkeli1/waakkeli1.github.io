'use strict';
const fs = require('fs');

/* ---- selain-stubit ---- */
const elStub = () => new Proxy({ style:{}, classList:{add(){},remove(){},toggle(){}} }, {
  get(t,k){ if(k in t) return t[k]; if(k==='addEventListener'||k==='appendChild'||k==='showModal'||k==='close') return ()=>{}; return t[k]; },
  set(t,k,v){ t[k]=v; return true; }
});
global.document = { getElementById: () => elStub(), createElement: () => elStub() };
const chain = new Proxy(function(){}, { get:(t,k)=> chain, apply:()=>chain });
global.L = chain;
Object.defineProperty(global, 'navigator', { value: { geolocation:{ getCurrentPosition(){}, watchPosition(){return 1}, clearWatch(){} } }, configurable:true });
global.window = {};

let code = fs.readFileSync('./app.js','utf8');
code += '\nmodule.exports = { buildGraph, astar, buildRoute, edgeAllowedAndSpeed, tripBbox, havM, nearestNode, parseMaxspeed };\n';
fs.writeFileSync('./_apptest.js', code);
const A = require('./_apptest.js');

/* ---- synteettinen verkko ----
   Ruudukko: suora tie A->D (60 km/h mutta pitkä kierto) vs. oikaisu mopoväylää pitkin.
   Pisteet (lat kasvaa pohjoiseen, 0.001° ≈ 111 m):
   n1(0,0) --tie--> n2(0,0.01) --tie--> n3(0,0.02)         (etelätie, residential 40)
   n1 --mopoväylä--> n4(0.005,0.01) --mopoväylä--> n3       (diagonaali-oikaisu, lyhyempi)
   Lisäksi kielletty 80 km/h tie n1->n3 suoraan (pitäisi suodattua pois).
*/
const g = (lat,lon)=>({lat,lon});
const osm = { elements: [
  { type:'way', id:1, tags:{highway:'residential', name:'Etelätie', maxspeed:'40'},
    nodes:[1,2,3], geometry:[g(0,0), g(0,0.01), g(0,0.02)] },
  { type:'way', id:2, tags:{highway:'cycleway', moped:'yes', name:'Puistoraitti'},
    nodes:[1,4,3], geometry:[g(0,0), g(0.002,0.01), g(0,0.02)] },
  { type:'way', id:3, tags:{highway:'primary', maxspeed:'80', name:'Kiellettyväylä'},
    nodes:[1,3], geometry:[g(0,0), g(0,0.02)] },
  { type:'way', id:4, tags:{highway:'motorway'}, nodes:[1,3], geometry:[g(0,0), g(0,0.02)] }, // ei edes sallittu kyselyssä, mutta testataan suodatus
]};

let pass=0, fail=0;
const ok = (cond,msg)=>{ if(cond){pass++;console.log('  ✓',msg)} else {fail++;console.log('  ✗',msg)} };

console.log('1) Suodatus');
ok(A.edgeAllowedAndSpeed({highway:'primary',maxspeed:'80'})===null, '80 km/h tie hylätään');
ok(A.edgeAllowedAndSpeed({highway:'primary',maxspeed:'60'}).speed===45, '60 km/h tie sallitaan, nopeus katkaistaan 45:een');
ok(A.edgeAllowedAndSpeed({highway:'residential'}).speed===30, 'residential ilman rajoitusta -> 30');
ok(A.edgeAllowedAndSpeed({highway:'cycleway',moped:'yes'}).kind==='moped', 'moped=yes cycleway -> mopoväylä');
ok(A.edgeAllowedAndSpeed({highway:'secondary',motorroad:'yes'})===null, 'moottoriliikennetie hylätään');
ok(A.edgeAllowedAndSpeed({highway:'residential',moped:'no'})===null, 'moped=no hylätään');
ok(A.parseMaxspeed('FI:urban')===50, 'FI:urban -> 50');

console.log('2) Graafi ja reititys');
const bbox = {s:-1,w:-1,n:1,e:1};
const graph = A.buildGraph(osm, bbox);
ok(graph.nodes.size===4, 'graafissa 4 solmua (kielletyt tiet eivät tuo uusia)');
const s = A.nearestNode(graph, 0.0001, 0.0001);
const t = A.nearestNode(graph, 0.0001, 0.0199);
ok(s===1 && t===3, 'lähimmät solmut löytyvät ('+s+'->'+t+')');
const legs = A.astar(graph, s, t);
ok(!!legs, 'A* löytää reitin');
const rt = A.buildRoute(graph, legs, {lat:0,lon:0,label:'A'}, {lat:0,lon:0.02,label:'B'});
console.log('   matka', Math.round(rt.distM), 'm, aika', Math.round(rt.timeS), 's, mopoväylää', Math.round(rt.pathShare*100)+'%');
// Etelätie: 2×1113m @40 -> 200s. Puistoraitti: 2×~1135m @30 -> ~272s. Tie voittaa ajassa.
ok(rt.legs.every(l=>l.kind==='road'), 'nopeampi ajotie valitaan kun mopoväylä ei ole nopeampi');

console.log('3) Mopoväylä valitaan kun se oikaisee');
// tehdään tiestä hidas kiertotie: siirretään n2 kauas
const osm2 = JSON.parse(JSON.stringify(osm));
osm2.elements[0].geometry[1] = g(-0.02, 0.01); // etelätie kiertää kaukaa
const graph2 = A.buildGraph(osm2, bbox);
const legs2 = A.astar(graph2, 1, 3);
const rt2 = A.buildRoute(graph2, legs2, {lat:0,lon:0,label:'A'}, {lat:0,lon:0.02,label:'B'});
console.log('   matka', Math.round(rt2.distM), 'm, mopoväylää', Math.round(rt2.pathShare*100)+'%');
ok(rt2.pathShare>0.9, 'reitti kulkee mopoväylää pitkin');
ok(rt2.steps.some(x=>/mopoväylä/i.test(x.text)), 'ohjeissa mainitaan siirtyminen mopoväylälle');

console.log('4) Yksisuuntaisuus');
const osm3 = { elements: [
  { type:'way', id:1, tags:{highway:'residential', name:'Yksisuunta', oneway:'yes', maxspeed:'40'},
    nodes:[1,2], geometry:[g(0,0), g(0,0.01)] },
  { type:'way', id:2, tags:{highway:'residential', name:'Kierto', maxspeed:'30'},
    nodes:[1,3,2], geometry:[g(0,0), g(0.005,0.005), g(0,0.01)] },
]};
const graph3 = A.buildGraph(osm3, bbox);
const fwd = A.astar(graph3, 1, 2), back = A.astar(graph3, 2, 1);
ok(fwd.length===1 && fwd[0].name==='Yksisuunta', 'myötäsuuntaan suora yksisuuntainen käy');
ok(back.every(l=>l.name==='Kierto'), 'vastasuuntaan reititetään kiertotietä');

console.log('5) Aikamalli: 60 km/h tiellä ajetaan 45 km/h');
const osm4 = { elements: [
  { type:'way', id:1, tags:{highway:'secondary', maxspeed:'60', name:'Kuutostie'},
    nodes:[1,2], geometry:[g(0,0), g(0,0.1)] }, // ~11.13 km
]};
const graph4 = A.buildGraph(osm4, bbox);
const legs4 = A.astar(graph4, 1, 2);
const rt4 = A.buildRoute(graph4, legs4, {label:'A'}, {label:'B'});
const expected = rt4.distM / (45/3.6);
ok(Math.abs(rt4.timeS - expected) < 1, `aika ${Math.round(rt4.timeS)}s = matka/45km/h (${Math.round(expected)}s)`);

fs.unlinkSync('./_apptest.js');
console.log(`\n${pass} OK, ${fail} FAIL`);
process.exit(fail?1:0);
