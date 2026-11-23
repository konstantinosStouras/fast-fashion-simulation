import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_CONFIG} from '../model.js';
import {competitorResult} from '../market.js';

test('default teams seed new classrooms, played codes follow participation, and deleting accounts preserves shared play', async t => {
 const storage=new Map();
 globalThis.localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)};
 globalThis.addEventListener=()=>{};
 const api=await import('../backend-demo.js');
 t.after(async()=>{await api.logout();delete globalThis.localStorage;delete globalThis.addEventListener;});
 const data=()=>JSON.parse(storage.get('ff:demo:v1'));
 const email=label=>label+'@example.test';
 const [a,r,z]=['ada','rival','zoe'];
 const ids={};
 for(const name of [a,r,z,'teacher']) {
  await api.loginEmail(email(name));
  ids[name]=api.currentUser().uid;
  await api.saveProfile({firstName:name,lastName:'Example',universityId:'S-'+name});
 }
 await api.loginEmail('admin@admin.com');const alias=api.currentUser().uid;
 await api.loginGoogle();const owner=api.currentUser().uid;
 await api.grant(email('teacher'));
 const assignments={[ids[a]]:'1',[ids[z]]:'1',[ids[r]]:'2'};
 assert.deepEqual(await api.saveDefaultTeamComposition(assignments),{teamComposition:assignments});
 const settings=await api.saveAiSettings({provider:'openai',apiKey:'demo-fixture'});
 const room=await api.createSession('Shared class',DEFAULT_CONFIG,'team','ROME',
  {provider:settings.provider,model:settings.model,practice:false,main:true});
 const waiting=await api.createSession('Waiting class',DEFAULT_CONFIG,'team','OSLO');
 const neverStarted=await api.createSession('Closed in lobby',DEFAULT_CONFIG,'individual','LIMA');
 assert.deepEqual(data().sessions[room].teamComposition,assignments);
 await api.saveTeamComposition(waiting,{[ids[a]]:'3'});
 assert.deepEqual((await api.getDefaultTeamComposition()).teamComposition,assignments);
 for(const name of [a,r,z]) {
  await api.loginEmail(email(name));await api.joinSession(room,name);
  await api.joinSession(waiting,name);await api.joinSession(neverStarted,name);
 }
 await api.loginGoogle();await api.closeSession(neverStarted);
 const list=async()=>(await api.listTeamUsers()).users;
 assert.deepEqual((await list()).find(person=>person.uid===ids[a]).playedSessionCodes,[]);
 await api.startSession(room);
 assert.deepEqual((await list()).find(person=>person.uid===ids[a]).playedSessionCodes,[room]);
 assert.equal(data().sessions[room].teamOpponents[ids[a]],ids[r]);
 await api.loginEmail(email(a));
 const plan={variety:4,quantity:60,cap:10};
 await api.saveOrder(room,0,plan);await api.saveOrder(room,1,plan);
 await assert.rejects(api.deleteRegisteredUsers([ids[r]]),/platform owner/);
 await api.loginEmail(email('teacher'));
 assert.deepEqual((await list()).find(person=>person.uid===ids[a]).playedSessionCodes,[]);
 const teacherRoom=await api.createSession('Course',DEFAULT_CONFIG,'individual','KYOTO');
 const privateRoom=await api.createSession('Rehearsal',DEFAULT_CONFIG,'solo','SOLO');
 await api.joinSession(privateRoom,'Teacher');
 await assert.rejects(api.deleteRegisteredUsers([ids[r]]),/platform owner/);
 await api.loginGoogle();
 const result=(uid,index)=>{
  const d=data();
  return competitorResult({...d.sessions[room],aiOrders:d.aiOrders[room]},index,d.orders[room],uid);
 };
 const humanResult=result(ids[a],0), aiResult=result(ids[a],1), opponentResult=result(ids[r],0);
 assert.deepEqual(await api.deleteRegisteredUsers([ids[a]]),{deletedUids:[ids[a]],protectedUids:[]});
 assert.ok(!(await list()).some(person=>person.uid===ids[a]));
 assert.equal(data().sessions[room].assignments[ids[z]],ids[z]);
 assert.equal(data().sessions[room].teamOpponents[ids[r]],ids[z]);
 assert.deepEqual(result(ids[z],0),humanResult);assert.deepEqual(result(ids[z],1),aiResult);
 assert.deepEqual(result(ids[r],0),opponentResult);
 assert.ok(!Object.hasOwn(data().sessions[waiting].teamComposition,ids[a]));
 assert.ok(!Object.hasOwn((await api.getDefaultTeamComposition()).teamComposition,ids[a]));
 await api.loginEmail(email(a));const replacementUid=api.currentUser().uid;
 assert.notEqual(replacementUid,ids[a]);assert.deepEqual(await api.playHistory(),[]);
 await api.loginGoogle();await api.closeSession(room);
 const bulk=[ids[z],ids[r],ids.teacher,replacementUid,owner,alias];
 const expected={deletedUids:bulk.slice(0,4),protectedUids:[owner,alias]};
 assert.deepEqual(await api.deleteRegisteredUsers(bulk),expected);
 assert.deepEqual(await api.deleteRegisteredUsers(bulk),expected);
 assert.deepEqual((await list()).map(person=>person.uid).sort(),[owner,alias].sort());
 assert.deepEqual((await api.getDefaultTeamComposition()).teamComposition,{});
 assert.equal(data().sessions[teacherRoom].owner,owner);
 assert.equal(data().sessions[privateRoom],undefined);
 assert.ok(!(await api.listInstructors()).includes(email('teacher')));
 assert.deepEqual(result(ids[z],0),humanResult);assert.deepEqual(result(ids[r],0),opponentResult);
 assert.ok((await api.readParticipants(room)).every(person=>person.email==='' && person.name==='Deleted user'));
});
