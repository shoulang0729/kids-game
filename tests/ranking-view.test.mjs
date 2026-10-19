import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto, createHash } from 'node:crypto';
import vm from 'node:vm';
import { RANKINGS } from '../shared/leaderboard-policy.mjs';
import * as view from '../ranking/view.mjs';
const rule = RANKINGS.snake.score;
test('ranking view: registration and pending states explain the next action', () => {
  assert.match(view.syncSummary({name:'',pending:2}).text, /2ゲーム分/);
  assert.equal(view.syncSummary({name:'',pending:0}).state, 'new');
  assert.equal(view.syncSummary({name:'こうちゃん',pending:2}).state, 'pending');
  assert.equal(view.syncSummary({name:'こうちゃん',pending:0}).state, 'ready');
});
test('ranking view: own identity is never guessed from matching names or scores', () => {
  const rows=[{player:'other',name:'同じ',score:100},{player:'me',name:'同じ',score:100}];
  assert.equal(view.ownPosition(rows,{name:'同じ',score:100},'me'),1);
  assert.equal(view.ownPosition(rows,{name:'同じ',score:100},'missing'),-1);
  assert.equal(view.ownPosition(rows,null,'me'),-1);
  assert.equal(view.ownPosition(rows,{score:100},null),-1);
  assert.match(view.recordSummary({rows,own:{score:100}},{name:'同じ'},'me',rule).rank,/2位/);
});
test('ranking view: empty records, outside top twenty, next target and readable units', () => {
  assert.match(view.recordSummary({rows:[],own:null},{name:''},null,rule).goal,/名前を登録/);
  assert.match(view.recordSummary({rows:[],own:null},{name:'名前'},'me',rule).goal,/最初の記録/);
  const rows=Array.from({length:20},(_,i)=>({player:'p'+i,score:100-i}));
  const summary=view.recordSummary({rows,own:{score:50}},{name:'名前'},'me',rule);
  assert.equal(summary.rank,'上位20人の外');
  assert.match(summary.goal,/あと32点/);
  assert.equal(view.formatScore(12345,rule),'12,345点');
  assert.equal(view.formatScore(12.345,RANKINGS['snake-battle'].meters),'12.35m');
});
const source=readFileSync(new URL('../ranking/page.mjs',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
class Element {
  constructor(id=''){this.id=id;this.hidden=false;this.disabled=false;this.children=[];this.dataset={};this.value='';this.textContent='';this.className='';this.attrs={};this.parentElement={dataset:{}};this.classList={add:(v)=>{this.className+=' '+v}};}
  append(...children){this.children.push(...children);for(const c of children)c.parentElement=this;}
  replaceChildren(...children){this.children=[...children];this.value='';}
  add(option){this.append(option);if(this.children.length===1)this.value=option.value;}
  setAttribute(k,v){this.attrs[k]=v;}
}
async function page({search='?game=snake',initial={name:'',code:'',pending:0},board={rows:[],own:null},flushError=false,loadError=false,copyError=false}={}){
  const nodes=new Map([...readFileSync(new URL('../ranking/index.html',import.meta.url),'utf8').matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new Element(m[1])]));
  const code='b'.repeat(64),calls={save:0,flush:0,copies:[],loads:[]};let p={...initial};
  const context=vm.createContext({
    ...view,RANKINGS,URLSearchParams,TextEncoder,crypto:webcrypto,console,
    location:{search,href:''},document:{title:'',getElementById:id=>nodes.get(id),createElement:()=>new Element()},
    Option:function(text,value){this.textContent=text;this.value=value;},addEventListener(){},
    fetch:async()=>({ok:true,json:async()=>[{id:'snake',title:'へび',emoji:'🐍'},{id:'chaos-ultra-x',title:'カオス',emoji:'🌌'},{id:'online-demo',title:'demo',emoji:'🧪'}]}),
    profile:()=>({...p}),setProfile:(name,imported)=>{calls.save++;if(!name.trim())throw Error('名前を入れてください');p.name=name;p.code=imported||code;return {persisted:true}},
    flush:async()=>{calls.flush++;if(flushError)throw Error('記録を送れませんでした');p.pending=0},
    load:async(game,metric)=>{calls.loads.push({game,metric});if(loadError)throw Error('通信失敗');return board;},
    navigator:{clipboard:{writeText:async code=>{if(copyError)throw Error('blocked');calls.copies.push(code)}}}
  });
  await vm.runInContext('(async()=>{'+source+'})()',context);
  // WebCrypto runs on the worker pool: wait for rendering, not one event-loop tick.
  for (let i=0;i<200 && nodes.get('board-panel').attrs['aria-busy']==='true';i++) await new Promise(r=>setTimeout(r,5));
  assert.notEqual(nodes.get('board-panel').attrs['aria-busy'],'true','board rendering timed out');
  return {get:id=>nodes.get(id),calls,context,p};
}
test('ranking page: first-time player can find every ranking and register without revealing a code',async()=>{
  const p=await page({search:''});
  assert.equal(p.get('game-list').children.length,2);
  assert.equal(p.get('settings').disabled,false);
  assert.match(p.get('sync-status').textContent,/登録はいりません/);
  p.get('name').value='こうちゃん';
  await p.get('save').onclick();await new Promise(r=>setImmediate(r));
  assert.equal(p.calls.save,1);assert.equal(p.calls.flush,1);
  assert.match(p.get('status').textContent,/送信が完了/);
  assert.equal(p.get('code-panel').hidden,true);
  assert.equal(p.get('retry').hidden,true);
  p.get('show-code').onclick();assert.equal(p.get('code').textContent,'b'.repeat(64));
  await p.get('copy-code').onclick();assert.equal(p.calls.copies.length,1);
  p.get('hide-code').onclick();assert.equal(p.get('code-panel').hidden,true);assert.equal(p.get('code').textContent,'');
});
test('ranking page: direct game links show the authenticated own row, and preserve local test routing',async()=>{
  const code='b'.repeat(64),player=createHash('sha256').update(code).digest('hex');
  const p=await page({search:'?game=snake&server=localhost:8787',initial:{name:'こう',code,pending:0},board:{rows:[{player:'other',name:'こう',score:100},{player,name:'こう',score:100}],own:{name:'こう',score:100}}});
  assert.equal(p.get('profile-panel').hidden,true);assert.equal(p.get('board-panel').hidden,false);
  assert.equal(p.get('rows').children[0].className,'');assert.equal(p.get('rows').children[1].className,'is-you');
  assert.equal(p.get('own').textContent,'100点');assert.match(p.get('own-rank').textContent,/2位/);
  assert.match(p.get('profile-link').href,/server=localhost/);
  p.get('game-choice').value='chaos-ultra-x';p.get('game-choice').onchange();
  assert.match(p.context.location.href,/game=chaos-ultra-x&server=localhost/);
});
test('ranking page: failure keeps pending records visible; malformed imports do not change identity',async()=>{
  const p=await page({search:'?return=snake',initial:{name:'こう',code:'b'.repeat(64),pending:2},flushError:true,copyError:true});
  await new Promise(r=>setImmediate(r));
  assert.equal(p.get('retry').hidden,false);
  p.get('retry').onclick();await new Promise(r=>setImmediate(r));
  assert.match(p.get('status').textContent,/送れませんでした/);assert.equal(p.p.pending,2);
  p.get('import-code').value='broken';p.get('import').onclick();await new Promise(r=>setImmediate(r));
  assert.match(p.get('status').textContent,/64文字/);assert.equal(p.calls.save,0);
  assert.equal(p.get('save').disabled,false);
  p.get('show-code').onclick();await p.get('copy-code').onclick();assert.match(p.get('copy-status').textContent,/長押し/);
});
test('ranking page: network failures show retry guidance without inventing a score',async()=>{
  const p=await page({loadError:true});
  assert.match(p.get('own').textContent,/読み込めません/);
  assert.match(p.get('board-help').textContent,/もう一度/);
  assert.equal(p.get('board-panel').attrs['aria-busy'],'false');
});

test('ranking page: registration anchor keeps the local API query before its fragment',async()=>{
  const p=await page({search:'?server=localhost:8787'});
  const target=new URL(p.get('setup-link').href,'http://127.0.0.1/kids-game/ranking/index.html');
  assert.equal(target.searchParams.get('server'),'localhost:8787');
  assert.equal(target.hash,'#profile-panel');
});
