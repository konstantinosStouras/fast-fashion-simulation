const {equal:assertEqual}=require('node:assert/strict');
const {test,before,after,beforeEach}=require('node:test');
const fs=require('node:fs');
const {initializeTestEnvironment,assertSucceeds,assertFails}=require('@firebase/rules-unit-testing');
const {doc,setDoc,getDoc,getDocs,collection,updateDoc,serverTimestamp,Timestamp,writeBatch,runTransaction,deleteDoc}=require('firebase/firestore');
let env;const clients=[];
const config={demandMean:480,demandSd:96,forecastSd:.2,rebound:.2,price:40,initialCost:12,refillCost:16,styleCost:150,salvage:5,unitCarbon:5,leftoverCarbon:1};
const db=(uid,email=uid+'@example.test',verified=true)=>{const client=env.authenticatedContext(uid,{email,email_verified:verified}).firestore();clients.push(client);return client;};
const admin=()=>db('admin','kstouras@gmail.com');
const path=(uid='alice',r='0')=>`sessions/ABCDEFGH/participants/${uid}/orders/${r}`;
const order=(more={})=>({variety:4,quantity:80,cap:0,phase:'plan',revision:1,savedAt:serverTimestamp(),...more});
async function seed(elapsed=null,extra={}){await env.withSecurityRulesDisabled(async c=>{const d=c.firestore();await setDoc(doc(d,'instructors/teacher@example.test'),{createdAt:Timestamp.now()});await setDoc(doc(d,'sessions/ABCDEFGH'),{name:'QA',owner:'teacher',config,seed:42,status:elapsed===null?'lobby':'running',createdAt:Timestamp.now(),startedAt:elapsed===null?null:Timestamp.fromMillis(Date.now()-elapsed*1000),closedAt:null,...extra});for(const uid of ['alice','bob'])await setDoc(doc(d,`sessions/ABCDEFGH/participants/${uid}`),{name:uid,email:uid+'@example.test',joinedAt:Timestamp.now()});});}
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-fashion-futures',firestore:{host:'127.0.0.1',port:8180,rules:fs.readFileSync('firestore.rules','utf8')}});});
beforeEach(async()=>{await env.clearFirestore();});
after(async()=>{try{await Promise.all(clients.map(client=>client.terminate()));}finally{await env.cleanup();}});
test('anonymous and unverified accounts cannot read or join',async()=>{await seed();for(const d of [env.unauthenticatedContext().firestore(),db('alice','alice@example.test',false)]){await assertFails(getDoc(doc(d,'sessions/ABCDEFGH')));await assertFails(setDoc(doc(d,'sessions/ABCDEFGH/participants/charlie'),{name:'X',email:'charlie@example.test',joinedAt:serverTimestamp()}));}});
test('verified student can join lobby but not after start',async()=>{await seed();const d=db('charlie');await assertSucceeds(setDoc(doc(d,'sessions/ABCDEFGH/participants/charlie'),{name:'Charlie',email:'charlie@example.test',joinedAt:serverTimestamp()}));await seed(10);await assertFails(setDoc(doc(db('new'),'sessions/ABCDEFGH/participants/new'),{name:'New',email:'new@example.test',joinedAt:serverTimestamp()}));});
test('students cannot list sessions, rosters or another participant decisions',async()=>{await seed();await assertSucceeds(getDoc(doc(db('alice'),'sessions/ABCDEFGH')));await assertFails(getDocs(collection(db('alice'),'sessions')));await assertFails(getDocs(collection(db('alice'),'sessions/ABCDEFGH/participants')));await assertFails(getDoc(doc(db('alice'),path('bob'))));});
test('only admin grants instructors and edits defaults; unverified admin denied',async()=>{await assertFails(setDoc(doc(db('alice'),'instructors/alice@example.test'),{createdAt:serverTimestamp()}));await assertFails(setDoc(doc(db('admin','kstouras@gmail.com',false),'instructors/teacher@example.test'),{createdAt:serverTimestamp()}));await assertSucceeds(setDoc(doc(admin(),'instructors/teacher@example.test'),{createdAt:serverTimestamp()}));await assertSucceeds(setDoc(doc(admin(),'settings/defaults'),config));await assertFails(setDoc(doc(db('teacher'),'settings/defaults'),config));await assertFails(setDoc(doc(admin(),'settings/defaults'),{...config,salvage:100}));});
test('session creation validates role, ownership and config',async()=>{await seed();const s={name:'Test',owner:'teacher',config,seed:10,status:'lobby',createdAt:serverTimestamp(),startedAt:null,closedAt:null};await assertSucceeds(setDoc(doc(db('teacher'),'sessions/BCDEFGHJ'),s));await assertFails(setDoc(doc(db('alice'),'sessions/CDEFGHJK'),{...s,owner:'alice'}));await assertFails(setDoc(doc(db('teacher'),'sessions/CDEFGHJK'),{...s,config:{...config,demandSd:-2}}));});
test('session owner controls start; settings and timestamp cannot be forged',async()=>{await seed();await assertFails(updateDoc(doc(db('alice'),'sessions/ABCDEFGH'),{status:'running',startedAt:serverTimestamp()}));await assertSucceeds(updateDoc(doc(db('teacher'),'sessions/ABCDEFGH'),{status:'running',startedAt:serverTimestamp()}));await assertFails(updateDoc(doc(db('teacher'),'sessions/ABCDEFGH'),{config:{...config,rebound:1}}));await assertFails(updateDoc(doc(db('teacher'),'sessions/ABCDEFGH'),{startedAt:serverTimestamp()}));});
test('own in-window initial order allowed; forged totals, decimals and another uid denied',async()=>{await seed(20);const d=db('alice');await assertSucceeds(setDoc(doc(d,path()),order()));await assertFails(setDoc(doc(d,path()),order({profit:999999})));await assertFails(setDoc(doc(d,path()),order({quantity:4.5})));await assertFails(setDoc(doc(d,path()),order({variety:8})));await assertFails(setDoc(doc(d,path('bob')),order()));});
test('replenishment can change only cap; missing plan uses locked defaults',async()=>{await seed(20);const d=db('alice');await assertSucceeds(setDoc(doc(d,path()),order({quantity:70})));await seed(110);await assertSucceeds(setDoc(doc(d,path()),order({quantity:70,cap:60,phase:'respond',revision:2})));await assertFails(setDoc(doc(d,path()),order({quantity:100,cap:60,phase:'respond',revision:3})));await assertSucceeds(setDoc(doc(db('bob'),path('bob')),order({cap:50,phase:'respond'})));await assertFails(setDoc(doc(db('bob'),path('bob')),order({quantity:90,cap:50,phase:'respond',revision:2})));});
test('closed, expired, future and traditional-response decisions rejected',async()=>{await seed(200);await assertFails(setDoc(doc(db('alice'),path()),order()));await assertFails(setDoc(doc(db('alice'),path('alice','2')),order()));await assertSucceeds(setDoc(doc(db('alice'),path('alice','1')),order()));await assertFails(setDoc(doc(db('alice'),path('alice','1')),order({cap:1})));await seed(1090);await assertFails(setDoc(doc(db('alice'),path('alice','3')),order({variety:8})));await seed(20,{status:'closed',closedAt:Timestamp.now()});await assertFails(setDoc(doc(db('alice'),path()),order()));});
test('instructors cannot read another instructor roster; admin can',async()=>{await seed();await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'instructors/other@example.test'),{createdAt:Timestamp.now()}));await assertSucceeds(getDocs(collection(db('teacher'),'sessions/ABCDEFGH/participants')));await assertFails(getDocs(collection(db('other'),'sessions/ABCDEFGH/participants')));await assertSucceeds(getDocs(collection(admin(),'sessions/ABCDEFGH/participants')));});

test('private profiles work before verification but cannot grant roles or expose other students',async()=>{
 const alice=db('alice','alice@example.test',false),p={firstName:'Ada',lastName:'Lovelace',universityId:'123'};
 await assertSucceeds(setDoc(doc(alice,'profiles/alice'),p));
 await assertSucceeds(getDoc(doc(alice,'profiles/alice')));
 await assertFails(getDoc(doc(db('bob'),'profiles/alice')));
 await assertFails(getDoc(doc(admin(),'profiles/alice')));
 await assertFails(setDoc(doc(alice,'profiles/alice'),{...p,role:'admin'}));
 await assertFails(setDoc(doc(alice,'profiles/alice'),{...p,password:'secret'}));
 await assertFails(getDocs(collection(alice,'profiles')));
 await assertFails(setDoc(doc(alice,'profiles/alice'),{...p,firstName:''}));
});
test('profile edits preserve portal data while imports cannot carry permissions',async()=>{
 const d=db('alice'),ref=doc(d,'profiles/alice'),p={firstName:'Ada',lastName:'Lovelace',universityId:'123'};
 await assertSucceeds(setDoc(ref,{...p,platformRegistration:{email:'alice@example.test',age:'30',industry:'Education'}}));
 await assertSucceeds(setDoc(ref,{firstName:'Updated'},{merge:true}));
 assertEqual((await getDoc(ref)).data().platformRegistration.industry,'Education');
 await assertFails(setDoc(ref,{platformRegistration:{approved:true}},{merge:true}));
 await assertFails(setDoc(ref,{platformRegistration:{age:{nested:'invalid'}}},{merge:true}));
});
test('play-history references require real membership and cannot forge scores',async()=>{
 await seed();const d=db('alice'),ref=doc(d,'profiles/alice/sessions/ABCDEFGH');
 await assertSucceeds(setDoc(ref,{joined:true}));await assertSucceeds(getDocs(collection(d,'profiles/alice/sessions')));
 await assertFails(getDocs(collection(db('bob'),'profiles/alice/sessions')));
 await assertFails(setDoc(doc(d,'profiles/alice/sessions/NOTREALX'),{joined:true}));
 await assertFails(setDoc(ref,{joined:true,profit:999999}));
});

test('solo students create and run their own game but cannot invite others or change locked parameters',async()=>{const d=db('alice'),ref=doc(d,'sessions/ABCDEFGH');await assertSucceeds(setDoc(ref,{name:'Solo',owner:'alice',mode:'solo',assignments:{},teamNames:{},config,seed:8,status:'lobby',createdAt:serverTimestamp(),startedAt:null,closedAt:null}));await assertFails(setDoc(doc(db('bob'),'sessions/ABCDEFGH/participants/bob'),{name:'Bob',email:'bob@example.test',joinedAt:serverTimestamp()}));await assertSucceeds(setDoc(doc(d,'sessions/ABCDEFGH/participants/alice'),{name:'Alice',email:'alice@example.test',joinedAt:serverTimestamp()}));await assertSucceeds(updateDoc(ref,{status:'running',startedAt:serverTimestamp()}));await assertSucceeds(setDoc(doc(d,path()),order()));await assertFails(updateDoc(ref,{seed:999}));});
test('team captain submits, teammates read shared decisions, rivals see only completed scored rounds',async()=>{await seed(20,{mode:'team',assignments:{alice:'alice',bob:'alice',charlie:'charlie'},teamNames:{alice:'Team A',charlie:'Team B'}});await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'sessions/ABCDEFGH/participants/charlie'),{name:'Charlie',email:'charlie@example.test',joinedAt:Timestamp.now()}));await assertSucceeds(setDoc(doc(db('alice'),path()),order()));await assertSucceeds(getDocs(collection(db('bob'),'sessions/ABCDEFGH/participants/alice/orders')));await assertFails(setDoc(doc(db('bob'),path('bob')),order()));await assertFails(setDoc(doc(db('bob'),path('alice')),order()));await assertFails(getDoc(doc(db('charlie'),path('alice'))));await assertFails(getDocs(collection(db('charlie'),'sessions/ABCDEFGH/participants/alice/orders')));await seed(430,{mode:'team',assignments:{alice:'alice',bob:'bob'},teamNames:{alice:'Team A',bob:'Team B'}});await assertSucceeds(getDoc(doc(db('bob'),path('alice','1'))));await assertFails(getDoc(doc(db('bob'),path('alice','2'))));await assertFails(getDoc(doc(db('outsider'),path('alice','1'))));await seed(430,{mode:'team',assignments:{alice:'alice',bob:'bob'},teamNames:{alice:'Team A',bob:'Team B'},status:'closed',closedAt:Timestamp.fromMillis(Date.now()-300000)});await assertFails(getDoc(doc(db('bob'),path('alice','1'))));});
test('only owning instructor assigns teams in lobby; assignments freeze at start',async()=>{await seed(null,{mode:'team',assignments:{},teamNames:{}});const change={assignments:{alice:'alice',bob:'alice'},teamNames:{alice:'Team A'}};await assertFails(updateDoc(doc(db('alice'),'sessions/ABCDEFGH'),change));await assertSucceeds(updateDoc(doc(db('teacher'),'sessions/ABCDEFGH'),change));await assertSucceeds(updateDoc(doc(db('teacher'),'sessions/ABCDEFGH'),{status:'running',startedAt:serverTimestamp()}));await assertFails(updateDoc(doc(db('teacher'),'sessions/ABCDEFGH'),{assignments:{}}));});

test('shared-market reads unlock only when initial orders are locked, without exposing the roster',async()=>{const extra={mode:'team',assignments:{alice:'alice',bob:'bob'},teamNames:{alice:'A',bob:'B'}};await seed(80,extra);await assertFails(getDoc(doc(db('bob'),path('alice','0'))));await seed(100,extra);await assertSucceeds(getDoc(doc(db('bob'),path('alice','0'))));await assertFails(getDocs(collection(db('bob'),'sessions/ABCDEFGH/participants')));await seed(550,extra);await assertSucceeds(getDoc(doc(db('bob'),path('alice','2'))));await assertFails(getDoc(doc(db('bob'),path('alice','3'))));});

test('team joins atomically update roster revision and private history; forged revisions fail',async()=>{
 await seed(null,{mode:'team',assignments:{alice:'alice',bob:'alice'},teamNames:{alice:'A'},rosterVersion:0});
 const d=db('charlie'),sessionRef=doc(d,'sessions/ABCDEFGH'),participant=doc(d,'sessions/ABCDEFGH/participants/charlie');
 await assertFails(setDoc(participant,{name:'Charlie',email:'charlie@example.test',joinedAt:serverTimestamp()}));
 await assertFails(updateDoc(sessionRef,{rosterVersion:1}));
 const batch=writeBatch(d);batch.set(participant,{name:'Charlie',email:'charlie@example.test',joinedAt:serverTimestamp()});batch.update(sessionRef,{rosterVersion:1});batch.set(doc(d,'profiles/charlie/sessions/ABCDEFGH'),{joined:true});await assertSucceeds(batch.commit());
 assertEqual((await getDoc(sessionRef)).data().rosterVersion,1);
 await assertFails(updateDoc(sessionRef,{rosterVersion:2}));
 await assertFails(updateDoc(sessionRef,{rosterVersion:0}));
});

test('a student joining during start invalidates the instructor transaction',async()=>{
 await seed(null,{mode:'team',assignments:{alice:'alice',bob:'alice'},teamNames:{alice:'A'},rosterVersion:0});
 const teacher=db('teacher'),ref=doc(teacher,'sessions/ABCDEFGH');let first=true,attempts=0;
 const started=runTransaction(teacher,async tx=>{
  attempts++;const s=(await tx.get(ref)).data();const participants=await getDocs(collection(teacher,'sessions/ABCDEFGH/participants'));
  if(participants.docs.some(d=>!s.assignments[d.id]))throw Error('Unassigned participant');
  if(first){first=false;const student=db('charlie'),batch=writeBatch(student);batch.set(doc(student,'sessions/ABCDEFGH/participants/charlie'),{name:'Charlie',email:'charlie@example.test',joinedAt:serverTimestamp()});batch.update(doc(student,'sessions/ABCDEFGH'),{rosterVersion:1});await batch.commit();}
  tx.update(ref,{status:'running',startedAt:serverTimestamp()});
 });
 await require('node:assert/strict').rejects(started,/Unassigned participant/);assertEqual(attempts>=2,true);assertEqual((await getDoc(ref)).data().status,'lobby');
});


test('deletion is limited to closed sessions and their owning instructor or platform owner',async()=>{
 await seed();await assertFails(deleteDoc(doc(db('teacher'),'sessions/ABCDEFGH')));
 await seed(50,{status:'closed',closedAt:Timestamp.now()});
 await env.withSecurityRulesDisabled(async c=>{const d=c.firestore();await setDoc(doc(d,path()),{variety:4,quantity:80,cap:0});await setDoc(doc(d,'profiles/alice/sessions/ABCDEFGH'),{joined:true});await setDoc(doc(d,'instructors/other@example.test'),{createdAt:Timestamp.now()});});
 for(const actor of [db('alice'),db('other'),db('teacher','teacher@example.test',false)])for(const p of [path(),'sessions/ABCDEFGH/participants/alice','profiles/alice/sessions/ABCDEFGH','sessions/ABCDEFGH'])await assertFails(deleteDoc(doc(actor,p)));
 const d=db('teacher'),batch=writeBatch(d);for(const p of [path(),'profiles/alice/sessions/ABCDEFGH','sessions/ABCDEFGH/participants/alice'])batch.delete(doc(d,p));await assertSucceeds(batch.commit());await assertSucceeds(deleteDoc(doc(d,'sessions/ABCDEFGH')));
 await seed(50,{status:'closed',closedAt:Timestamp.now()});await assertSucceeds(deleteDoc(doc(admin(),'sessions/ABCDEFGH')));
});


test('a delayed initial save cannot reset a replenishment decision, including default quantities',async()=>{
 const team={mode:'team',assignments:{alice:'alice',bob:'alice'},teamNames:{alice:'A'}},captain=db('alice'),mate=db('bob');
 await seed(20,team);await assertSucceeds(setDoc(doc(captain,path()),order()));
 await seed(110,team);await assertSucceeds(setDoc(doc(captain,path()),order({phase:'respond',cap:55,revision:2})));
 await assertFails(setDoc(doc(captain,path()),order({revision:3})));
 const legacy=order({revision:3});delete legacy.phase;await assertFails(setDoc(doc(captain,path()),legacy));
 assertEqual((await getDoc(doc(mate,path()))).data().cap,55);
 await assertSucceeds(setDoc(doc(captain,path()),order({phase:'respond',cap:0,revision:3})));
 await seed(181,team);await assertFails(setDoc(doc(captain,path()),order({phase:'respond',cap:99,revision:4})));
 assertEqual((await getDoc(doc(mate,path()))).data().cap,0);
});

test('every initial and replenishment deadline rejects expired and mismatched phases',async()=>{
 const windows=[['0',0,90,180],['1',180,420,420],['2',420,540,660],['3',660,810,960]];
 for(const [r,start,split,end] of windows){
  await seed(start+10);const ref=doc(db('alice'),path('alice',r));await assertSucceeds(setDoc(ref,order({quantity:91})));
  await assertFails(setDoc(ref,order({quantity:91,revision:2,phase:'respond'})));
  await seed(split+1);await assertFails(setDoc(ref,order({quantity:91,revision:2})));
  if(split<end){await assertSucceeds(setDoc(ref,order({quantity:91,phase:'respond',cap:42,revision:2})));await seed(end+1);await assertFails(setDoc(ref,order({quantity:91,phase:'respond',cap:90,revision:3})));assertEqual((await getDoc(ref)).data().cap,42);}
  else assertEqual((await getDoc(ref)).data().quantity,91);
 }
});

test('offline captain writes arriving after lock are rejected and teammates retain the confirmed order',async()=>{
 const {disableNetwork,enableNetwork,onSnapshot}=require('firebase/firestore');
 const team={mode:'team',assignments:{alice:'alice',bob:'alice'},teamNames:{alice:'A'}},captain=db('alice'),mate=db('bob'),ref=doc(captain,path());
 const wait=async fn=>{for(let i=0;i<200;i++){if(fn())return;await new Promise(r=>setTimeout(r,25));}throw Error('Timed out waiting for teammate');};
 await seed(20,team);await assertSucceeds(setDoc(ref,order({quantity:120})));
 let seen=[];const stop=onSnapshot(doc(mate,path()),{includeMetadataChanges:true},snap=>{if(!snap.metadata.fromCache&&!snap.metadata.hasPendingWrites&&snap.exists())seen.push(snap.data());});
 try{
  await wait(()=>seen.length);await disableNetwork(captain);
  const rejected=assertFails(setDoc(ref,order({quantity:170,revision:2})));
  await seed(110,team);await enableNetwork(captain);await rejected;
  assertEqual((await getDoc(doc(mate,path()))).data().quantity,120);assertEqual(seen.some(o=>o.quantity===170),false);
  await assertSucceeds(setDoc(ref,order({quantity:120,phase:'respond',cap:35,revision:2})));await wait(()=>seen.some(o=>o.cap===35));
  await disableNetwork(captain);const lateResponse=assertFails(setDoc(ref,order({quantity:120,phase:'respond',cap:100,revision:3})));
  await seed(181,team);await enableNetwork(captain);await lateResponse;
  const locked=(await getDoc(doc(mate,path()))).data();assertEqual(locked.quantity,120);assertEqual(locked.cap,35);assertEqual(seen.some(o=>o.cap===100),false);
 }finally{await enableNetwork(captain);stop();}
});


test('two captain devices cannot replay stale offline orders or replenishment over a newer save',async()=>{
 const {disableNetwork,enableNetwork,onSnapshot}=require('firebase/firestore');
 const team={mode:'team',assignments:{alice:'alice',bob:'alice'},teamNames:{alice:'A'}},a=db('alice'),b=db('alice'),mate=db('bob'),refA=doc(a,path()),refB=doc(b,path());
 const wait=async fn=>{for(let i=0;i<200;i++){if(fn())return;await new Promise(r=>setTimeout(r,25));}throw Error('Teammate did not receive saved decision');};
 await seed(20,team);await assertSucceeds(setDoc(refA,order({quantity:110})));await getDoc(refB);
 const seen=[];const stop=onSnapshot(doc(mate,path()),{includeMetadataChanges:true},snap=>{if(snap.exists()&&!snap.metadata.fromCache&&!snap.metadata.hasPendingWrites)seen.push(snap.data());});
 try{
  await wait(()=>seen.length);await disableNetwork(b);
  const stale=assertFails(setDoc(refB,order({quantity:90,revision:2})));
  await assertSucceeds(setDoc(refA,order({quantity:155,revision:2})));await wait(()=>seen.some(o=>o.quantity===155));
  await enableNetwork(b);await stale;assertEqual((await getDoc(refB)).data().quantity,155);assertEqual(seen.some(o=>o.quantity===90),false);
  await seed(110,team);await disableNetwork(b);
  const staleCap=assertFails(setDoc(refB,order({quantity:155,phase:'respond',cap:30,revision:3})));
  await assertSucceeds(setDoc(refA,order({quantity:155,phase:'respond',cap:70,revision:3})));await wait(()=>seen.some(o=>o.cap===70));
  await enableNetwork(b);await staleCap;assertEqual((await getDoc(refB)).data().cap,70);assertEqual(seen.some(o=>o.cap===30),false);
  await assertFails(setDoc(refB,order({quantity:155,phase:'respond',cap:100,revision:9})));
  await assertSucceeds(setDoc(refB,order({quantity:155,phase:'respond',cap:0,revision:4})));await wait(()=>seen.some(o=>o.revision===4));
  assertEqual((await getDoc(doc(mate,path()))).data().cap,0,'A deliberate revision after loading the latest save remains allowed');
 }finally{await enableNetwork(b);stop();}
});

test('simultaneous saves from the same revision accept exactly one winner; old records can upgrade',async()=>{
 const a=db('alice'),b=db('alice'),refA=doc(a,path()),refB=doc(b,path());await seed(20);await assertSucceeds(setDoc(refA,order()));
 const results=await Promise.allSettled([setDoc(refA,order({quantity:111,revision:2})),setDoc(refB,order({quantity:144,revision:2}))]);
 assertEqual(results.filter(r=>r.status==='fulfilled').length,1);assertEqual(results.filter(r=>r.status==='rejected').length,1);
 const saved=(await getDoc(refA)).data();assertEqual(saved.revision,2);assertEqual([111,144].includes(saved.quantity),true);
 await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),path()),{variety:4,quantity:100,cap:0,phase:'plan',savedAt:Timestamp.now()}));
 await assertSucceeds(setDoc(refA,order({quantity:120})));assertEqual((await getDoc(refA)).data().revision,1);
 const legacy=order();delete legacy.revision;await assertFails(setDoc(refB,legacy));
});

test('admin closure rejects queued initial and replenishment saves and freezes every reader',async()=>{
 const {disableNetwork,enableNetwork,getDocFromServer}=require('firebase/firestore');
 const team={mode:'team',assignments:{alice:'alice',bob:'alice'},teamNames:{alice:'A'}};
 for(const phase of ['plan','respond']){
  await env.clearFirestore();await seed(phase==='plan'?200:600,team);
  const captain=db('alice'),mate=db('bob'),teacher=db('teacher'),round=phase==='plan'?'1':'2',ref=doc(captain,path('alice',round));
  const confirmed=order(phase==='plan'?{quantity:120}:{phase,cap:35});await assertSucceeds(setDoc(ref,confirmed));
  await disableNetwork(captain);
  const rejected=assertFails(setDoc(ref,order(phase==='plan'?{quantity:170,revision:2}:{phase,cap:99,revision:2})));
  const room=doc(teacher,'sessions/ABCDEFGH');await assertSucceeds(updateDoc(room,{status:'closed',closedAt:serverTimestamp()}));
  const closedAt=(await getDoc(room)).data().closedAt.toMillis();
  try{
   await enableNetwork(captain);await rejected;
   for(const reader of [captain,mate,teacher]){const saved=(await getDocFromServer(doc(reader,path('alice',round)))).data();assertEqual(saved.quantity,confirmed.quantity);assertEqual(saved.cap,confirmed.cap);assertEqual(saved.revision,1);}
   await assertFails(setDoc(ref,order({...confirmed,revision:2})));
   await assertFails(updateDoc(room,{status:'running'}));await assertFails(updateDoc(room,{closedAt:serverTimestamp()}));
   assertEqual((await getDoc(room)).data().closedAt.toMillis(),closedAt);
  }finally{await enableNetwork(captain);}
 }
});

test('simultaneous admin close and captain save have a stable server-ordered outcome',async()=>{
 const team={mode:'team',assignments:{alice:'alice',bob:'alice'},teamNames:{alice:'A'}};
 await seed(600,team);const captain=db('alice'),teacher=db('teacher'),mate=db('bob'),ref=doc(captain,path('alice','2')),room=doc(teacher,'sessions/ABCDEFGH');
 await assertSucceeds(setDoc(ref,order({phase:'respond',cap:30})));
 const [saved,closed]=await Promise.allSettled([setDoc(ref,order({phase:'respond',cap:60,revision:2})),updateDoc(room,{status:'closed',closedAt:serverTimestamp()})]);
 assertEqual(closed.status,'fulfilled');
 const snapshot=(await getDoc(doc(mate,path('alice','2')))).data(),session=(await getDoc(room)).data();
 assertEqual(snapshot.cap,saved.status==='fulfilled'?60:30);assertEqual(snapshot.savedAt.toMillis()<=session.closedAt.toMillis(),true);
 await assertFails(setDoc(ref,order({phase:'respond',cap:99,revision:snapshot.revision+1})));
 assertEqual((await getDoc(ref)).data().cap,snapshot.cap);
});

test('deletion marker requires closed owner authorization and cannot be forged or removed',async()=>{
 await seed(600,{mode:'team',assignments:{alice:'alice',bob:'alice'},teamNames:{alice:'A'}});
 const teacher=db('teacher'),room=doc(teacher,'sessions/ABCDEFGH');
 await assertFails(updateDoc(room,{deletedAt:serverTimestamp()}));
 await updateDoc(room,{status:'closed',closedAt:serverTimestamp()});
 await assertFails(updateDoc(doc(db('alice'),'sessions/ABCDEFGH'),{deletedAt:serverTimestamp()}));
 await assertFails(updateDoc(doc(db('other'),'sessions/ABCDEFGH'),{deletedAt:serverTimestamp()}));
 await assertFails(updateDoc(room,{deletedAt:Timestamp.fromMillis(1)}));
 await assertSucceeds(updateDoc(room,{deletedAt:serverTimestamp()}));
 assertEqual(!!(await getDoc(doc(db('bob'),'sessions/ABCDEFGH'))).data().deletedAt,true);
 await assertFails(updateDoc(room,{deletedAt:null}));
 await assertFails(updateDoc(room,{deletedAt:serverTimestamp()}));
 await assertFails(setDoc(doc(db('alice'),path()),order()));
 await assertSucceeds(deleteDoc(doc(teacher,'sessions/ABCDEFGH/participants/alice')));
 await assertSucceeds(deleteDoc(room));
 assertEqual((await getDoc(doc(db('bob'),'sessions/ABCDEFGH'))).exists(),false);
});
