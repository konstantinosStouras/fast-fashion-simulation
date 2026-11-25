import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {finishStudioReads,recordStudioReads,replayStudioReads,serialize} from '../studio-memory.js';

test('first and expired visits skip worker lookup while a recent snapshot still uses it',async t=>{
 const values=new Map(),messages=[];
 const worker={scriptURL:new URL('../studio-worker.js',import.meta.url).href,
  postMessage(message,ports){messages.push(message.op);ports?.[0].postMessage(null);}};
 for(const [key,value] of Object.entries({
  navigator:{serviceWorker:{controller:worker,register:async()=>({active:worker}),ready:Promise.resolve({active:worker})}},
  document:{addEventListener(){}},addEventListener:()=>{},
  sessionStorage:{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)}
 })){
  const previous=Object.getOwnPropertyDescriptor(globalThis,key);
  Object.defineProperty(globalThis,key,{configurable:true,value});
  t.after(()=>{if(previous)Object.defineProperty(globalThis,key,previous);else delete globalThis[key];});
 }
 const {studioMemory}=await import('../studio-memory.js?expiry-test');
 const memory=studioMemory({uid:'owner',emailVerified:true,metadata:{lastSignInTime:'login'}},'admin','teams');
 assert.equal(await memory.read(),null);
 values.set('studio-memory-1:until:teams',String(Date.now()-1));
 assert.equal(await memory.read(),null);assert.deepEqual(messages,[]);
 values.set('studio-memory-1:until:teams',String(Date.now()+300000));
 assert.equal(await memory.read(),null);assert.deepEqual(messages,['read']);
});

test('repeats can use complete data while new reads run, then use fresh reads for later actions',async()=>{
 let finish,writes=0;
 const api={listTeamUsers:async()=>({users:['b'],nextPageToken:null})};
 const saved={listTeamUsers:{users:['old'],nextPageToken:null}};
 const replay=replayStudioReads(api,saved);
 const fresh=finishStudioReads(api,{listTeamUsers:new Promise(resolve=>{finish=resolve;})});
 assert.deepEqual(await replay.listTeamUsers(),saved.listTeamUsers);
 assert.deepEqual(await replay.listTeamUsers(),await api.listTeamUsers());
 finish({users:['a'],nextPageToken:'page2'});
 assert.deepEqual((await fresh).listTeamUsers.users,['a','b']);
 const observed=recordStudioReads({...api,listSessions:async()=>[],getDefaultTeamComposition:async()=>({}),
  listTeamUsers:async token=>token?api.listTeamUsers():{users:['a'],nextPageToken:'page2'}},'teams',data=>{
  writes++;assert.deepEqual(data.listTeamUsers.users,['a','b']);
 });
 await Promise.all([observed.listSessions(),observed.getDefaultTeamComposition(),observed.listTeamUsers()]);
 assert.equal(writes,0);
 await observed.listTeamUsers('page2');assert.equal(writes,1);
 assert.match(serialize({createdAt:{toMillis:()=>123,toJSON:()=>({seconds:0})}}),/__studioTimestamp":123/);
});

test('worker isolates tab, login and screen, clears on sign-out and expires old records',()=>{
 const callbacks={},scope='https://example.test/sim/';
 let now=0,reply;
 const self={registration:{scope},addEventListener:(key,fn)=>{callbacks[key]=fn;}};
 vm.runInNewContext(readFileSync(new URL('../studio-worker.js',import.meta.url),'utf8'),{self,URL,Date:{now:()=>now}});
 function send(op,changes={},url=scope+'admin/'){
  reply=undefined;
  callbacks.message({data:{schema:'studio-memory-1',tabKey:'tab1',login:'admin/session1',screen:'teams',op,text:'saved',time:now,...changes},
   source:{url},ports:[{postMessage:value=>{reply=value;}}]});
  return reply;
 }
 send('save');assert.equal(send('read'),'saved');
 for(const changes of [{tabKey:'tab2'},{login:'other/session1'},{login:'admin/session2'},{screen:'ai'}])
  assert.equal(send('read',changes),null);
 assert.equal(send('read',{},'https://example.test/other/'),undefined);
 send('clear');assert.equal(send('read'),null);
 send('save');now=300001;assert.equal(send('read'),null);
 send('save',{time:0});assert.equal(send('read'),null);
});

test('admin static assets reuse fresh responses and leave service requests and hard reloads alone',async()=>{
 const events={},scope='https://example.test/sim/';
 let calls=0,now=0;
 const self={registration:{scope},addEventListener:(name,fn)=>{events[name]=fn;}};
 const fetch=async req=>{
  calls++;
  return new Response('static',{headers:{'content-type':req.mode==='navigate'?'text/html':'text/javascript','cache-control':'public,max-age=600'}});
 };
 vm.runInNewContext(readFileSync(new URL('../studio-worker.js',import.meta.url),'utf8'),{self,URL,fetch,Date:{now:()=>now}});
 function load(path,options={}){
  let handled;
  events.fetch({request:{url:new URL(path,scope).href,method:'GET',destination:'script',...options},
   clientId:'page',resultingClientId:'page',respondWith:promise=>{handled=promise;},waitUntil:()=>{}});
  return handled;
 }
 assert.equal(load('main.js'),undefined);
 await load('admin/',{mode:'navigate'});await load('main.js');await load('main.js');assert.equal(calls,2);
 assert.equal(load('main.js',{cache:'reload'}),undefined);
 assert.equal(load('https://firestore.googleapis.com/query',{destination:''}),undefined);
 assert.equal(load('https://thirdparty.test/content.js'),undefined);
 now=120001;await load('main.js');assert.equal(calls,3);
});

test('a restarted worker can serve still-fresh public HTML while its network update is pending',async()=>{
 const url='https://example.test/sim/?studio=teams',now=Date.now(),events={},writes=[];
 const html=text=>new Response(text,{headers:{'content-type':'text/html','cache-control':'max-age=600',date:new Date(now-310000).toUTCString()}});
 let network,served,background;
 const self={registration:{scope:'https://example.test/sim/'},addEventListener:(key,fn)=>{events[key]=fn;}};
 const caches={open:async()=>({match:async key=>key===url?html('public shell'):null,put:async key=>writes.push(key)})};
 vm.runInNewContext(readFileSync(new URL('../studio-worker.js',import.meta.url),'utf8'),{self,URL,caches,Date,
  fetch:()=>new Promise(resolve=>{network=resolve;})});
 events.fetch({request:{method:'GET',mode:'navigate',url},resultingClientId:'new',respondWith:v=>{served=v;},waitUntil:v=>{background=v;}});
 assert.equal(await (await served).text(),'public shell');
 network(html('updated'));await background;assert.deepEqual(writes,[url]);
});
