// Test harness, selected only on loopback hosts with ?demo. Never real authentication.
import {DEFAULT_CONFIG} from './model.js';
const KEY='ff:demo:v1';let user=null;const authListeners=new Set(),listeners=new Set();
const load=()=>JSON.parse(localStorage.getItem(KEY)||'{"sessions":{},"people":{},"orders":{},"instructors":[]}');
function write(data){localStorage.setItem(KEY,JSON.stringify(data));listeners.forEach(fn=>fn());}
const timestamp=n=>n==null?null:{toMillis:()=>n};
function watch(fn){listeners.add(fn);queueMicrotask(fn);return ()=>listeners.delete(fn);}
addEventListener('storage',e=>{if(e.key===KEY)listeners.forEach(fn=>fn());});
export const currentUser=()=>user;
export const observeAuth=fn=>{authListeners.add(fn);queueMicrotask(()=>fn(user));return ()=>authListeners.delete(fn);};
async function login(email){user={uid:email==='kstouras@gmail.com'?'demo-admin':'demo-'+email,email,emailVerified:true,displayName:email==='kstouras@gmail.com'?'Demo instructor':'Demo participant'};authListeners.forEach(fn=>fn(user));}
export const loginGoogle=()=>login('kstouras@gmail.com');
export const loginEmail=(email,password)=>login(email);
export const register=loginEmail;
export const logout=async()=>{user=null;authListeners.forEach(fn=>fn(null));};
export const verifyEmail=async()=>{};
export const refreshUser=async()=>user;
export const resetPassword=async()=>{};
export const role=async()=>user?.email==='kstouras@gmail.com'?'admin':load().instructors.includes(user?.email)?'instructor':'student';
export const grant=async email=>{const d=load();d.instructors.push(email);write(d);};
export const revoke=async email=>{const d=load();d.instructors=d.instructors.filter(x=>x!==email);write(d);};
export const listInstructors=async()=>load().instructors;
export const getDefaults=async()=>load().defaults||DEFAULT_CONFIG;
export const saveDefaults=async config=>{const d=load();d.defaults=config;write(d);};
const toSession=s=>s?{...s,createdAt:timestamp(s.createdAt),startedAt:timestamp(s.startedAt),closedAt:timestamp(s.closedAt)}:null;
export async function createSession(name,config){const d=load(),code='DEMO'+String(Object.keys(d.sessions).length).padStart(4,'A').replace(/0/g,'B').replace(/1/g,'C');d.sessions[code]={code,name,config,seed:42,owner:user.uid,status:'lobby',createdAt:Date.now(),startedAt:null,closedAt:null};write(d);return code;}
export const listSessions=async()=>Object.values(load().sessions).map(toSession);
export const watchSession=(code,fn)=>watch(()=>fn(toSession(load().sessions[code])));
export const startSession=async code=>{const d=load();Object.assign(d.sessions[code],{status:'running',startedAt:Date.now()});write(d);};
export const closeSession=async code=>{const d=load();Object.assign(d.sessions[code],{status:'closed',closedAt:Date.now()});write(d);};
export async function joinSession(code,name){const d=load();if(!d.sessions[code])throw new Error('Session code not found.');d.people[code]??={};if(!d.people[code][user.uid]){if(d.sessions[code].status!=='lobby')throw new Error('Already started.');d.people[code][user.uid]={uid:user.uid,name,email:user.email};write(d);}}
export const watchParticipants=(code,fn)=>watch(()=>fn(Object.values(load().people[code]||{})));
export const watchOrders=(code,uid,fn)=>watch(()=>fn(load().orders[code]?.[uid]||{}));
export const saveOrder=async(code,index,order)=>{const d=load();d.orders[code]??={};d.orders[code][user.uid]??={};d.orders[code][user.uid][index]=order;write(d);};
