const test=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {initializeTestEnvironment,assertFails}=require('@firebase/rules-unit-testing');
const {doc,setDoc,getDoc,writeBatch,Timestamp,serverTimestamp,runTransaction,increment}=require('firebase/firestore');

test('500-member classroom: 100 captain writes and 300 result reads with 20 concurrent operations',async t=>{
 assert.equal(process.env.FIRESTORE_EMULATOR_HOST,'127.0.0.1:8180','Run only against the local emulator');
 const env=await initializeTestEnvironment({projectId:'demo-fashion-futures',firestore:{host:'127.0.0.1',port:8180,rules:readFileSync('firestore.rules','utf8')}});t.after(()=>env.cleanup());
 const config={demandMean:480,demandSd:96,forecastSd:.2,rebound:.2,price:40,initialCost:12,refillCost:16,styleCost:150,salvage:5,unitCarbon:5,leftoverCarbon:1};
 const assignments=Object.fromEntries(Array.from({length:500},(_,i)=>['u'+i,'u'+Math.floor(i/5)*5])),teamNames=Object.fromEntries(Array.from({length:100},(_,i)=>['u'+i*5,'Team '+i]));
 await env.withSecurityRulesDisabled(async c=>{
  const d=c.firestore();await setDoc(doc(d,'sessions/STRESSAA'),{name:'Stress',mode:'team',owner:'teacher',config,seed:42,status:'running',createdAt:Timestamp.now(),startedAt:Timestamp.fromMillis(Date.now()-10000),closedAt:null,assignments,teamNames});
  const batch=writeBatch(d);for(let i=0;i<500;i++)batch.set(doc(d,'sessions/STRESSAA/participants/u'+i),{name:'Student '+i,email:'u'+i+'@example.test',joinedAt:Timestamp.now()});await batch.commit();
 });
 const clients=Array.from({length:100},(_,i)=>env.authenticatedContext('u'+i*5,{email:'u'+i*5+'@example.test',email_verified:true}).firestore());
 const timings=[];async function concurrent(count,fn){let next=0;await Promise.all(Array.from({length:20},async()=>{while(next<count){const i=next++,start=performance.now();await fn(i);timings.push(performance.now()-start);}}));}
 await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'sessions/JOINTEST'),{name:'Concurrent joins',mode:'team',owner:'teacher',config,seed:42,status:'lobby',createdAt:Timestamp.now(),startedAt:null,closedAt:null,assignments:{},teamNames:{},rosterVersion:0}));
 await concurrent(100,async i=>{const d=clients[i],uid='u'+i*5;await runTransaction(d,async tx=>{const participant=doc(d,'sessions/JOINTEST/participants',uid);if(!(await tx.get(participant)).exists()){tx.set(participant,{name:uid,email:uid+'@example.test',joinedAt:serverTimestamp()});tx.update(doc(d,'sessions/JOINTEST'),{rosterVersion:increment(1)});}tx.set(doc(d,'profiles',uid,'sessions/JOINTEST'),{joined:true});});});
 assert.equal((await getDoc(doc(clients[0],'sessions/JOINTEST'))).data().rosterVersion,100,'Concurrent joins must not lose roster increments');
 await concurrent(100,i=>setDoc(doc(clients[i],'sessions/STRESSAA/participants/u'+i*5+'/orders/0'),{variety:4,quantity:i+1,cap:0,phase:'plan',revision:1,savedAt:serverTimestamp()}));
 const student=env.authenticatedContext('u1',{email:'u1@example.test',email_verified:true}).firestore();
 await assertFails(setDoc(doc(student,'sessions/STRESSAA/participants/u1/orders/0'),{variety:4,quantity:200,cap:0,phase:'plan',revision:1,savedAt:serverTimestamp()}));
 await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'sessions/STRESSAA'),{startedAt:Timestamp.fromMillis(Date.now()-100000)},{merge:true}));
 await concurrent(300,async i=>{const captain=i%100,r=await getDoc(doc(student,'sessions/STRESSAA/participants/u'+captain*5+'/orders/0'));assert.equal(r.data().quantity,captain+1);});
 timings.sort((a,b)=>a-b);console.log(JSON.stringify({participants:500,teams:100,joins:100,writes:100,reads:300,concurrency:20,p95Ms:Math.round(timings[Math.floor(timings.length*.95)])}));
});
