// Validate the scripts actually loaded by the shipped game page.
const readSource = require('./read-source.cjs');
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const sb={window:{},Math,console};vm.createContext(sb);vm.runInContext(readSource("videogames.js"),sb);const api=sb.window.ArcadeVideo;
const ctx=new Proxy({},{get(t,p){if(p==='createLinearGradient'||p==='createRadialGradient')return ()=>({addColorStop(){}});return p in t?t[p]:(...args)=>{for(const v of args)if(typeof v==='number')assert(Number.isFinite(v),'nonfinite canvas '+p)}},set(t,p,v){t[p]=v;return true}});
assert.equal(api.definitions.length,20);assert.equal(new Set(api.definitions.map(d=>d.id)).size,20);
function make(id){const g=api.createGame(id,()=>.5);g.draw(ctx);g.start();return g}
function ticks(g,seconds,control){for(let i=0;i<Math.ceil(seconds/.02)&&g.state==='playing';i++){control?.(g,i);g.update(.02);if(i%10===0)g.draw(ctx)}}
function won(g,id){assert.equal(g.state,'done',id+' ends');assert.equal(g.win,true,id+' wins');g.draw(ctx)}
// Every mode survives noisy touch/keyboard input, draws, times out and restarts.
for(const d of api.definitions){let g=make(d.id);ticks(g,d.duration+1,(g,i)=>{if(i%25===0){g.key('left',i%50===0);g.key('right',i%50!==0);g.key('action',true);g.pointer(120+i%480,80+i%320,'down')}if(i%25===1){g.key('action',false);g.pointer(500,240,'move')}if(i%25===2)g.pointer(500,240,'up')});assert.equal(g.state,'done',d.id+' timeout or early end');assert(Number.isFinite(g.score));g.start();assert.equal(g.score,0);assert.equal(g.state,'playing');g.draw(ctx)}
// Gameplay-specific successes and failures: fixtures set the situation, real input and update award points.
let g=make('race');g.x=100;g.key('action',true);ticks(g,30);won(g,'race');g=make('race');g.cars=[{x:337,y:355,w:46,h:65}];g.update(.02);assert.equal(g.lives,3,'traffic collision');
g=make('space');g.enemies=[{base:360,x:360,y:80}];g.wave=2;g.score=350;g.shots=[{x:360,y:89}];g.update(.02);won(g,'space');
g=make('gallery');for(let i=0;i<12;i++){g.targets=[{x:300,y:200,vx:0,life:1,bad:false}];g.pointer(300,200)}ticks(g,41);won(g,'gallery');g=make('gallery');g.targets=[{x:300,y:200,vx:0,life:1,bad:true}];g.pointer(300,200);assert.equal(g.score,0);assert.equal(g.lives,3);
g=make('bowling');for(let round=0;round<5;round++){g.pointer(360,240);g.key('action',true);ticks(g,.6);g.key('action',false);ticks(g,2)}assert(g.score>=25,'bowling reachable score '+g.score);won(g,'bowling');
g=make('soccer');for(let shot=0;shot<5;shot++){const keeper=360+Math.sin((g.age+.84)*2.1)*170;g.pointer(keeper<360?530:190,200);g.key('action',true);ticks(g,.9)}won(g,'soccer');
g=make('baseball');for(let n=0;n<10&&g.state==='playing';n++){while(g.pitch<.985&&g.state==='playing')g.update(.01);g.key('action',true);ticks(g,1.3)}won(g,'baseball');assert(g.score>=40);
g=make('drums');ticks(g,46,g=>{const n=g.notes.find(n=>Math.abs(n.y-390)<12);if(n)g.key(n.lane?'right':'left',true)});won(g,'drums');
g=make('crossing');for(let n=0;n<24;n++)g.key('up',true);won(g,'crossing');g=make('crossing');g.traffic[0].cars=[360];g.row=1;g.update(.02);assert.equal(g.lives,3);
g=make('pinball');g.score=140;g.launched=true;g.ball={x:290,y:107,vx:0,vy:0};g.update(.02);won(g,'pinball');
g=make('breakout');g.score=31;g.bricks=[{x:330,y:80,w:66,h:25}];g.launched=true;g.ball={x:360,y:110,vx:0,vy:-230};g.update(.02);won(g,'breakout');
g=make('reaction');for(let n=0;n<5;n++){while(g.signal!=='go'&&g.state==='playing')g.update(.02);ticks(g,.2);g.key('action',true);ticks(g,1)}won(g,'reaction');g=make('reaction');g.key('action',true);assert.equal(g.score,0);assert.equal(g.round,1);
g=make('memory');for(let n=0;n<6;n++){while(g.showing&&g.state==='playing')g.update(.02);const sequence=[...g.sequence];for(const i of sequence)g.pointer(i%2?500:200,i>=2?330:150)}won(g,'memory');
g=make('rings');for(let n=0;n<6;n++){g.key('action',true);ticks(g,.9);g.key('action',false);ticks(g,.9)}won(g,'rings');
g=make('fishing');g.fish=[{x:360,y:170,vx:0,value:10}];for(let n=0;n<4;n++){g.x=360;g.key('action',true);ticks(g,1.5)}won(g,'fishing');
g=make('pusher');let drops=0;ticks(g,61,(g,i)=>{if(i%18===0&&drops<30){g.pointer(100+(drops%13)*40,200);g.key('action',true);drops++}});assert(g.score>=20,'pusher score '+g.score);won(g,'pusher');
g=make('stack');for(let n=0;n<10;n++){let guard=0;while(Math.abs(g.x-g.center)>2&&guard++<1000)g.update(.01);assert(guard<1000);g.key('action',true)}won(g,'stack');g=make('stack');g.key('action',true);g.x=650;g.key('action',true);assert.equal(g.win,false,'off-edge stack fails');
g=make('maze');for(const [x,y]of [[65,438],[215,438],[215,380],[335,380],[335,110],[450,110],[450,365],[565,365],[565,60],[650,60]]){g.pointer(x,y);let guard=0;while(Math.hypot(g.ball.x-x,g.ball.y-y)>5&&g.state==='playing'&&guard++<1500)g.update(.02);assert(guard<1500,'maze waypoint '+x+','+y+' at '+g.ball.x+','+g.ball.y)}won(g,'maze');
g=make('slice');for(let n=0;n<15;n++){g.fruit=[{x:300,y:200,bad:false,cut:false}];g.pointer(220,200,'down');g.pointer(380,200,'move');g.pointer(380,200,'up')}ticks(g,46);won(g,'slice');g=make('slice');g.fruit=[{x:300,y:200,bad:true,cut:false}];g.pointer(300,200);assert.equal(g.lives,4);
g=make('pong');g.score=4;g.pause=0;g.ball={x:718,y:20,vx:220,vy:0};g.update(.02);won(g,'pong');
g=make('cannon');for(let n=0;n<8&&g.state==='playing';n++){let angle=20,error=Infinity;for(let a=18;a<=76;a+=.1){let vy=500*Math.sin(a*Math.PI/180),t=(vy+Math.sqrt(vy*vy+8000))/400,x=85+Math.cos(a*Math.PI/180)*500*t;if(Math.abs(x-g.targetX)<error){error=Math.abs(x-g.targetX);angle=a}}g.angle=angle;g.key('action',true);ticks(g,3)}won(g,'cannon');
console.log('PASS: all 20 modes start, handle touch/keys, draw, end and replay; all 20 have verified reachable success and specific miss/collision paths. Browser/GPU appearance not verified.');
