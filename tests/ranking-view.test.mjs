import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto, createHash } from 'node:crypto';
import vm from 'node:vm';
import { RANKINGS } from '../shared/leaderboard-policy.mjs';
import * as view from '../ranking/view.mjs';
const rule=RANKINGS.snake.score,code='b'.repeat(64),named={name:'こう',code,pending:0};
test('ranking view: show records without gap or top-twenty messages; match self by identity',()=>{
 const rows=[{player:'other',name:'同じ',score:100},{player:'me',name:'同じ',score:100}];
 assert.equal(view.ownPosition(rows,{name:'同じ',score:100},'me'),1);
 assert.equal(view.ownPosition(rows,{score:100},'missing'),-1);
 assert.equal(view.recordSummary({rows,own:{score:100}},rule),'100点');
 assert.equal(view.recordSummary({rows,own:null},rule),'まだ記録がありません');
 assert.equal(view.formatScore(12345,rule),'12,345点');
 assert.equal(view.formatScore(12.345,RANKINGS['snake-battle'].meters),'12.35m');
 assert.match(view.syncSummary({name:'',pending:0}).text,/名前を登録/);
 assert.match(view.syncSummary({...named,pending:2}).text,/2ゲーム分/);
});
const html=readFileSync(new URL('../ranking/index.html',import.meta.url),'utf8');
const source=readFileSync(new URL('../ranking/page.mjs',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
class Element {
 constructor(id=''){this.id=id;this.hidden=false;this.disabled=false;this.open=false;this.children=[];this.dataset={};this.value='';this.textContent='';this.className='';this.attrs={};this.listeners={};this.parentElement={dataset:{}};}
 append(...nodes){this.children.push(...nodes);for(const n of nodes)n.parentElement=this;}
 replaceChildren(...nodes){this.children=[...nodes];this.value='';}
 add(option){this.append(option);if(this.children.length===1)this.value=option.value;}
 setAttribute(k,v){this.attrs[k]=v;}
 addEventListener(k,f){this.listeners[k]=f;}
 showModal(){this.open=true;}
 close(){this.open=false;}
 focus(){this.focused=true;}
}
async function page({search='?game=snake',hash='',initial={name:'',code:'',pending:0},board={rows:[],own:null},flushError=false,loadError=false,copyError=false,delayCatalog=false}={}){
 const nodes=new Map([...html.matchAll(/<[^>]+id="([^"]+)"[^>]*>/g)].map(m=>{const el=new Element(m[1]);el.hidden=/\bhidden\b/.test(m[0]);el.disabled=/\bdisabled\b/.test(m[0]);return [m[1],el]}));
 const calls={save:0,flush:0,copies:[],loads:[]},p={...initial};let release;
 const games=[{id:'snake',title:'へび',emoji:'🐍'},{id:'chaos-ultra-x',title:'カオス',emoji:'🌌'},{id:'online-demo',title:'demo',emoji:'🧪'}];
 const catalogPromise=delayCatalog?new Promise(resolve=>{release=resolve}):Promise.resolve(games);
 const context=vm.createContext({
  ...view,RANKINGS,URLSearchParams,TextEncoder,crypto:webcrypto,console,
  location:{search,hash,href:''},document:{title:'',getElementById:id=>nodes.get(id),createElement:()=>new Element()},
  Option:function(text,value){this.textContent=text;this.value=value;},addEventListener(){},
  fetch:async()=>({ok:true,json:()=>catalogPromise}),
  profile:()=>({...p}),setProfile:(name,imported)=>{calls.save++;name=name.replace(/[\u0000-\u001f<>&"'`]/g,'').trim().slice(0,12);if(!name)throw Error('名前を入れてください');p.name=name;p.code=imported||p.code||code;return {persisted:true}},
  flush:async()=>{calls.flush++;if(flushError)throw Error('記録を送れませんでした');p.pending=0},
  load:async(game,metric)=>{calls.loads.push({game,metric});if(loadError)throw Error('通信失敗');return board;},
  navigator:{clipboard:{writeText:async c=>{if(copyError)throw Error('blocked');calls.copies.push(c)}}}
 });
 const ready=vm.runInContext('(async()=>{'+source+';await catalogReady;})()',context);
 const settle=async()=>{await ready;for(let i=0;i<200&&nodes.get('board-panel').attrs['aria-busy']==='true';i++)await new Promise(r=>setTimeout(r,5));assert.notEqual(nodes.get('board-panel').attrs['aria-busy'],'true');};
 if(!delayCatalog)await settle();
 return {get:id=>nodes.get(id),calls,context,p,settle,release:()=>release(games)};
}
test('ranking gate: immediately prompt before catalog load, block empty names, Escape and navigation',async()=>{
 const p=await page({delayCatalog:true});
 assert.equal(p.get('name-dialog').open,true);assert.equal(p.get('ranking-content').hidden,true);
 assert.equal(p.get('name').focused,true);assert.equal(p.get('settings').disabled,false);
 assert.equal(p.get('save').disabled,true);assert.equal(p.get('close-profile').hidden,true);
 let cancelled=false;p.get('name-dialog').listeners.cancel({preventDefault(){cancelled=true}});assert.equal(cancelled,true);
 p.get('name').value='   ';p.get('name').oninput();assert.equal(p.get('save').disabled,true);
 await p.get('save').onclick();assert.equal(p.get('name-dialog').open,true);assert.equal(p.calls.save,0);
 p.get('name').value='<>';p.get('name').oninput();await p.get('save').onclick();assert.equal(p.get('ranking-content').hidden,true);
 p.get('game-choice').value='chaos-ultra-x';p.get('game-choice').onchange();assert.equal(p.context.location.href,'');
 p.release();await p.settle();assert.equal(p.calls.loads.length,0,'no ranking request before registering');
});
test('ranking gate: valid name opens requested ranking, next visit skips prompt, rename preserves code',async()=>{
 const player=createHash('sha256').update(code).digest('hex');
 const p=await page({board:{rows:[{player:'other',name:'こう',score:100},{player,name:'こう',score:100}],own:{score:100}}});
 assert.equal(p.calls.loads.length,0);p.get('name').value='こう';p.get('name').oninput();assert.equal(p.get('save').disabled,false);
 await p.get('save').onclick();await p.settle();assert.equal(p.get('name-dialog').open,false);assert.equal(p.get('ranking-content').hidden,false);
 assert.equal(p.get('rows').children[1].className,'is-you');assert.equal(p.get('own').textContent,'100点');
 p.get('change-name').onclick();assert.equal(p.get('name-dialog').open,true);assert.equal(p.get('close-profile').hidden,false);
 p.get('name').value='新しい名前';await p.get('save').onclick();await p.settle();assert.equal(p.p.code,code);assert.equal(p.p.name,'新しい名前');
 const next=await page({initial:p.p});assert.equal(next.get('name-dialog').open,false);assert.equal(next.get('ranking-content').hidden,false);
 assert(!html.includes('id="own-rank"'));assert(!html.includes('id="next-goal"'));assert(!html.includes('上位20'));
});
test('ranking gate: transport failure after valid registration does not lock player out',async()=>{
 const p=await page({flushError:true});p.get('name').value='こう';await p.get('save').onclick();await p.settle();
 assert.equal(p.get('name-dialog').open,false);assert.equal(p.get('ranking-content').hidden,false);assert.match(p.get('profile-feedback').textContent,/送れませんでした/);
});
test('ranking settings: malformed import keeps dialog open; transfer, copy and hiding remain usable',async()=>{
 const p=await page({initial:named,copyError:true});p.get('change-name').onclick();
 p.get('import-code').value='broken';await p.get('import').onclick();assert.match(p.get('status').textContent,/64文字/);assert.equal(p.get('name-dialog').open,true);assert.equal(p.calls.save,0);
 p.get('show-code').onclick();assert.equal(p.get('code').textContent,code);await p.get('copy-code').onclick();assert.match(p.get('copy-status').textContent,/長押し/);
 p.get('hide-code').onclick();assert.equal(p.get('code-panel').hidden,true);assert.equal(p.get('code').textContent,'');
 p.get('import-code').value='a'.repeat(64);await p.get('import').onclick();assert.equal(p.p.code,'a'.repeat(64));assert.equal(p.get('name-dialog').open,false);
});
test('ranking navigation: game switch and large play link retain safe local override; entry uses lobby',async()=>{
 const p=await page({initial:named,search:'?game=snake&server=localhost:8787'});
 assert.equal(p.get('play-link').href,'../games/snake/index.html?server=localhost%3A8787');
 p.get('game-choice').value='chaos-ultra-x';p.get('game-choice').onchange();assert.match(p.context.location.href,/game=chaos-ultra-x&server=localhost/);
 const old=await page({initial:named,search:'?return=snake&server=example.com'});assert.equal(old.get('play-link').href,'../games/snake/index.html');
 assert.match(html,/<a id="play-link" class="play-cta" hidden>これを遊ぶ<\/a>/);
 const bookmark=await page({initial:named,search:'',hash:'#profile-panel'});assert.equal(bookmark.get('name-dialog').open,true);
});
test('ranking records: empty and failed loads show clear states; metric change refreshes selected record',async()=>{
 const p=await page({initial:named,search:'?game=chaos-ultra-x'});assert.equal(p.get('own').textContent,'まだ記録がありません');
 p.get('metric').value='wave';p.get('metric').onchange();await p.settle();assert.equal(p.calls.loads.at(-1).metric,'wave');assert.equal(p.get('score-heading').textContent,'最高到達WAVE');
 const failed=await page({initial:named,loadError:true});assert.match(failed.get('own').textContent,/読み込めません/);assert.match(failed.get('board-help').textContent,/もう一度/);
});
