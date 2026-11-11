import {emailActionSettings} from './auth-flow.js?v=mobile-auth-9';
import {decisionOwner,validateTeams} from './competition.js?v=qa-20261111';
import {initializeApp} from 'https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js';
import {getAuth,GoogleAuthProvider,signInWithPopup,signInWithEmailAndPassword,createUserWithEmailAndPassword,sendEmailVerification,sendPasswordResetEmail,signOut,onAuthStateChanged,verifyBeforeUpdateEmail} from 'https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js';
import {getFirestore,doc,collection,getDoc,getDocFromServer,getDocs,getDocsFromServer,setDoc,updateDoc,onSnapshot,serverTimestamp,query,where,runTransaction,increment,writeBatch,deleteDoc} from 'https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js';
import {firebaseConfig,DATABASE,ADMIN_EMAIL} from './firebase-config.js';
import {platformHandoff} from './profile.js?v=qa-20261110';
import {loginEmailAddress,assertAccountEmail,ADMIN_ACCOUNT_EMAIL} from './auth-identity.js?v=multi-admin-1';
import {ROUNDS,DEFAULT_CONFIG} from './model.js';
const app=initializeApp(firebaseConfig,'fashion-futures'),auth=getAuth(app),db=getFirestore(app,DATABASE);
export const currentUser=()=>auth.currentUser;
export const observeAuth=fn=>onAuthStateChanged(auth,fn);
export const loginGoogle=()=>signInWithPopup(auth,new GoogleAuthProvider());
export const loginEmail=(email,password)=>signInWithEmailAndPassword(auth,loginEmailAddress(email),password);
const emailSettings=(action='verify',sessionCode='')=>emailActionSettings(globalThis.location?.href||'',action,sessionCode);
export async function register(email,password,profile){
 assertAccountEmail(email);
 const {user}=await createUserWithEmailAndPassword(auth,email,password);
 const saved=await Promise.allSettled([saveProfile(profile),sendEmailVerification(user,emailSettings())]);
 return {profileSaved:saved[0].status==='fulfilled',verificationSent:saved[1].status==='fulfilled'};
}
export const changeEmail=email=>{if(currentUser()?.email===ADMIN_ACCOUNT_EMAIL)throw Error("This administrator account uses owner-managed recovery.");assertAccountEmail(email);return verifyBeforeUpdateEmail(auth.currentUser,email,emailSettings());};
export async function getProfile(){const d=await getDoc(doc(db,'profiles',currentUser().uid));return d.exists()?d.data():null;}
export const saveProfile=profile=>setDoc(doc(db,'profiles',currentUser().uid),{firstName:profile.firstName.trim(),lastName:profile.lastName.trim(),universityId:profile.universityId.trim()},{merge:true});
export async function importPlatformProfile(storage){const p=platformHandoff(storage,currentUser());if(p)await setDoc(doc(db,'profiles',currentUser().uid),{platformRegistration:p},{merge:true});}
export async function playHistory(){
 const uid=currentUser().uid,refs=await getDocsFromServer(collection(db,'profiles',uid,'sessions'));
 return Promise.all(refs.docs.map(async ref=>{
  try{
   const data=await requireSession(ref.id),owner=decisionOwner(data,uid)||uid;
   const orders=await readOrders(ref.id,owner),teamOrders=data.mode==='team'?await readMarketOrders(ref.id,Object.keys(data.teamNames||{}),[1,2,3].filter(i=>data.startedAt&&((data.closedAt?.toMillis()??Date.now())-data.startedAt.toMillis())/1000>=ROUNDS[i].end)):null;
   await requireSession(ref.id);return {code:ref.id,...data,decisionUid:decisionOwner(data,uid),orders,teamOrders};
  }catch(error){if(error.code==='session-deleted')return null;try{await requireSession(ref.id);}catch(check){if(check.code==='session-deleted')return null;}throw error;}
 })).then(rows=>rows.filter(Boolean));
}
// Use confirmed parent state before and after multi-document reads: deletion is staged.
async function requireSession(code){
 const snapshot=await getDocFromServer(doc(db,'sessions',code));
 if(snapshot.metadata.hasPendingWrites)throw Object.assign(new Error('Waiting for session confirmation.'),{code:'unavailable'});
 if(!snapshot.exists()||snapshot.data().deletedAt)throw Object.assign(new Error('This session has been deleted. Its results are no longer available.'),{code:'session-deleted'});
 return snapshot.data();
}
export const resetPassword=(email,sessionCode='')=>sendPasswordResetEmail(auth,loginEmailAddress(email),emailSettings('login',sessionCode));
export const logout=()=>signOut(auth);
export const verifyEmail=(sessionCode='')=>sendEmailVerification(auth.currentUser,emailSettings('verify',sessionCode));
export async function refreshUser(){await auth.currentUser.reload();await auth.currentUser.getIdToken(true);return auth.currentUser;}
export async function role(){const u=currentUser();if(!u?.emailVerified)return 'student';if(u.email===ADMIN_EMAIL)return 'admin';return (await getDoc(doc(db,'instructors',u.email))).exists()?'instructor':'student';}
export async function grant(email){await setDoc(doc(db,'instructors',loginEmailAddress(email)),{createdAt:serverTimestamp()});}
export async function listInstructors(){return (await getDocs(collection(db,'instructors'))).docs.map(d=>d.id);}
export async function revoke(email){const {deleteDoc}=await import('https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js');await deleteDoc(doc(db,'instructors',loginEmailAddress(email)));}
export async function getDefaults(){const d=await getDoc(doc(db,'settings','defaults'));return d.exists()?d.data():{...DEFAULT_CONFIG};}
export const saveDefaults=config=>setDoc(doc(db,'settings','defaults'),config);
export async function createSession(name,config,mode='individual'){
 for(let tries=0;tries<4;tries++){
  const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';const bytes=crypto.getRandomValues(new Uint8Array(8));const code=Array.from(bytes,b=>alphabet[b%alphabet.length]).join('');
  const ref=doc(db,'sessions',code);
  const created=await runTransaction(db,async tx=>{if((await tx.get(ref)).exists())return false;tx.set(ref,{name,mode,assignments:{},teamNames:{},rosterVersion:0,owner:currentUser().uid,config,seed:crypto.getRandomValues(new Uint32Array(1))[0]%1000001,status:'lobby',createdAt:serverTimestamp(),startedAt:null,closedAt:null});return true;});
  if(created)return code;
 }throw new Error('Could not reserve a code. Please try again.');
}
export async function listSessions(isAdmin){const c=collection(db,'sessions');return (await getDocs(isAdmin?c:query(c,where('owner','==',currentUser().uid)))).docs.map(d=>({code:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.toMillis()||0)-(a.createdAt?.toMillis()||0));}
export const watchSession=(code,fn,error,status)=>onSnapshot(doc(db,'sessions',code),{includeMetadataChanges:true},d=>{const fresh=!d.metadata.fromCache&&!d.metadata.hasPendingWrites;status?.(fresh);if(fresh)fn(d.exists()?{code,...d.data()}:null);},error);
export async function startSession(code){const ref=doc(db,'sessions',code);await runTransaction(db,async tx=>{const s=(await tx.get(ref)).data();if(s.mode==='team'){const people=(await getDocs(collection(db,'sessions',code,'participants'))).docs.map(d=>({uid:d.id}));if(!validateTeams(people,s.assignments,s.teamNames))throw Error('Assign every participant to a team before starting.');}tx.update(ref,{status:'running',startedAt:serverTimestamp()});});}
export async function saveTeams(code,assignments,teamNames){
 const ref=doc(db,'sessions',code);
 await runTransaction(db,async tx=>{
  const snapshot=await tx.get(ref);if(!snapshot.exists()||snapshot.data().status!=='lobby')throw Error('Teams can only be edited before the session starts.');
  const people=(await getDocs(collection(db,'sessions',code,'participants'))).docs.map(d=>({uid:d.id}));
  if(!validateTeams(people,assignments,teamNames))throw Error('Each participant needs a team with a captain; maximum 20 per team and 100 teams.');
  tx.update(ref,{assignments,teamNames});
 });
}
export async function readMarketOrders(code,captains,rounds){await requireSession(code);const result=Object.fromEntries(await Promise.all(captains.map(async uid=>[uid,Object.fromEntries(await Promise.all(rounds.map(async r=>{const d=await getDocFromServer(doc(db,'sessions',code,'participants',uid,'orders',String(r)));if(d.metadata.hasPendingWrites)throw Object.assign(new Error('Waiting for the server to confirm a decision.'),{code:'unavailable'});return [r,d.exists()?d.data():null];})))])));await requireSession(code);return result;}
export const closeSession=code=>updateDoc(doc(db,'sessions',code),{status:'closed',closedAt:serverTimestamp()});
export async function joinSession(code,name){
 const uid=currentUser().uid,email=currentUser().email,sessionRef=doc(db,'sessions',code),participantRef=doc(db,'sessions',code,'participants',uid);
 const snapshot=await getDoc(sessionRef);if(!snapshot.exists())throw new Error('Session code not found.');const s=snapshot.data();
 if(s.mode==='solo'&&s.owner!==uid)throw Error('This is a private solo game.');
 await runTransaction(db,async tx=>{
  if(!(await tx.get(participantRef)).exists()){
   if(s.status!=='lobby')throw new Error('This session has already started or is closed. Ask your instructor for a new code.');
   tx.set(participantRef,{name,email,joinedAt:serverTimestamp()});
   // Makes a concurrent roster change conflict with assignment/start transactions.
   // A server-side increment avoids making simultaneous students retry one hot session read.
   if(s.mode==='team')tx.update(sessionRef,{rosterVersion:increment(1)});
  }
  tx.set(doc(db,'profiles',uid,'sessions',code),{joined:true});
 });
}
export const watchOrders=(code,uid,fn,error,status)=>onSnapshot(collection(db,'sessions',code,'participants',uid,'orders'),{includeMetadataChanges:true},s=>{const fresh=!s.metadata.hasPendingWrites&&!s.metadata.fromCache;status?.(fresh);if(fresh)fn(Object.fromEntries(s.docs.map(d=>[d.id,d.data()])));},error);
export const watchParticipants=(code,fn,error)=>onSnapshot(collection(db,'sessions',code,'participants'),{includeMetadataChanges:true},s=>{if(!s.metadata.fromCache&&!s.metadata.hasPendingWrites)fn(s.docs.map(d=>({uid:d.id,...d.data()})));},error);
export async function saveOrder(code,index,order,phase='plan',expectedRevision=0){
 if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0)throw Error('Reload the saved decision before saving.');
 const ref=doc(db,'sessions',code,'participants',currentUser().uid,'orders',String(index));
 try{await setDoc(ref,{...order,phase,revision:expectedRevision+1,savedAt:serverTimestamp()});}
 catch(error){
  if(error.code==='permission-denied'){
   let latest;try{latest=await getDocFromServer(ref);}catch{}
   if(latest&&!latest.metadata.hasPendingWrites&&(latest.data()?.revision??0)!==expectedRevision)
    throw Object.assign(new Error('Another device saved a newer decision. Your save was not applied. Review the latest saved values before editing again.'),{code:'decision-conflict'});
  }
  throw error;
 }
}
export async function readOrders(code,uid){return Object.fromEntries((await getDocsFromServer(collection(db,'sessions',code,'participants',uid,'orders'))).docs.map(d=>[d.id,d.data()]));}

export const readParticipants=async code=>(await getDocs(collection(db,'sessions',code,'participants'))).docs.map(d=>({uid:d.id,...d.data()}));
export async function deleteSession(code){
 const ref=doc(db,'sessions',code),snapshot=await getDocFromServer(ref);if(!snapshot.exists())return;
 // Close first to prevent joins or new decisions during a retryable cleanup.
 if(snapshot.data().status!=='closed')await closeSession(code);
 // Notify open/offline clients before removing any data; retries preserve this marker.
 if(!snapshot.data().deletedAt)await updateDoc(ref,{deletedAt:serverTimestamp()});
 const people=await readParticipants(code);
 for(const person of people){
  const orders=await getDocs(collection(db,'sessions',code,'participants',person.uid,'orders'));
  const batch=writeBatch(db);orders.docs.forEach(d=>batch.delete(d.ref));
  batch.delete(doc(db,'profiles',person.uid,'sessions',code));
  batch.delete(doc(db,'sessions',code,'participants',person.uid));await batch.commit();
 }
 // Keep the parent until last: authorization and retries rely on its owner.
 await deleteDoc(ref);
}
