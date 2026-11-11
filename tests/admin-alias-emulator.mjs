import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {getApp,deleteApp} from 'firebase/app';
import {getAuth,connectAuthEmulator,GoogleAuthProvider,signInWithCredential,confirmPasswordReset} from 'firebase/auth';

test('Google, Gmail/password and admin alias retain one Firebase UID and admin role',async t=>{
 assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST,'127.0.0.1:9198');
 let source=readFileSync(new URL('../backend.js',import.meta.url),'utf8');
 for(const component of ['app','auth','firestore'])source=source.replace(`https://www.gstatic.com/firebasejs/12.5.0/firebase-${component}.js`,import.meta.resolve('firebase/'+component));
 source=source.replace("import {firebaseConfig,DATABASE,ADMIN_EMAIL} from './firebase-config.js';","const firebaseConfig={projectId:'demo-fashion-futures',apiKey:'demo-api-key',authDomain:'demo-fashion-futures.firebaseapp.com'},DATABASE='(default)',ADMIN_EMAIL='kstouras@gmail.com';");
 for(const name of ['model','profile','auth-identity','competition'])source=source.replace(`'./${name}.js'`,JSON.stringify(new URL(`../${name}.js`,import.meta.url).href));
 source=source.replace("'./profile.js?v=qa-20261110'",JSON.stringify(new URL('../profile.js',import.meta.url).href));
 const api=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 const app=getApp('fashion-futures'),auth=getAuth(app);connectAuthEmulator(auth,'http://127.0.0.1:9198',{disableWarnings:true});t.after(()=>deleteApp(app));
 const credential=GoogleAuthProvider.credential(JSON.stringify({sub:'alias-test-google-user',email:'kstouras@gmail.com',email_verified:true}));
 await signInWithCredential(auth,credential);const uid=api.currentUser().uid;
 assert.equal(await api.role(),'admin');
 await api.resetPassword(' ADMIN@ADMIN.COM ');
 const codes=await fetch('http://127.0.0.1:9198/emulator/v1/projects/demo-fashion-futures/oobCodes').then(r=>r.json());
 const reset=codes.oobCodes.find(c=>c.requestType==='PASSWORD_RESET'&&c.email==='kstouras@gmail.com');
 assert.ok(reset);assert.ok(!codes.oobCodes.some(c=>c.email==='admin@admin.com'));
 await confirmPasswordReset(auth,reset.oobCode,'emulator-only-admin-password');await api.logout();
 await assert.rejects(api.loginEmail('admin@admin.com','incorrect-password'));
 for(const email of ['admin@admin.com','kstouras@gmail.com',' ADMIN@ADMIN.COM ']){
  await api.loginEmail(email,'emulator-only-admin-password');
  assert.equal(api.currentUser().uid,uid);assert.equal(api.currentUser().email,'kstouras@gmail.com');assert.equal(api.currentUser().emailVerified,true);assert.equal(await api.role(),'admin');
  await api.logout();
 }
 await signInWithCredential(auth,credential);assert.equal(api.currentUser().uid,uid);assert.equal(await api.role(),'admin');
 assert.deepEqual(api.currentUser().providerData.map(p=>p.providerId).sort(),['google.com','password']);
 await assert.rejects(api.register('admin@admin.com','unused',{}),{code:'auth/reserved-admin-alias'});
 assert.throws(()=>api.changeEmail('admin@admin.com'),{code:'auth/reserved-admin-alias'});
 const accounts=await fetch('http://127.0.0.1:9198/identitytoolkit.googleapis.com/v1/projects/demo-fashion-futures/accounts:batchGet',{headers:{Authorization:'Bearer owner'}}).then(r=>r.json());
 assert.equal(accounts.users.filter(u=>['kstouras@gmail.com','admin@admin.com'].includes(u.email)).length,1);
});
