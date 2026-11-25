import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {studioScreen} from '../studio-startup.js';

const source=readFileSync(new URL('../studio-network.js',import.meta.url),'utf8')
 .replace(/^import \{([^}]+)\} from '[^']+';/gm,'const {$1}=globalThis.studioNetworkTest;');

async function bootstrap(label,user,screen){
 const reads=[],auth={currentUser:user,authStateReady:async()=>{}};
 globalThis.location=new URL('https://example.test/admin/?studio='+screen);
 globalThis.studioNetworkTest={app:{},auth,getFirestore:()=>({}),getFunctions:()=>({}),
  httpsCallable:(_,name)=>async input=>{reads.push(name+'/'+input.screen);return {data:{}};},studioScreen,
  collection:(_,path)=>path,doc:(_,path)=>path,where:()=>null,query:path=>path,
  getDoc:async path=>{reads.push(path);return {exists:()=>false,data:()=>null};},
  getDocs:async path=>{reads.push(path);return {docs:[]};},
  ADMIN_EMAIL:'owner@example.test',DATABASE:'test',firebaseConfig:{},DEFAULT_CONFIG:{}};
 const module=await import('data:text/javascript;base64,'+Buffer.from(source+'\n// '+label).toString('base64'));
 module.preloadStudio();
 return {auth,reads,take:()=>module.takeStudioStartup(user,screen||'staff')};
}

test('early studio reads match each screen and are consumed once per navigation',async()=>{
 const user={uid:'owner',email:'owner@example.test',emailVerified:true};
 for(const [screen,expected] of [['',['profiles','settings','sessions']],['ai',['profiles','readStudioPanel/ai']],
  ['teams',['profiles','sessions','studioTeamDefaults','readStudioPanel/teams']]]){
  const run=await bootstrap('reads '+screen,user,screen);
  const result=await run.take();
  assert.equal(result.role,'admin');
  await Promise.all([result.profile,...Object.values(result.reads)]);
  assert.deepEqual(run.reads.toSorted(),expected.toSorted());
  assert.equal(await run.take(),null);
 }
});

test('early studio reads require verified access and are discarded across account changes',async()=>{
 const user={uid:'owner',email:'owner@example.test',emailVerified:true};
 const changed=await bootstrap('changed',user,'teams');
 changed.auth.currentUser={...user,uid:'other'};
 assert.equal(await changed.take(),null);
 for(const [label,account,expected] of [['unverified',{...user,emailVerified:false},[]],
  ['student',{...user,email:'student@example.test'},['instructors']]]){
  const run=await bootstrap(label,account,'teams');
  assert.equal(await run.take(),null);
  assert.deepEqual(run.reads,expected);
 }
});
