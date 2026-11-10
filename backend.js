import {initializeApp} from 'https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js';
import {getAuth,GoogleAuthProvider,signInWithPopup,signInWithEmailAndPassword,createUserWithEmailAndPassword,sendEmailVerification,sendPasswordResetEmail,signOut,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js';
import {getFirestore,doc,collection,getDoc,getDocs,setDoc,updateDoc,onSnapshot,serverTimestamp,query,where,runTransaction} from 'https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js';
import {firebaseConfig,DATABASE,ADMIN_EMAIL} from './firebase-config.js';
import {DEFAULT_CONFIG} from './model.js';
const app=initializeApp(firebaseConfig,'fashion-futures'),auth=getAuth(app),db=getFirestore(app,DATABASE);
export const currentUser=()=>auth.currentUser;
export const observeAuth=fn=>onAuthStateChanged(auth,fn);
export const loginGoogle=()=>signInWithPopup(auth,new GoogleAuthProvider());
export const loginEmail=(email,password)=>signInWithEmailAndPassword(auth,email,password);
export async function register(email,password){const {user}=await createUserWithEmailAndPassword(auth,email,password);await sendEmailVerification(user);}
export const resetPassword=email=>sendPasswordResetEmail(auth,email);
export const logout=()=>signOut(auth);
export const verifyEmail=()=>sendEmailVerification(auth.currentUser);
export async function refreshUser(){await auth.currentUser.reload();await auth.currentUser.getIdToken(true);return auth.currentUser;}
export async function role(){const u=currentUser();if(!u?.emailVerified)return 'student';if(u.email===ADMIN_EMAIL)return 'admin';return (await getDoc(doc(db,'instructors',u.email))).exists()?'instructor':'student';}
export async function grant(email){await setDoc(doc(db,'instructors',email.trim().toLowerCase()),{createdAt:serverTimestamp()});}
export async function listInstructors(){return (await getDocs(collection(db,'instructors'))).docs.map(d=>d.id);}
export async function revoke(email){const {deleteDoc}=await import('https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js');await deleteDoc(doc(db,'instructors',email));}
export async function getDefaults(){const d=await getDoc(doc(db,'settings','defaults'));return d.exists()?d.data():{...DEFAULT_CONFIG};}
export const saveDefaults=config=>setDoc(doc(db,'settings','defaults'),config);
export async function createSession(name,config){
 for(let tries=0;tries<4;tries++){
  const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';const bytes=crypto.getRandomValues(new Uint8Array(8));const code=Array.from(bytes,b=>alphabet[b%alphabet.length]).join('');
  const ref=doc(db,'sessions',code);
  const created=await runTransaction(db,async tx=>{if((await tx.get(ref)).exists())return false;tx.set(ref,{name,owner:currentUser().uid,config,seed:crypto.getRandomValues(new Uint32Array(1))[0]%1000001,status:'lobby',createdAt:serverTimestamp(),startedAt:null,closedAt:null});return true;});
  if(created)return code;
 }throw new Error('Could not reserve a code. Please try again.');
}
export async function listSessions(isAdmin){const c=collection(db,'sessions');return (await getDocs(isAdmin?c:query(c,where('owner','==',currentUser().uid)))).docs.map(d=>({code:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.toMillis()||0)-(a.createdAt?.toMillis()||0));}
export const watchSession=(code,fn,error)=>onSnapshot(doc(db,'sessions',code),d=>fn(d.exists()?{code,...d.data({serverTimestamps:'estimate'})}:null),error);
export const startSession=code=>updateDoc(doc(db,'sessions',code),{status:'running',startedAt:serverTimestamp()});
export const closeSession=code=>updateDoc(doc(db,'sessions',code),{status:'closed',closedAt:serverTimestamp()});
export async function joinSession(code,name){const s=await getDoc(doc(db,'sessions',code));if(!s.exists())throw new Error('Session code not found.');const ref=doc(db,'sessions',code,'participants',currentUser().uid);if(!(await getDoc(ref)).exists()){if(s.data().status!=='lobby')throw new Error('This session has already started or is closed. Ask your instructor for a new code.');await setDoc(ref,{name,email:currentUser().email,joinedAt:serverTimestamp()});}}
export const watchOrders=(code,uid,fn,error)=>onSnapshot(collection(db,'sessions',code,'participants',uid,'orders'),{includeMetadataChanges:true},s=>{if(!s.metadata.hasPendingWrites)fn(Object.fromEntries(s.docs.map(d=>[d.id,d.data()])));},error);
export const watchParticipants=(code,fn,error)=>onSnapshot(collection(db,'sessions',code,'participants'),s=>fn(s.docs.map(d=>({uid:d.id,...d.data()}))),error);
export const saveOrder=(code,index,order)=>setDoc(doc(db,'sessions',code,'participants',currentUser().uid,'orders',String(index)),{...order,savedAt:serverTimestamp()});
export async function readOrders(code,uid){return Object.fromEntries((await getDocs(collection(db,'sessions',code,'participants',uid,'orders'))).docs.map(d=>[d.id,d.data()]));}
