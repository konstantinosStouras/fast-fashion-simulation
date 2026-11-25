import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {finishStudioReads,recordStudioReads,replayStudioReads,serialize} from '../studio-memory.js';

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
