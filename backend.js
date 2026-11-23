import {entryMember,handoff} from './team-roles.js';
import {hasHomeTeamPractice,nextPhaseOffset,sessionProgress} from './functions/session-progress.js?v=team-handoff-1';
import {emailActionSettings} from './auth-flow.js?v=session-codes-1';
import {requireSessionCode,sessionCodeTaken} from './session-code.js';
import {decisionOwner,validateTeams} from './competition.js?v=team-handoff-1';
import {aiActive,makeTeamOpponents,teamMatchup} from './market.js?v=team-handoff-1';
import {defaultTeamComposition,DEFAULT_TEAM_SIZE,initialEntryRoles,materializeTeams,validTeamSize} from './functions/teams.js?v=team-handoff-1';
import {initializeApp} from 'https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js';
import {getAuth,GoogleAuthProvider,signInWithPopup,signInWithEmailAndPassword,createUserWithEmailAndPassword,sendEmailVerification,sendPasswordResetEmail,signOut,onAuthStateChanged,verifyBeforeUpdateEmail} from 'https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js';
import {getFirestore,doc,collection,getDoc,getDocFromServer,getDocs,getDocsFromServer,setDoc,updateDoc,onSnapshot,serverTimestamp,query,where,runTransaction,increment,writeBatch,deleteDoc,deleteField,FieldPath} from 'https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js';
import {getFunctions,httpsCallable} from 'https://www.gstatic.com/firebasejs/12.5.0/firebase-functions.js';
import {firebaseConfig,DATABASE,ADMIN_EMAIL} from './firebase-config.js';
import {platformHandoff} from './profile.js?v=team-handoff-1';
import {loginEmailAddress,assertAccountEmail,ADMIN_ACCOUNT_EMAIL} from './auth-identity.js?v=multi-admin-1';
import {ROUNDS,validateConfig,DEFAULT_CONFIG,validOrder} from './model.js';
const app=initializeApp(firebaseConfig,'fashion-futures'),auth=getAuth(app),db=getFirestore(app,DATABASE);
const functions=getFunctions(app,'us-central1');
const callable=(name,timeout)=>httpsCallable(functions,name,{timeout});
const readSettings=callable('getAiSettings',45000),writeSettings=callable('saveAiSettings',45000);
const prepareAiOpponent=callable('prepareAiOpponent',150000),startAiSession=callable('startAiSession',120000);
const joinTeam=callable('joinTeamClassroom',60000);
const teamUsers=callable('listTeamUsers',125000),writeComposition=callable('saveTeamComposition',45000);
const userClassrooms=callable('getUserClassrooms',60000);
const writeDefaultTeams=callable('saveDefaultTeamComposition',60000);
const deleteAccounts=callable('deleteRegisteredUsers',540000);
function defaultRosterRef(){return doc(db,'studioTeamDefaults',currentUser().uid);}
export async function getDefaultTeamComposition(){
 const snapshot=await getDocFromServer(defaultRosterRef());
 return {teamComposition:snapshot.data()?.teamComposition || {}};
}
export const saveDefaultTeamComposition=async changes=>(await writeDefaultTeams({changes})).data;
export const deleteRegisteredUsers=async uids=>(await deleteAccounts({uids})).data;
export const getAiSettings=async()=>(await readSettings({})).data;
export const saveAiSettings=async input=>(await writeSettings(input)).data;
export const listTeamUsers=async pageToken=>(await teamUsers(pageToken?{pageToken}:{})).data;
export const getUserClassrooms=async uid=>(await userClassrooms({uid})).data;
export const saveTeamComposition=async(code,changes)=>(await writeComposition({code,changes})).data;
export const currentUser=()=>auth.currentUser;
function recordVerifiedAccount(user) {
 if (!user?.emailVerified || !user.email) return;
 setDoc(doc(db,'verifiedAccounts',user.uid),{email:user.email})
  .catch(error=>console.warn('Verified account directory update failed.',error.code));
}
export const observeAuth=fn=>onAuthStateChanged(auth,user=>{
 recordVerifiedAccount(user);
 return fn(user);
});
export const watchVerifiedAccounts=(onChange,onError)=>onSnapshot(collection(db,'verifiedAccounts'),
 snapshot=>onChange(snapshot.docs.map(entry=>entry.data().email)),onError);
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
   const completed=[1,2,3].filter(i=>sessionProgress(data)>=ROUNDS[i].end);
   const [orders,teamOrders,aiOrders]=await Promise.all([
    readOrders(ref.id,owner),
    data.mode==='team'?readMarketOrders(ref.id,teamMatchup(data,owner),completed,owner):null,
    readAiOrders(ref.id,[owner],data.aiOpponent,completed)
   ]);
   await requireSession(ref.id);return {code:ref.id,...data,decisionUid:decisionOwner(data,uid),orders,teamOrders,aiOrders};
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
export async function refreshUser(){await auth.currentUser.reload();await auth.currentUser.getIdToken(true);recordVerifiedAccount(auth.currentUser);return auth.currentUser;}
export async function role(){const u=currentUser();if(!u?.emailVerified)return 'student';if(u.email===ADMIN_EMAIL)return 'admin';return (await getDoc(doc(db,'instructors',u.email))).exists()?'instructor':'student';}
export async function grant(email){await setDoc(doc(db,'instructors',loginEmailAddress(email)),{createdAt:serverTimestamp()});}
export async function listInstructors(){return (await getDocs(collection(db,'instructors'))).docs.map(d=>d.id);}
export async function revoke(email){const {deleteDoc}=await import('https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js');await deleteDoc(doc(db,'instructors',loginEmailAddress(email)));}
export async function getDefaults(){const d=await getDoc(doc(db,'settings','defaults'));return d.exists()?d.data():{...DEFAULT_CONFIG};}
export const saveDefaults=config=>setDoc(doc(db,'settings','defaults'),config);
function randomSessionCode(){
 const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
 const bytes=crypto.getRandomValues(new Uint8Array(8));
 return Array.from(bytes,b=>alphabet[b%alphabet.length]).join('');
}
export async function isSessionCodeAvailable(value){
 const ref=doc(db,'sessions',requireSessionCode(value));
 const snapshot=await getDocFromServer(ref);
 return !snapshot.exists();
}
export async function createSession(name,config,mode='individual',requestedCode,aiOpponent=null,teamSize=DEFAULT_TEAM_SIZE){
 if(mode==='team'&&!validTeamSize(teamSize))throw Error('Choose a team size from 1 to 20.');
 const selected=requestedCode===undefined?null:requireSessionCode(requestedCode);
 for(let tries=0;tries<4;tries++){
  const code=selected??randomSessionCode();
  const ref=doc(db,'sessions',code);
  const created=await runTransaction(db,async tx=>{
   if((await tx.get(ref)).exists())return false;
   const room={name,mode,assignments:{},teamNames:{},rosterVersion:0,owner:currentUser().uid,config,
    seed:crypto.getRandomValues(new Uint32Array(1))[0]%1000001,status:'lobby',createdAt:serverTimestamp(),startedAt:null,closedAt:null};
   if(mode==='team'){
    room.teamPractice=true;
    room.randomTeams=true;
    room.teamSize=teamSize;
    const defaults=(await tx.get(defaultRosterRef())).data()?.teamComposition;
    const composition=defaultTeamComposition(defaults,teamSize);
    if(Object.keys(composition).length)room.teamComposition=composition;
   }else if(aiOpponent?.practice||aiOpponent?.main)room.aiOpponent=aiOpponent;
   tx.set(ref,room);
   return true;
  });
  if(created)return code;
  if(selected)throw sessionCodeTaken(code);
 }throw new Error('Could not reserve a code. Please try again.');
}
export async function listSessions(isAdmin){const c=collection(db,'sessions');return (await getDocs(isAdmin?c:query(c,where('owner','==',currentUser().uid)))).docs.map(d=>({code:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.toMillis()||0)-(a.createdAt?.toMillis()||0));}
export const watchSession=(code,fn,error,status)=>onSnapshot(doc(db,'sessions',code),{includeMetadataChanges:true},d=>{const fresh=!d.metadata.fromCache&&!d.metadata.hasPendingWrites;status?.(fresh);if(fresh)fn(d.exists()?{code,...d.data()}:null);},error);
export async function saveSessionAiOpponent(code,aiOpponent){
 const ref=doc(db,'sessions',code);
 await runTransaction(db,async tx=>{
  const s=(await tx.get(ref)).data();
  if(s?.status!=='lobby'||s.mode==='solo')throw Error('AI settings can be changed in a waiting classroom.');
  if(s.mode==='team'&&aiOpponent)throw Error('Team classrooms use AI in home practice and human opponents in scored seasons.');
  tx.update(ref,{aiOpponent:aiOpponent?.practice||aiOpponent?.main?aiOpponent:deleteField()});
 });
}

// Bound simultaneous paid calls and stop allocating new work after a failure.
// Successful plans are durable, so pressing Start again resumes preparation.
async function prepareClass(code,s,onProgress){
 const people=(await getDocsFromServer(collection(db,'sessions',code,'participants'))).docs.map(d=>({uid:d.id}));
 if(!people.length)throw Error('At least one participant must join before starting with AI opponents.');
 const competitors=people.map(person=>person.uid);
 const phases=['practice','main'].filter(phase=>s.aiOpponent[phase]);
 const jobs=competitors.flatMap(competitor=>phases.map(phase=>({code,competitor,phase})));
 let next=0,completed=0,failure=null;
 onProgress?.(completed,jobs.length);
 const worker=async()=>{
  while(!failure&&next<jobs.length){
   const job=jobs[next++];
   try{await prepareAiOpponent(job);onProgress?.(++completed,jobs.length);}
   catch(error){failure??=error;}
  }
 };
 await Promise.all(Array.from({length:Math.min(4,jobs.length)},worker));
 if(failure)throw failure;
 await startAiSession({code});
}
export async function startSession(code,onProgress){
 const ref=doc(db,'sessions',code);
 const session=await requireSession(code);
 if(session.status!=='lobby')throw Error('Only a waiting session can start.');
 if(session.mode!=='team'&&(session.aiOpponent?.practice||session.aiOpponent?.main))return prepareClass(code,session,onProgress);
 await runTransaction(db,async tx=>{
  const s=(await tx.get(ref)).data();
  if(s?.status!=='lobby')throw Error('Only a waiting session can start.');
  if(s.mode!=='team'&&(s.aiOpponent?.practice||s.aiOpponent?.main))throw Error('AI settings changed. Start again to prepare the opponents.');
  const update={status:'running',phaseOffset:0,startedAt:serverTimestamp()};
  if(s.mode==='team'){
   const people=(await getDocsFromServer(collection(db,'sessions',code,'participants'))).docs.map(d=>({uid:d.id,name:d.data().name}));
   const teams=materializeTeams(people,s);
   if(!validateTeams(people,teams.assignments,teams.teamNames,s.teamSize??20))throw Error('Assign every participant to a team before starting.');
   Object.assign(update,teams);
   Object.assign(update,initialEntryRoles(update,people));
  update.oddTeamAi=true;
  update.teamOpponents=makeTeamOpponents(teams.teamNames);
   update.teamPractice=true;
   update.phaseOffset=ROUNDS[1].start;
   if(s.aiOpponent)update.aiOpponent=deleteField();
  }
  tx.update(ref,update);
 });
}
export async function saveTeams(code,assignments,teamNames){
 const ref=doc(db,'sessions',code);
 await runTransaction(db,async tx=>{
  const snapshot=await tx.get(ref);if(!snapshot.exists()||snapshot.data().status!=='lobby')throw Error('Teams can only be edited before the session starts.');
  if(Object.hasOwn(snapshot.data(),'teamComposition'))throw Error('Edit this classroom’s membership on the Users & Teams page.');
  const people=(await getDocs(collection(db,'sessions',code,'participants'))).docs.map(d=>({uid:d.id}));
  const size=snapshot.data().teamSize??20;
  if(!validateTeams(people,assignments,teamNames,size))throw Error('Assign every participant to a captain and keep each team to '+size+' participants or fewer.');
  tx.update(ref,{assignments,teamNames,membershipEdited:true});
 });
}
export async function readMarketOrders(code,captains,rounds,decisionUid){
 const session=await requireSession(code);
 const result=await Promise.all(captains.filter(uid=>!uid.startsWith('ai/')).map(async uid=>{
  const visible=rounds.filter(index=>(index!==0||!hasHomeTeamPractice(session))&&(!decisionUid||uid===decisionUid||!aiActive(session,index)));
  const orders=await Promise.all(visible.map(async r=>{
   const d=await getDocFromServer(doc(db,'sessions',code,'participants',uid,'orders',String(r)));
   if(d.metadata.hasPendingWrites)throw Object.assign(new Error('Waiting for the server to confirm a decision.'),{code:'unavailable'});
   return [r,d.exists()?d.data():null];
  }));
  return [uid,Object.fromEntries(orders)];
 }));
 await requireSession(code);
 return Object.fromEntries(result);
}

export async function readAiOrders(code,competitors,aiOpponent,rounds=[0,1,2,3]){
 const visible=rounds.filter(index=>aiActive({aiOpponent},index));
 if(!visible.length||!competitors.length)return {};
 await requireSession(code);
 const entries=await Promise.all(competitors.map(async uid=>{
  const orders=await Promise.all(visible.map(async index=>{
   const ref=doc(db,'sessions',code,'participants',uid,'aiRounds',String(index));
   const saved=(await getDocFromServer(ref)).data();
   if(saved?.provider!==aiOpponent.provider||saved?.model!==aiOpponent.model||!validOrder(saved?.order,index))throw Error('The saved AI opponent decision is unavailable.');
   return [index,saved.order];
  }));
  return [uid,Object.fromEntries(orders)];
 }));
 await requireSession(code);
 return Object.fromEntries(entries);
}
export async function closeSession(code){
 const ref=doc(db,'sessions',code);
 await runTransaction(db,async tx=>{
  const s=(await tx.get(ref)).data();
  if(!s||s.status==='closed')throw Error('The classroom has already closed.');
  const update={status:'closed',closedAt:serverTimestamp()};
  if(s.status==='running'&&s.phaseOffset==null)throw Error('The classroom stage is being restored. Try again shortly.');
  tx.update(ref,update);
 });
}
export async function joinSession(code,name){
 const uid=currentUser().uid,email=currentUser().email,sessionRef=doc(db,'sessions',code),participantRef=doc(db,'sessions',code,'participants',uid);
 const snapshot=await getDoc(sessionRef);if(!snapshot.exists())throw new Error('Session code not found.');const s=snapshot.data();
 if(s.mode==='team'){await joinTeam({code,name});return;}
 if(s.mode==='solo'&&s.owner!==uid)throw Error('This is a private solo game.');
 await runTransaction(db,async tx=>{
  if(!(await tx.get(participantRef)).exists()){
   if(s.status!=='lobby')throw new Error('This session has already started or is closed. Ask your instructor for a new code.');
   tx.set(participantRef,{name,email,joinedAt:serverTimestamp()});
   // Makes a concurrent roster change conflict with assignment/start transactions.
   // A server-side increment avoids making simultaneous students retry one hot session read.
   if(s.aiOpponent?.practice||s.aiOpponent?.main)tx.update(sessionRef,{rosterVersion:increment(1)});
  }
  tx.set(doc(db,'profiles',uid,'sessions',code),{joined:true});
 });
}
export const watchOrders=(code,uid,fn,error,status)=>onSnapshot(collection(db,'sessions',code,'participants',uid,'orders'),{includeMetadataChanges:true},s=>{const fresh=!s.metadata.hasPendingWrites&&!s.metadata.fromCache;status?.(fresh);if(fresh)fn(Object.fromEntries(s.docs.map(d=>[d.id,d.data()])));},error);
export const watchParticipants=(code,fn,error)=>onSnapshot(collection(db,'sessions',code,'participants'),{includeMetadataChanges:true},s=>{if(!s.metadata.fromCache&&!s.metadata.hasPendingWrites)fn(s.docs.map(d=>({uid:d.id,...d.data()})));},error);
export async function changeEntryRole(code,requested){
 const ref=doc(db,'sessions',code),uid=currentUser().uid;
 if(!requested){
  const person=(await getDocFromServer(doc(ref,'participants',uid))).data();
  await updateDoc(ref,new FieldPath('entryRequests',uid),person.name);
  return;
 }
 await runTransaction(db,async tx=>{
  const s=(await tx.get(ref)).data(),team=s.assignments?.[uid];
  const transfer=handoff(s,uid,null,requested);
  tx.update(ref,new FieldPath('entryRequests',requested),deleteField(),
   new FieldPath('entryMembers',team),requested,new FieldPath('entryNames',team),transfer.entryNames[team]);
 });
}
export async function saveOrder(code,index,order,phase='plan',expectedRevision=0){
 if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0)throw Error('Reload the saved decision before saving.');
 const s=await requireSession(code);
 const ref=doc(db,'sessions',code,'participants',decisionOwner(s,currentUser().uid),'orders',String(index));
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
  const participant=doc(db,'sessions',code,'participants',person.uid);
  // A lobby may have been switched away from AI after partial preparation.
  // Delete both the private plans and the individually released round orders.
  const children=await Promise.all(['orders','aiOpponents','aiRounds'].map(name=>getDocs(collection(participant,name))));
  const batch=writeBatch(db);for(const child of children)child.docs.forEach(d=>batch.delete(d.ref));
  batch.delete(doc(db,'profiles',person.uid,'sessions',code));
  batch.delete(participant);await batch.commit();
 }
 // Keep the parent until last: authorization and retries rely on its owner.
 await deleteDoc(ref);
}

export async function saveDefaultField(key,value){
 const ref=doc(db,'settings','defaults');
 await runTransaction(db,async tx=>{
  const snapshot=await tx.get(ref);
  const config={...DEFAULT_CONFIG,...snapshot.data(),[key]:value};
  if(!validateConfig(config))throw new Error('Check the default costs, selling price and salvage value.');
  tx.set(ref,config);
 });
}

export async function advancePhase(code,next){
 const ref=doc(db,'sessions',code);
 await runTransaction(db,async tx=>{
  const s=(await tx.get(ref)).data();
  if(s?.status!=='running'||s.phaseOffset==null||next==null||next!==nextPhaseOffset(sessionProgress(s)))throw Error('The classroom has already moved to another stage.');
  tx.update(ref,{phaseOffset:next});
 });
}
