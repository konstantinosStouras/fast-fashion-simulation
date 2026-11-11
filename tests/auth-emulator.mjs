import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {applyActionCode,confirmPasswordReset,getAuth,connectAuthEmulator} from 'firebase/auth';
import {getApp,deleteApp} from 'firebase/app';
import {connectFirestoreEmulator,getFirestore,doc,setDoc,serverTimestamp,getDoc,disableNetwork,enableNetwork,Timestamp} from 'firebase/firestore';
import {initializeTestEnvironment} from '@firebase/rules-unit-testing';
test('real backend registration stores profile and sends a working verification link',async t=>{
 assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST,'127.0.0.1:9198','Must run inside the local emulator suite');
 let source=readFileSync(new URL('../backend.js',import.meta.url),'utf8');
 for(const component of ['app','auth','firestore'])source=source.replace(`https://www.gstatic.com/firebasejs/12.5.0/firebase-${component}.js`,import.meta.resolve('firebase/'+component));
 source=source.replace("import {firebaseConfig,DATABASE,ADMIN_EMAIL} from './firebase-config.js';","const firebaseConfig={projectId:'demo-fashion-futures',apiKey:'demo-api-key',authDomain:'demo-fashion-futures.firebaseapp.com'},DATABASE='(default)',ADMIN_EMAIL='kstouras@gmail.com';");
 source=source.replace("'./competition.js'",JSON.stringify(new URL('../competition.js',import.meta.url).href)).replace("'./model.js'",JSON.stringify(new URL('../model.js',import.meta.url).href)).replace("'./profile.js?v=qa-20261110'",JSON.stringify(new URL('../profile.js',import.meta.url).href));
 source=source.replace("'./auth-identity.js'",JSON.stringify(new URL('../auth-identity.js',import.meta.url).href));
 source=source.replace("'./auth-identity.js?v=multi-admin-1'",JSON.stringify(new URL('../auth-identity.js',import.meta.url).href));
 source=source.replace("'./competition.js?v=qa-20261111'",JSON.stringify(new URL('../competition.js',import.meta.url).href));
 source=source.replace("'./auth-flow.js?v=mobile-auth-9'",JSON.stringify(new URL('../auth-flow.js',import.meta.url).href));
 const api=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 const app=getApp('fashion-futures');connectAuthEmulator(getAuth(app),'http://127.0.0.1:9198',{disableWarnings:true});connectFirestoreEmulator(getFirestore(app),'127.0.0.1',8180);t.after(()=>deleteApp(app));
 globalThis.location={href:'https://www.stouras.com/fast-fashion-simulation/?session=abcd-efgh'};t.after(()=>delete globalThis.location);
 const email='emulator-'+Date.now()+'@example.test',p={firstName:'Test',lastName:'Student',universityId:'QA-ONLY'};
 const outcome=await api.register(email,'emulator-only-password',p);assert.deepEqual(outcome,{profileSaved:true,verificationSent:true});assert.equal(api.currentUser().emailVerified,false);assert.deepEqual(await api.getProfile(),p);
 const codes=await fetch('http://127.0.0.1:9198/emulator/v1/projects/demo-fashion-futures/oobCodes').then(r=>r.json());const code=codes.oobCodes.find(c=>c.email===email&&c.requestType==='VERIFY_EMAIL');assert.ok(code);assert.ok(code.oobLink);assert.equal(code.continueUrl||new URL(code.oobLink).searchParams.get('continueUrl'),'https://www.stouras.com/fast-fashion-simulation/?session=ABCDEFGH&auth=verify');
 await applyActionCode(getAuth(app),code.oobCode);await api.refreshUser();assert.equal(api.currentUser().emailVerified,true);
 await api.importPlatformProfile({getItem:()=>JSON.stringify({v:1,ts:Date.now()-1000,sim:'ffo',profile:{email,industry:'Education',age:'31',studentId:'QA-ONLY'}})});
 await api.saveProfile({...p,firstName:'Edited'});assert.equal((await api.getProfile()).platformRegistration.industry,'Education');
 await api.resetPassword(email);const reset=await fetch('http://127.0.0.1:9198/emulator/v1/projects/demo-fashion-futures/oobCodes').then(r=>r.json());const resetCode=reset.oobCodes.find(c=>c.email===email&&c.requestType==='PASSWORD_RESET');assert.ok(resetCode);assert.equal(resetCode.continueUrl||new URL(resetCode.oobLink).searchParams.get('continueUrl'),'https://www.stouras.com/fast-fashion-simulation/?session=ABCDEFGH&auth=login');
 const solo=await api.createSession('Solo backend QA',(await import('../model.js')).DEFAULT_CONFIG,'solo');await api.joinSession(solo,'Test Student');await api.startSession(solo);await api.saveOrder(solo,0,{variety:4,quantity:70,cap:0});const history=await api.playHistory();assert.equal(history[0].mode,'solo');assert.equal(history[0].orders[0].quantity,70);
 const env=await initializeTestEnvironment({projectId:'demo-fashion-futures',firestore:{host:'127.0.0.1',port:8180}});t.after(()=>env.cleanup());
 await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'instructors',email),{createdAt:serverTimestamp()}));
 const uid=api.currentUser().uid,team=await api.createSession('Atomic team backend QA',(await import('../model.js')).DEFAULT_CONFIG,'team');
 await api.joinSession(team,'Test Student');assert.equal((await getDoc(doc(getFirestore(app),'sessions',team))).data().rosterVersion,1);
 await api.joinSession(team,'Test Student');assert.equal((await getDoc(doc(getFirestore(app),'sessions',team))).data().rosterVersion,1,'Rejoining is idempotent');
 await api.saveTeams(team,{[uid]:uid},{[uid]:'Team A'});await api.startSession(team);await api.saveOrder(team,0,{variety:4,quantity:101,cap:0});
 assert.equal((await api.readOrders(team,uid))[0].quantity,101);assert.equal((await api.playHistory()).length,2);
 await Promise.all([
  new Promise((resolve,reject)=>{const stop=api.watchOrders(team,uid,o=>{if(o[0]?.quantity===101){stop();resolve();}},reject);t.after(stop);}),
  new Promise((resolve,reject)=>{const stop=api.watchParticipants(team,p=>{if(p.some(x=>x.uid===uid)){stop();resolve();}},reject);t.after(stop);})
 ]);
 await t.test('team listeners distinguish offline and pending data, then restore server decisions',async()=>{
  const db=getFirestore(app),wait=async fn=>{for(let i=0;i<200;i++){if(fn())return;await new Promise(r=>setTimeout(r,50));}throw Error('Recovery timed out');};
  let fresh=null,sessionFresh=null,latest=null,missingCalls=0;
  const stop=api.watchOrders(team,uid,o=>latest=o,assert.fail,value=>fresh=value),stopSession=api.watchSession(team,()=>{},assert.fail,value=>sessionFresh=value);
  await wait(()=>fresh===true&&sessionFresh===true&&latest?.[0]?.quantity===101);
  await disableNetwork(db);await wait(()=>fresh===false&&sessionFresh===false);
  const missing=api.watchSession('ZZZZZZZZ',()=>missingCalls++,()=>{},()=>{});
  await assert.rejects(api.readMarketOrders(team,[uid],[0]),'shared market must not silently use cached orders');
  let acknowledged=false;const pending=api.saveOrder(team,0,{variety:4,quantity:119,cap:0},'plan',1).then(()=>acknowledged=true);
  await new Promise(r=>setTimeout(r,100));assert.equal(acknowledged,false);assert.equal(latest[0].quantity,101);assert.equal(missingCalls,0,'an uncached offline session is not a deleted session');missing();
  await enableNetwork(db);await pending;await wait(()=>fresh===true&&sessionFresh===true&&latest[0].quantity===119);
  await disableNetwork(db);await wait(()=>fresh===false);
  await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'sessions',team,'participants',uid,'orders','0'),{variety:4,quantity:127,cap:0,savedAt:serverTimestamp()}));
  await enableNetwork(db);await wait(()=>fresh===true&&latest[0].quantity===127);
  stop();stopSession();assert.equal((await api.readOrders(team,uid))[0].quantity,127);
 });
 await t.test('real save API carries its original phase and cannot reset a locked plan',async()=>{
  await env.withSecurityRulesDisabled(async c=>{const ref=doc(c.firestore(),'sessions',team),snapshot=await getDoc(ref);await setDoc(ref,{...snapshot.data(),startedAt:Timestamp.fromMillis(Date.now()-95000)});});
  await api.saveOrder(team,0,{variety:4,quantity:127,cap:35},'respond');
  await assert.rejects(api.saveOrder(team,0,{variety:4,quantity:127,cap:0},'plan',1));
  assert.equal((await api.readOrders(team,uid))[0].cap,35);
  assert.equal((await api.readMarketOrders(team,[uid],[0]))[uid][0].cap,35);
 });
 await t.test('two real backend instances reject an offline stale revision with an actionable conflict',async()=>{
  const secondSource=source.replace("initializeApp(firebaseConfig,'fashion-futures')","initializeApp(firebaseConfig,'fashion-futures-second-device')");
  const other=await import('data:text/javascript;base64,'+Buffer.from(secondSource).toString('base64')),otherApp=getApp('fashion-futures-second-device'),otherDb=getFirestore(otherApp);
  connectAuthEmulator(getAuth(otherApp),'http://127.0.0.1:9198',{disableWarnings:true});connectFirestoreEmulator(otherDb,'127.0.0.1',8180);t.after(()=>deleteApp(otherApp));await other.loginEmail(email,'emulator-only-password');
  const code=await api.createSession('Two device race QA',(await import('../model.js')).DEFAULT_CONFIG,'team');await api.joinSession(code,'Captain');await api.saveTeams(code,{[uid]:uid},{[uid]:'Team A'});await api.startSession(code);
  await api.saveOrder(code,0,{variety:4,quantity:110,cap:0},'plan',0);assert.equal((await other.readOrders(code,uid))[0].revision,1);
  await disableNetwork(otherDb);const stale=assert.rejects(other.saveOrder(code,0,{variety:4,quantity:90,cap:0},'plan',1),e=>e.code==='decision-conflict');
  await api.saveOrder(code,0,{variety:4,quantity:155,cap:0},'plan',1);await enableNetwork(otherDb);await stale;
  assert.equal((await other.readOrders(code,uid))[0].quantity,155);assert.equal((await api.readOrders(code,uid))[0].revision,2);
  await other.saveOrder(code,0,{variety:4,quantity:160,cap:0},'plan',2);assert.equal((await api.readOrders(code,uid))[0].quantity,160);
  await other.logout();
 });
 await t.test('deletion notifies open and offline clients and server reads cannot resurrect cached results',async()=>{
  const {onSnapshot,getDocs,collection}=await import('firebase/firestore');
  const code=await api.createSession('Delete recovery QA',(await import('../model.js')).DEFAULT_CONFIG,'team');await api.joinSession(code,'Captain');await api.saveTeams(code,{[uid]:uid},{[uid]:'Team A'});await api.startSession(code);await api.saveOrder(code,0,{variety:4,quantity:135,cap:0});await api.closeSession(code);
  const offline=env.authenticatedContext(uid,{email,email_verified:true}).firestore(),ref=doc(offline,'sessions',code),wait=async fn=>{for(let i=0;i<200;i++){if(fn())return;await new Promise(r=>setTimeout(r,25));}throw Error('Deletion notification timed out');};
  let seen=null,missing=false,marked=false;const stopOffline=onSnapshot(ref,{includeMetadataChanges:true},snap=>{if(!snap.metadata.fromCache&&!snap.metadata.hasPendingWrites)seen=snap.exists()?snap.data():null;});
  const stop=api.watchSession(code,s=>{if(s?.deletedAt)marked=true;if(s===null)missing=true;},assert.fail);
  try{
   await wait(()=>seen?.status==='closed');await disableNetwork(offline);
   await api.deleteSession(code);await wait(()=>missing);assert.equal(marked,true,'marker is confirmed before cleanup ends');
   assert.equal(seen.status,'closed','offline SDK still has old cache until reconnect');await enableNetwork(offline);await wait(()=>seen===null);
   await assert.rejects(api.readMarketOrders(code,[uid],[0]),e=>e.code==='session-deleted');
   assert.equal((await api.playHistory()).some(s=>s.code===code),false);
   await env.withSecurityRulesDisabled(async c=>{assert.equal((await getDocs(collection(c.firestore(),'sessions',code,'participants'))).size,0);});
   await assert.rejects(api.saveOrder(code,0,{variety:4,quantity:199,cap:0},'plan',1));
  }finally{await enableNetwork(offline);stopOffline();stop();await offline.terminate();}
 });
 await confirmPasswordReset(getAuth(app),resetCode.oobCode,'emulator-reset-password');await api.logout();await assert.rejects(api.loginEmail(email,'emulator-only-password'));await api.loginEmail(email,'emulator-reset-password');assert.equal((await api.getProfile()).firstName,'Edited');await api.logout();
});
