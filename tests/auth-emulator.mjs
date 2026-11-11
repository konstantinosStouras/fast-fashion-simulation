import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {applyActionCode,getAuth,connectAuthEmulator} from 'firebase/auth';
import {getApp,deleteApp} from 'firebase/app';
import {connectFirestoreEmulator,getFirestore,doc,setDoc,serverTimestamp,getDoc} from 'firebase/firestore';
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
 const api=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 const app=getApp('fashion-futures');connectAuthEmulator(getAuth(app),'http://127.0.0.1:9198',{disableWarnings:true});connectFirestoreEmulator(getFirestore(app),'127.0.0.1',8180);t.after(()=>deleteApp(app));
 const email='emulator-'+Date.now()+'@example.test',p={firstName:'Test',lastName:'Student',universityId:'QA-ONLY'};
 const outcome=await api.register(email,'emulator-only-password',p);assert.deepEqual(outcome,{profileSaved:true,verificationSent:true});assert.equal(api.currentUser().emailVerified,false);assert.deepEqual(await api.getProfile(),p);
 const codes=await fetch('http://127.0.0.1:9198/emulator/v1/projects/demo-fashion-futures/oobCodes').then(r=>r.json());const code=codes.oobCodes.find(c=>c.email===email&&c.requestType==='VERIFY_EMAIL');assert.ok(code);assert.ok(code.oobLink);
 await applyActionCode(getAuth(app),code.oobCode);await api.refreshUser();assert.equal(api.currentUser().emailVerified,true);
 await api.importPlatformProfile({getItem:()=>JSON.stringify({v:1,ts:Date.now()-1000,sim:'ffo',profile:{email,industry:'Education',age:'31',studentId:'QA-ONLY'}})});
 await api.saveProfile({...p,firstName:'Edited'});assert.equal((await api.getProfile()).platformRegistration.industry,'Education');
 await api.resetPassword(email);const reset=await fetch('http://127.0.0.1:9198/emulator/v1/projects/demo-fashion-futures/oobCodes').then(r=>r.json());assert.ok(reset.oobCodes.some(c=>c.email===email&&c.requestType==='PASSWORD_RESET'));
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
 await api.logout();await api.loginEmail(email,'emulator-only-password');assert.equal((await api.getProfile()).firstName,'Edited');await api.logout();
});
