import {teamRound} from './market.js';
import {ROUNDS,DEFAULT_ORDER,resultFor} from './model.js';
export const PLATFORM_FIELDS=['name','email','studentId','age','gender','nationality','country','levelOfStudy','workExperience','occupation','industry','englishFluency','createdAt','updatedAt'];
export const profileComplete=p=>!!(p?.firstName?.trim()&&p?.lastName?.trim()&&p?.universityId?.trim());
export function profileFields(form){
 const p=Object.fromEntries(['firstName','lastName','universityId'].map(k=>[k,String(form.get(k)||'').trim()]));
 if(!profileComplete(p))throw Object.assign(new Error('Please complete your first name, last name and university ID.'),{code:'profile/invalid'});
 return p;
}
// The portal handoff is registration data, never authentication or authorisation.
export function platformHandoff(storage,user,now=Date.now()){
 if(!user?.emailVerified)return null;
 try{
  const h=JSON.parse(storage.getItem('simp:handoff:v1'));
  if(!h||h.v!==1||!['ffo','fast-fashion-ops','fashion-futures','fast-fashion-simulation'].includes(h.sim)||!Number.isFinite(h.ts)||now-h.ts<0||now-h.ts>21600000)return null;
  if(typeof h.profile?.email!=='string'||h.profile.email.trim().toLowerCase()!==user.email?.trim().toLowerCase())return null;
  const p={};for(const k of PLATFORM_FIELDS){const v=h.profile[k];if(typeof v==='string'||typeof v==='number'){const value=String(v).trim();if(value.length>200)return null;p[k]=value;}}
  return p;
 }catch{return null;}
}
export function historyStats(sessions,now=Date.now()){
 const rows=sessions.map(s=>{
  const seconds=s.startedAt?((s.closedAt?.toMillis()??now)-s.startedAt.toMillis())/1000:-1;
  const assigned=s.mode!=='team'||Object.hasOwn(s.teamNames||{},s.decisionUid);
  const rounds=[1,2,3].filter(i=>assigned&&seconds>=ROUNDS[i].end).map(i=>({round:i,...(s.mode==='team'?teamRound(s,i,s.teamOrders||{}).teams[s.decisionUid]:resultFor(s.seed,i,s.orders[i]||DEFAULT_ORDER,s.config))}));
  const sum=k=>rounds.reduce((a,r)=>a+r[k],0);
  return {...s,rounds,profit:sum('profit'),leftovers:sum('leftovers'),footprint:sum('footprint'),finished:rounds.length===3};
 }).sort((a,b)=>(b.createdAt?.toMillis()||0)-(a.createdAt?.toMillis()||0));
 return {rows,seasons:rows.reduce((a,s)=>a+s.rounds.length,0),finished:rows.filter(s=>s.finished).length,profit:rows.reduce((a,s)=>a+s.profit,0),leftovers:rows.reduce((a,s)=>a+s.leftovers,0),footprint:rows.reduce((a,s)=>a+s.footprint,0)};
}
