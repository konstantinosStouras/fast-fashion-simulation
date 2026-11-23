import {decisionOwner,validateTeams} from './competition.js';
import {legacyPhaseOffset,nextPhaseOffset,sessionProgress} from './functions/session-progress.js';
import {makeTeamOpponents,teamMatchup} from './market.js?v=home-practice-1';
// Test harness, selected only on loopback hosts with ?demo. Never real authentication.
import {platformHandoff} from './profile.js';
import {loginEmailAddress,assertAccountEmail,ADMIN_ACCOUNT_EMAIL} from './auth-identity.js';
import {validateConfig,DEFAULT_CONFIG,phaseAt} from './model.js';
import {rehearsalAiOrders} from './ai-rehearsal.js';
import {assignJoiningTeam,defaultTeamComposition,DEFAULT_TEAM_SIZE,getTeamComposition,materializeTeams,validTeamSize} from './functions/teams.js';
import {summarizeUserClassroom} from './functions/user-classrooms.js';
import {planRegisteredUserRemoval,protectedRegisteredUser,validDeletionBatch} from './functions/registered-user-classroom.js';
import {requireSessionCode,sessionCodeTaken} from './session-code.js';
const KEY='ff:demo:v1';let user=null;const authListeners=new Set(),listeners=new Set();
function load(){
 const data=JSON.parse(localStorage.getItem(KEY)||JSON.stringify({sessions:{},people:{},orders:{},instructors:[ADMIN_ACCOUNT_EMAIL]}));
 const pending=Object.values(data.sessions).filter(s=>s.status==='running'&&s.phaseOffset==null&&Number.isFinite(s.startedAt));
 if(pending.length){
  data.manualStageCutover??=Date.now();
  for(const s of pending)s.phaseOffset=legacyPhaseOffset(s.startedAt,data.manualStageCutover);
  localStorage.setItem(KEY,JSON.stringify(data));
 }
 return data;
}
function write(data){localStorage.setItem(KEY,JSON.stringify(data));listeners.forEach(fn=>fn());}
const timestamp=n=>n==null?null:{toMillis:()=>n};
function watch(fn){listeners.add(fn);queueMicrotask(fn);return ()=>listeners.delete(fn);}
addEventListener('storage',e=>{if(e.key===KEY)listeners.forEach(fn=>fn());});
export const currentUser=()=>user;
export const observeAuth=fn=>{authListeners.add(fn);queueMicrotask(()=>fn(user));return ()=>authListeners.delete(fn);};
async function login(email,emailVerified=true){
 const d=load(),now=new Date().toISOString();
 let uid=d.demoAccountIds?.[email] || (email==='kstouras@gmail.com'?'demo-admin':'demo-'+email);
 if(d.deletedAccounts?.[uid]){
  d.demoAccountIds??={};
  uid=crypto.randomUUID();
  d.demoAccountIds[email]=uid;
 }
 user={uid,email,emailVerified,displayName:email==='kstouras@gmail.com'?'Demo instructor':'Demo participant'};
 d.accountActivity??={};
 const activity=d.accountActivity[user.uid]??={registeredAt:d.registered?.[user.uid]||d.verifiedAccounts?.[user.uid]?null:now};
 activity.lastSignInAt=now;
 d.registered??={};d.registered[user.uid]=email;
 if(emailVerified){d.verifiedAccounts??={};d.verifiedAccounts[user.uid]=email;}
 write(d);authListeners.forEach(fn=>fn(user));
}
export const watchVerifiedAccounts=onChange=>watch(()=>onChange(Object.values(load().verifiedAccounts||{})));
export const loginGoogle=()=>login('kstouras@gmail.com');
export const loginEmail=(email,password)=>login(loginEmailAddress(email));
export async function register(email,password,profile){assertAccountEmail(email);await login(email,false);await saveProfile(profile);authListeners.forEach(fn=>fn(user));return {profileSaved:true,verificationSent:true};}
export const getProfile=async()=>load().profiles?.[user.uid]||{firstName:'Demo',lastName:'Participant',universityId:'DEMO'};
export const saveProfile=async profile=>{const d=load();d.profiles??={};d.profiles[user.uid]={...d.profiles[user.uid],...profile};write(d);};
export async function importPlatformProfile(storage){const p=platformHandoff(storage,user);if(p)await saveProfile({platformRegistration:p});}
export const changeEmail=async email=>{assertAccountEmail(email);};
export async function playHistory(){
 const data=load();
 return Object.values(data.sessions).filter(s=>!s.deletedAt&&data.people[s.code]?.[user.uid]).map(s=>{
  const captain=decisionOwner(s,user.uid),saved=data.orders[s.code]||{};
  const teamOrders=s.mode==='team'?Object.fromEntries(teamMatchup(s,captain).map(uid=>[uid,saved[uid]||{}])):null;
  return {...toSession(s),aiOrders:captain?{[captain]:data.aiOrders?.[s.code]?.[captain]||{}}:{},decisionUid:captain,teamOrders,orders:saved[captain]||{}};
 });
}
export const logout=async()=>{user=null;authListeners.forEach(fn=>fn(null));};
export const verifyEmail=async()=>{};
export const refreshUser=async()=>user;
export const resetPassword=async()=>{};
export const role=async()=>!user?.emailVerified?'student':user.email==='kstouras@gmail.com'?'admin':load().instructors.includes(user.email)?'instructor':'student';
export const grant=async email=>{const d=load();d.instructors=[...new Set([...d.instructors,loginEmailAddress(email)])];write(d);};
export const revoke=async email=>{const d=load();d.instructors=d.instructors.filter(x=>x!==loginEmailAddress(email));write(d);};
export const listInstructors=async()=>load().instructors;
export const getDefaults=async()=>load().defaults||DEFAULT_CONFIG;
export const saveDefaults=async config=>{const d=load();d.defaults=config;write(d);};
const demoProviders=[['openai','OpenAI'],['anthropic','Anthropic'],['google','Google']];
async function requireStudio(){
 if(!['admin','instructor'].includes(await role()))throw Error('Sign in as an instructor.');
}
export async function getAiSettings(){
 await requireStudio();
 const settings=load().aiSettings?.[user.uid]||{};
 return {provider:settings.provider||null,model:settings.model||null,
  providers:demoProviders.map(([id,label])=>({id,label,hasKey:!!settings.connected?.[id],
   models:['standard','fast'].map(tier=>({id:id+'-demo-'+tier,label:'Demo '+tier}))}))};
}
export async function saveAiSettings({provider,model,apiKey,removeKey}){
 const catalogue=await getAiSettings(),entry=catalogue.providers.find(p=>p.id===provider);
 if(!entry)throw Error('Choose a provider.');
 const d=load();d.aiSettings??={};
 const settings=d.aiSettings[user.uid]??={connected:{}};
 if(removeKey){
  delete settings.connected[provider];
  if(settings.provider===provider){delete settings.provider;delete settings.model;}
 }else{
  if(apiKey){
   if(apiKey!=='demo-fixture')throw Error('Use the demo connection button for this rehearsal.');
   settings.connected[provider]=true;
   if(!settings.provider){settings.provider=provider;settings.model=entry.models[0].id;}
  }
  if(model){
   if(!settings.connected[provider]||!entry.models.some(m=>m.id===model))throw Error('Connect a demo provider and choose a model.');
   Object.assign(settings,{provider,model});
  }
 }
 write(d);return getAiSettings();
}
const toSession=s=>s?{...s,createdAt:timestamp(s.createdAt),startedAt:timestamp(s.startedAt),closedAt:timestamp(s.closedAt)}:null;
export async function isSessionCodeAvailable(value){
 return !Object.hasOwn(load().sessions,requireSessionCode(value));
}
export async function createSession(name,config,mode='individual',requestedCode,aiOpponent,teamSize=DEFAULT_TEAM_SIZE){
 if(mode==='team'&&!validTeamSize(teamSize))throw Error('Choose a team size from 1 to 20.');
 const d=load();
 let code;
 if(requestedCode===undefined){
  let index=0;
  do{code='DEMO'+String(index++).padStart(4,'A').replace(/0/g,'B').replace(/1/g,'C');}while(d.sessions[code]);
 }else{
  code=requireSessionCode(requestedCode);
  if(Object.hasOwn(d.sessions,code))throw sessionCodeTaken(code);
 }
 d.sessions[code]={code,name,config,mode,assignments:{},teamNames:{},seed:Math.floor(Math.random()*1000001),owner:user.uid,status:'lobby',createdAt:Date.now(),startedAt:null,closedAt:null};
 if(mode==='team'){
  Object.assign(d.sessions[code],{teamPractice:true,teamSize,rosterVersion:0});
  const defaults=defaultTeamComposition(d.studioTeamDefaults?.[user.uid],teamSize);
  if(Object.keys(defaults).length)d.sessions[code].teamComposition=defaults;
 }else if(aiOpponent?.practice||aiOpponent?.main)d.sessions[code].aiOpponent={...aiOpponent};
 write(d);
 return code;
}
export const listSessions=async(isOwner=false)=>Object.values(load().sessions).filter(s=>isOwner||s.owner===user.uid).map(toSession);
export const watchSession=(code,fn)=>watch(()=>fn(toSession(load().sessions[code])));
export async function listTeamUsers(pageToken){
 await requireStudio();
 const d=load(),accounts={...d.verifiedAccounts,...d.registered};
 const people=Object.values(d.people).flatMap(roster=>Object.values(roster));
 for(const p of people)if(!d.deletedAccounts?.[p.uid])accounts[p.uid]??=p.email;
 const platformOwner=await role()==='admin';
 const playedRooms=Object.values(d.sessions).filter(room=>!room.deletedAt && (room.status==='running'||room.startedAt!=null) && (platformOwner||room.owner===user.uid));
 const users=Object.entries(accounts).map(([uid,email])=>{
  const profile=d.profiles?.[uid];
  const name=[profile?.firstName,profile?.lastName].filter(Boolean).join(' ')||people.find(p=>p.uid===uid)?.name||email;
  const activity=d.accountActivity?.[uid];
  const playedSessionCodes=playedRooms.filter(room=>d.people[room.code]?.[uid] && (room.mode!=='solo'||room.owner===uid)).map(room=>room.code).sort();
  const deletionProtected=protectedRegisteredUser({uid,email},user.uid);
  return {uid,email,name,studentId:profile?.universityId||null,registeredAt:activity?.registeredAt||null,lastSignInAt:activity?.lastSignInAt||null,playedSessionCodes,deletionProtected};
 }).sort((a,b)=>a.uid.localeCompare(b.uid));
 const start=Number(pageToken)||0,end=start+100;
 return {users:users.slice(start,end),nextPageToken:end<users.length?String(end):null};
}

export async function deleteRegisteredUsers(uids) {
 if(await role()!=='admin')throw Error('Only the platform owner can delete registered users.');
 if(!validDeletionBatch(uids))throw Error('Choose between one and ten distinct registered users.');
 const data=load(), ownerUid=user.uid;
 const accounts={...data.verifiedAccounts,...data.registered};
 for(const roster of Object.values(data.people))for(const person of Object.values(roster))
  if(!data.deletedAccounts?.[person.uid])accounts[person.uid]??=person.email;
 const protectedUids=uids.filter(uid=>protectedRegisteredUser({uid,email:accounts[uid]},ownerUid));
 const deletedUids=uids.filter(uid=>!protectedUids.includes(uid));
 const deleting=new Set(deletedUids.filter(uid=>Object.hasOwn(accounts,uid)));
 for(const room of Object.values(data.sessions)) {
  const code=room.code;
  for(const uid of deleting) {
   const plan=planRegisteredUserRemoval(room,uid,ownerUid,deleting);
   if(plan.deleteSession) {
    delete data.sessions[code];delete data.people[code];delete data.orders[code];
    if(data.aiOrders)delete data.aiOrders[code];
    break;
   }
   Object.assign(room,plan.updates);
   const member=data.people[code]?.[uid];
   if(!member)continue;
   if(room.status==='lobby')room.rosterVersion=(room.rosterVersion||0)+1;
   if(plan.keepTeamResult) {
    data.people[code][uid]={uid,name:'Deleted user',email:'',...(member.joinedAt?{joinedAt:member.joinedAt}:{})};
    continue;
   }
   for(const decisions of [data.orders[code],data.aiOrders?.[code]]) {
    if(!decisions)continue;
    if(room.status==='running' && plan.replacementCaptain) {
     if(decisions[uid])decisions[plan.replacementCaptain]=decisions[uid];
     else delete decisions[plan.replacementCaptain];
    }
    delete decisions[uid];
   }
   delete data.people[code][uid];
  }
 }
 data.deletedAccounts??={};
 for(const uid of deleting) {
  data.deletedAccounts[uid]=true;
  data.instructors=data.instructors.filter(email=>email!==accounts[uid]);
  if(data.demoAccountIds)delete data.demoAccountIds[accounts[uid]];
  for(const records of [data.registered,data.verifiedAccounts,data.profiles,data.aiSettings,data.accountActivity,data.studioTeamDefaults])
   if(records)delete records[uid];
  for(const roster of Object.values(data.studioTeamDefaults||{}))delete roster[uid];
 }
 if(deleting.size)write(data);
 return {deletedUids,protectedUids};
}
export async function getUserClassrooms(uid){
 await requireStudio();
 const d=load(),platformOwner=await role()==='admin';
 const sessions=Object.values(d.sessions)
  .filter(room=>platformOwner||room.owner===user.uid)
  .sort((a,b)=>b.createdAt-a.createdAt)
  .map(room=>summarizeUserClassroom(room,uid,!!d.people[room.code]?.[uid]))
  .filter(Boolean);
 return {sessions};
}
function applyTeamChanges(composition,changes,d,maxSize=20){
 for(const [uid,n] of Object.entries(changes)){
  if(n!==null && (d.deletedAccounts?.[uid]||!(d.registered?.[uid] || d.verifiedAccounts?.[uid] || Object.values(d.people).some(roster=>roster[uid]))))throw Error('A selected account no longer exists. Refresh the directory.');
  if(n===null)delete composition[uid];else if(typeof n==='string' && /^([1-9]\d?|100)$/.test(n))composition[uid]=n;else throw Error('Choose a team from 1 to 100.');
 }
 const counts=new Map();
 for(const n of Object.values(composition))counts.set(n,(counts.get(n)||0)+1);
 if(Object.keys(composition).length>500||[...counts.values()].some(n=>n>maxSize))throw Error('Keep each team at or below its configured size and the classroom within 500 users.');
 return composition;
}
export async function getDefaultTeamComposition(){
 await requireStudio();
 return {teamComposition:load().studioTeamDefaults?.[user.uid] || {}};
}
export async function saveDefaultTeamComposition(changes){
 await requireStudio();
 const d=load();
 d.studioTeamDefaults??={};
 const teamComposition=applyTeamChanges({...d.studioTeamDefaults[user.uid]},changes,d);
 d.studioTeamDefaults[user.uid]=teamComposition;
 write(d);
 return {teamComposition};
}
export async function saveTeamComposition(code,changes){
 await requireStudio();
 const d=load(),s=d.sessions[code];
 if(!s||s.status!=='lobby'||s.mode!=='team'||s.owner!==user.uid&&await role()!=='admin')throw Error('Choose a waiting team classroom that you manage.');
 const planned=s.teamComposition!=null?{...s.teamComposition}:s.teamSize==null?getTeamComposition(s):{};
 const composition=applyTeamChanges(planned,changes,d,s.teamSize??20);
 s.teamComposition=composition;
 const teams=materializeTeams(Object.values(d.people[code]||{}),s);
 Object.assign(s,teams);write(d);return {teamComposition:composition,...teams};
}
export async function saveSessionAiOpponent(code,aiOpponent){
 await requireStudio();
 const data=load(),s=data.sessions[code];
 if(s?.owner!==user.uid||s.status!=='lobby'||s.mode==='solo')throw Error('Only the classroom owner can change opponents before the start.');
 if(s.mode==='team'&&aiOpponent)throw Error('Team classrooms use AI in home practice and human opponents in scored seasons.');
 if(aiOpponent?.practice||aiOpponent?.main)s.aiOpponent={...aiOpponent};else delete s.aiOpponent;
 write(data);
}
export async function startSession(code){
 const d=load(),s=d.sessions[code];
 if(s?.status!=='lobby')throw Error('Only a waiting session can start.');
 if(s.mode==='team'){
  Object.assign(s,materializeTeams(Object.values(d.people[code]||{}),s));
  if(!validateTeams(Object.values(d.people[code]||{}),s.assignments,s.teamNames,s.teamSize??20))throw Error('Assign every participant to a team before starting.');
  s.teamOpponents=makeTeamOpponents(s.teamNames);
  s.teamPractice=true;
  delete s.aiOpponent;
 }
 if(s.aiOpponent){
  await requireStudio();
  if(!d.aiSettings?.[s.owner]?.connected[s.aiOpponent.provider])throw Error('Connect the classroom owner’s demo provider before starting.');
  const competitors=Object.keys(d.people[code]||{});
  if(!competitors.length)throw Error('Ask participants to join before starting the AI classroom.');
  d.aiOrders??={};d.aiOrders[code]={};
  for(const uid of competitors){
   const orders={};
   for(const [phase,rounds] of [['practice',[0]],['main',[1,2,3]]]){
    if(!s.aiOpponent[phase])continue;
    const plan=rehearsalAiOrders(s.config,crypto.getRandomValues(new Uint32Array(1))[0]);
    for(const i of rounds)orders[i]=plan[i];
   }
   d.aiOrders[code][uid]=orders;
  }
 }
 Object.assign(s,{status:'running',phaseOffset:s.mode==='team'?180:0,startedAt:Date.now()});
 write(d);
}
export async function closeSession(code){
 const d=load(),s=d.sessions[code];
 if(!s||s.status==='closed')throw Error('The classroom has already closed.');
 if(s.status==='running'&&s.phaseOffset==null)throw Error('The classroom stage is being restored. Try again shortly.');
 Object.assign(s,{status:'closed',closedAt:Date.now()});write(d);
}
export async function joinSession(code,name){
 const d=load(),s=d.sessions[code];
 if(!s||s.deletedAt)throw Error('Session code not found.');
 if(!user?.emailVerified)throw Error('Verify your email before joining a classroom.');
 const uid=user.uid;
 d.people[code]??={};
 const registered=d.people[code][uid];
 if(registered&&(s.status!=='lobby'||s.mode!=='team'||s.assignments?.[uid]))return;
 if(s.status!=='lobby')throw Error('This session has already started or closed.');
 if(s.mode==='team'){
  Object.assign(s,assignJoiningTeam(s,uid));
  if(!registered)s.rosterVersion=(s.rosterVersion??0)+1;
 }
 if(!registered)d.people[code][uid]={uid,name,email:user.email};
 write(d);
}
export const watchParticipants=(code,fn)=>watch(()=>fn(Object.values(load().people[code]||{})));
export const watchOrders=(code,uid,fn)=>watch(()=>fn(load().orders[code]?.[uid]||{}));
export async function saveOrder(code,index,order,phase='plan',expectedRevision){
 const d=load(),s=d.sessions[code],current=phaseAt(sessionProgress(s));
 if(s?.status!=='running'||current.index!==index||current.kind!==phase)throw Error('This decision stage is closed.');
 d.orders[code]??={};
 const saved=d.orders[code][user.uid]??={};
 const revision=saved[index]?.revision??0;
 if(expectedRevision!==undefined&&expectedRevision!==revision)throw Object.assign(new Error('Another device saved a newer decision. Your save was not applied. Review the latest saved values before editing again.'),{code:'decision-conflict'});
 saved[index]={...order,phase,revision:revision+1};
 write(d);
}

export const saveTeams=async(code,assignments,teamNames)=>{const d=load();if(d.sessions[code].status!=='lobby'||!validateTeams(Object.values(d.people[code]||{}),assignments,teamNames,d.sessions[code].teamSize??20))throw Error('Invalid teams.');Object.assign(d.sessions[code],{assignments,teamNames});write(d);};
export async function readMarketOrders(code,captains,rounds,decisionUid){
 const d=load(),config=d.sessions[code]?.aiOpponent;
 return Object.fromEntries(captains.map(uid=>[uid,Object.fromEntries(rounds.filter(i=>!decisionUid||decisionUid===uid||!config?.[i===0?'practice':'main']).map(i=>[i,d.orders[code]?.[uid]?.[i]||null]))]));
}
export async function readAiOrders(code,competitors,config,rounds=[0,1,2,3]){
 const saved=load().aiOrders?.[code]||{};
 return Object.fromEntries(competitors.map(uid=>[uid,Object.fromEntries(rounds.filter(i=>config?.[i===0?'practice':'main']).map(i=>{
  const order=saved[uid]?.[i];
  if(!order)throw Error('The saved AI decision could not be loaded.');
  return [i,order];
 }))]));
}

export const readParticipants=async code=>Object.values(load().people[code]||{});
export const readOrders=async(code,uid)=>load().orders[code]?.[uid]||{};
export const deleteSession=async code=>{const d=load();delete d.sessions[code];delete d.people[code];delete d.orders[code];if(d.aiOrders)delete d.aiOrders[code];write(d);};

export async function saveDefaultField(key,value){
 const data=load();
 const config={...DEFAULT_CONFIG,...data.defaults,[key]:value};
 if(!validateConfig(config))throw new Error('Check the default costs, selling price and salvage value.');
 data.defaults=config;
 write(data);
}

export async function advancePhase(code,next){
 const data=load(),s=data.sessions[code];
 if(s?.status!=='running'||s.phaseOffset==null||next==null||next!==nextPhaseOffset(sessionProgress(s)))throw Error('The classroom has already moved to another stage.');
 if(s.owner!==user.uid&&await role()!=='admin')throw Error('Only the classroom owner or administrator can advance play.');
 s.phaseOffset=next;write(data);
}
