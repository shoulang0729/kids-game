import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import vm from 'node:vm';
import {PLAY_GAMES,validPlay,playSummary,EVENT_AGE} from '../shared/play-policy.mjs';
const source=readFileSync(new URL('../shared/play-count-client.mjs',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace(/^export /gm,'');
function client(store=new Map(),{fail=false,storageFails=false,search=''}={}){
 const requests=[];const ls={get length(){return store.size},key:i=>[...store.keys()][i],getItem:k=>store.get(k)||null,setItem:(k,v)=>{if(storageFails)throw Error('denied');store.set(k,v)},removeItem:k=>store.delete(k)};
 const sb={PLAY_GAMES,validPlay,URLSearchParams,AbortSignal,crypto:webcrypto,location:{search},localStorage:ls,addEventListener(){},fetch:async(url,init)=>{requests.push({url,...init});if(fail)throw Error('offline');return {ok:true,json:async()=>({counted:true})};}};
 const ctx=vm.createContext(sb);vm.runInContext(source,ctx);return {store,requests,run:code=>vm.runInContext(code,ctx)};
}
test('play counts: policy excludes test demo and gives zero, sole leader or tied leaders',()=>{
 assert(!PLAY_GAMES.includes('online-demo'));assert.equal(PLAY_GAMES.length,10);
 assert.deepEqual(playSummary([]).leaders,[]);
 assert.deepEqual(playSummary([{game:'snake',plays:5},{game:'tap-circle',plays:5}]).leaders,['snake','tap-circle']);
 assert.equal(playSummary([{game:'snake',plays:5},{game:'tap-circle',plays:4}]).total,9);
 const e={id:'00000000-0000-4000-8000-000000000001',startedAt:Date.now()};assert(validPlay('snake',e));assert(!validPlay('snake',{...e,startedAt:Date.now()-EVENT_AGE-1000}));assert(!validPlay('__proto__',e));assert(!validPlay('snake',{...e,id:[e.id]}));
});
test('play counts: opening the module sends no start, actual starts send anonymous distinct events',async()=>{
 const c=client();await c.run('flushPlays()');assert.equal(c.requests.length,0);
 c.run('recordPlay("snake");recordPlay("snake");recordPlay("online-demo")');await c.run('flushPlays()');
 assert.equal(c.requests.length,2);assert.notEqual(JSON.parse(c.requests[0].body).id,JSON.parse(c.requests[1].body).id);
 assert.equal(c.requests[0].headers.Authorization,undefined);assert.deepEqual(Object.keys(JSON.parse(c.requests[0].body)).sort(),['id','startedAt']);assert.equal(c.store.size,0);
});
test('play counts: offline events survive navigation and retry the same ID',async()=>{
 let c=client(new Map(),{fail:true});const id=c.run('recordPlay("snake")');await c.run('flushPlays().catch(()=>{})');assert.equal(c.store.size,1);
 c=client(c.store);await c.run('flushPlays()');assert.equal(JSON.parse(c.requests[0].body).id,id);assert.equal(c.store.size,0);
});
test('play counts: separate tabs retain each others pending event, blocked storage does not break play',async()=>{
 const store=new Map();const a=client(store,{fail:true}),b=client(store,{fail:true});a.run('recordPlay("snake")');b.run('recordPlay("tap-circle")');await Promise.all([a.run('flushPlays().catch(()=>{})'),b.run('flushPlays().catch(()=>{})')]);assert.equal(store.size,2);
 const c=client(store);await c.run('flushPlays()');assert.equal(c.requests.length,2);assert.equal(store.size,0);
 const d=client(new Map(),{storageFails:true});assert.doesNotThrow(()=>d.run('recordPlay("snake")'));await d.run('flushPlays()');assert.equal(d.requests.length,1);
});
test('play counts: only loopback server overrides are accepted',async()=>{
 for(const [server,url] of [['localhost:8787','http://localhost:8787'],['example.com','https://tomiyoko-online.shoulang.workers.dev']]){const c=client(new Map(),{search:'?server='+server});c.run('recordPlay("snake")');await c.run('flushPlays()');assert.equal(c.requests[0].url,url+'/plays/snake');}
});

test('play counts: an old server returning an unrelated HTTP 200 must not discard the queued play',async()=>{
 const c=client();await c.run('flushPlays()');
 c.run("fetch=async()=>({ok:true,json:async()=>({message:'old server'})});recordPlay('snake')");
 await c.run('flushPlays().catch(()=>{})');assert.equal(c.store.size,1);
});
