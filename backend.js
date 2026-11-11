import {decisionOwner,validateTeams} from './competition.js';
import {initializeApp} from 'https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js';
import {getAuth,GoogleAuthProvider,signInWithPopup,signInWithEmailAndPassword,createUserWithEmailAndPassword,sendEmailVerification,sendPasswordResetEmail,signOut,onAuthStateChanged,verifyBeforeUpdateEmail} from 'https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js';
import {getFirestore,doc,collection,getDoc,getDocs,setDoc,updateDoc,onSnapshot,serverTimestamp,query,where,runTransaction,increment} from 'https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js';
import {firebaseConfig,DATABASE,ADMIN_EMAIL} from './firebase-config.js';
import {platformHandoff} from './profile.js?v=qa-20261110';
import {loginEmailAddress,assertAccountEmail} from './auth-identity.js';
import {ROUNDS,DEFAULT_CONFIG} from './model.js';
const app=initializeApp(firebaseConfig,'fashion-futures'),auth=getAuth(app),db=getFirestore(app,DATABASE);
export const currentUser=()=>auth.currentUser;
export const observeAuth=fn=>onAuthStateChanged(auth,fn);
export const loginGoogle=()=>signInWithPopup(auth,new GoogleAuthProvider());
export const loginEmail=(email,password)=>signInWithEmailAndPassword(auth,loginEmailAddress(email),password);
const emailSettings={url:'https://www.stouras.com/fast-fashion-simulation/'};
export async function register(email,password,profile){
 assertAccountEmail(email);
 const {user}=await createUserWithEmailAndPassword(auth,email,password);
 const saved=await Promise.allSettled([saveProfile(profile),sendEmailVerification(user,emailSettings)]);
 return {profileSaved:saved[0].status==='fulfilled',verificationSent:saved[1].status==='fulfilled'};
}
export const changeEmail=email=>{assertAccountEmail(email);return verifyBeforeUpdateEmail(auth.currentUser,email,emailSettings);};
export async function getProfile(){const d=await getDoc(doc(db,'profiles',currentUser().uid));return d.exists()?d.data():null;}
export const saveProfile=profile=>setDoc(doc(db,'profiles',currentUser().uid),{firstName:profile.firstName.trim(),lastName:profile.lastName.trim(),universityId:profile.universityId.trim()},{merge:true});
export async function importPlatformProfile(storage){const p=platformHandoff(storage,currentUser());if(p)await setDoc(doc(db,'profiles',currentUser().uid),{platformRegistration:p},{merge:true});}
export async function playHistory(){
 const uid=currentUser().uid,refs=await getDocs(collection(db,'profiles',uid,'sessions'));
 return Promise.all(refs.docs.map(async ref=>{const d=await getDoc(doc(db,'sessions',ref.id));return d.exists()?{code:ref.id,...d.data(),decisionUid:decisionOwner(d.data(),uid),orders:await readOrders(ref.id,decisionOwner(d.data(),uid)||uid),teamOrders:d.data().mode==='team'?await readMarketOrders(ref.id,Object.keys(d.data().teamNames||{}),[1,2,3].filter(i=>d.data().startedAt&&((d.data().closedAt?.toMillis()??Date.now())-d.data().startedAt.toMillis())/1000>=ROUNDS[i].end)):null}:null;})).then(rows=>rows.filter(Boolean));
}
export const resetPassword=email=>sendPasswordResetEmail(auth,loginEmailAddress(email));
export const logout=()=>signOut(auth);
export const verifyEmail=()=>sendEmailVerification(auth.currentUser,emailSettings);
export async function refreshUser(){await auth.currentUser.reload();await auth.currentUser.getIdToken(true);return auth.currentUser;}
export async function role(){const u=currentUser();if(!u?.emailVerified)return 'student';if(u.email===ADMIN_EMAIL)return 'admin';return (await getDoc(doc(db,'instructors',u.email))).exists()?'instructor':'student';}
export async function grant(email){await setDoc(doc(db,'instructors',email.trim().toLowerCase()),{createdAt:serverTimestamp()});}
export async function listInstructors(){return (await getDocs(collection(db,'instructors'))).docs.map(d=>d.id);}
export async function revoke(email){const {deleteDoc}=await import('https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js');await deleteDoc(doc(db,'instructors',email));}
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
export const watchSession=(code,fn,error)=>onSnapshot(doc(db,'sessions',code),d=>fn(d.exists()?{code,...d.data({serverTimestamps:'estimate'})}:null),error);
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
export async function readMarketOrders(code,captains,rounds){return Object.fromEntries(await Promise.all(captains.map(async uid=>[uid,Object.fromEntries(await Promise.all(rounds.map(async r=>{const d=await getDoc(doc(db,'sessions',code,'participants',uid,'orders',String(r)));return [r,d.exists()?d.data():null];})))])));}
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
export const watchOrders=(code,uid,fn,error)=>onSnapshot(collection(db,'sessions',code,'participants',uid,'orders'),{includeMetadataChanges:true},s=>{if(!s.metadata.hasPendingWrites&&!s.metadata.fromCache)fn(Object.fromEntries(s.docs.map(d=>[d.id,d.data()])));},error);
export const watchParticipants=(code,fn,error)=>onSnapshot(collection(db,'sessions',code,'participants'),{includeMetadataChanges:true},s=>{if(!s.metadata.fromCache&&!s.metadata.hasPendingWrites)fn(s.docs.map(d=>({uid:d.id,...d.data()})));},error);
export const saveOrder=(code,index,order)=>setDoc(doc(db,'sessions',code,'participants',currentUser().uid,'orders',String(index)),{...order,savedAt:serverTimestamp()});
export async function readOrders(code,uid){return Object.fromEntries((await getDocs(collection(db,'sessions',code,'participants',uid,'orders'))).docs.map(d=>[d.id,d.data()]));}
