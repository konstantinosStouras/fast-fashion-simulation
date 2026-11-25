// Only an opaque tab identifier and expiry times go into sessionStorage. The worker holds
// the last complete server response in memory, scoped to the verified login.
const schema='studio-memory-1';
let registration,activeWorker,tabKey,generation=0,lastConfirmed;
export function startStudioMemory(){
 if(!navigator.serviceWorker)return;
 try{
  tabKey=sessionStorage.getItem(schema);
  if(!tabKey){tabKey=crypto.randomUUID();sessionStorage.setItem(schema,tabKey);}
  if(!registration){
   registration=navigator.serviceWorker.register(new URL('./studio-worker.js',import.meta.url))
    .then(()=>navigator.serviceWorker.ready).then(reg=>activeWorker=reg.active).catch(()=>null);
   // Browsers can stop idle workers while a page is still open. Hand off the
   // last confirmed screen again on departure, with its original expiry.
   const handoff=()=>{if(lastConfirmed&&Date.now()-lastConfirmed.time<300000)send(lastConfirmed);};
   addEventListener('pagehide',handoff);
   document.addEventListener('visibilitychange',()=>{if(document.hidden)handoff();});
  }
 }catch{/* Normal server reads also work when browser storage is unavailable. */}
}
function send(message,reply=false){
 const controller=navigator.serviceWorker?.controller;
 const worker=controller?.scriptURL===new URL('./studio-worker.js',import.meta.url).href?controller:activeWorker;
 if(!worker||!tabKey)return null;
 const payload={schema,tabKey,...message};
 if(!reply){worker.postMessage(payload);return;}
 return new Promise(resolve=>{
  const channel=new MessageChannel();
  const finish=value=>{clearTimeout(timer);channel.port1.close();resolve(value);};
  const timer=setTimeout(()=>finish(null),100);
  channel.port1.onmessage=e=>finish(e.data);
  try{worker.postMessage(payload,[channel.port2]);}catch{finish(null);}
 });
}
export function clearStudioMemory(){
 generation++;lastConfirmed=null;
 if(tabKey)send({op:'clear'});
}
export function studioMemory(user,role,screen){
 const login=user?.metadata?.lastSignInTime;
 if(!user?.emailVerified||!login||!['admin','instructor'].includes(role))return null;
 startStudioMemory();
 if(!tabKey)return null;
 const entry={login:[user.uid,login,role].join('/'),screen},epoch=generation;
 return {
  read:async()=>{
   try{if(Number(sessionStorage.getItem(schema+':until:'+screen))<=Date.now())return null;}catch{}
   const text=await send({...entry,op:'read'},true);
   if(!text||epoch!==generation)return null;
   try{return JSON.parse(text,(_,v)=>v?.__studioTimestamp!==undefined
    ?{toMillis:()=>v.__studioTimestamp,toDate:()=>new Date(v.__studioTimestamp)}:v);}catch{return null;}
  },
  save:(data,profile)=>{
   if(epoch!==generation)return;
   const text=serialize({data,profile});
   if(text.length>1000000)return;
   const message={...entry,op:'save',text,time:Date.now()};
   try{sessionStorage.setItem(schema+':until:'+screen,String(message.time+300000));}catch{}
   lastConfirmed=message;
   const save=()=>{if(epoch===generation)send(message);};
   if(registration)registration.then(worker=>{if(worker)save();});
  }
 };
}
export function serialize(value){
 return JSON.stringify(value,function(key,v){
  const item=this[key];
  return typeof item?.toMillis==='function'?{__studioTimestamp:item.toMillis()}:v;
 });
}
const fields={staff:['listSessions','getDefaults'],ai:['getAiSettings'],teams:['listSessions','getDefaultTeamComposition','listTeamUsers']};

// Record just the first complete load. Pagination stays incremental for the
// live UI, but a partially loaded directory can never become a snapshot.
export function recordStudioReads(api,screen,complete){
 const result={...api},data={},users=[];
 for(const key of fields[screen]){
  result[key]=async(...args)=>{
   const value=await api[key](...args);
   if(key==='listTeamUsers'){
    if(!args[0])users.length=0;
    users.push(...value.users);
    if(value.nextPageToken)return value;
    data[key]={users:[...users],nextPageToken:null};
   }else data[key]=value;
   if(fields[screen].every(name=>Object.hasOwn(data,name))){
    for(const name of fields[screen])result[name]=api[name];
    complete(data);
   }
   return value;
  };
 }
 return result;
}
export function replayStudioReads(api,data){
 const result={...api};
 for(const [key,value] of Object.entries(data)){
  result[key]=()=>{result[key]=api[key];return Promise.resolve(value);};
 }
 return result;
}
export async function finishStudioReads(api,reads){
 const entries=await Promise.all(Object.entries(reads).map(async([key,request])=>{
  let value=await request;
  if(key==='listTeamUsers'&&value.nextPageToken){
   const users=[...value.users];
   while(value.nextPageToken){value=await api.listTeamUsers(value.nextPageToken);users.push(...value.users);}
   value={users,nextPageToken:null};
  }
  return [key,value];
 }));
 return Object.fromEntries(entries);
}
