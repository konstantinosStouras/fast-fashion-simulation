import {app,auth} from './studio-auth.js';

import {collection,doc,getDoc,getDocs,getFirestore,query,where} from 'https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore-lite.js';
import {getFunctions,httpsCallable} from 'https://www.gstatic.com/firebasejs/12.5.0/firebase-functions.js';
import {ADMIN_EMAIL,DATABASE} from './firebase-config.js';
import {DEFAULT_CONFIG} from './model.js';
import {studioScreen} from './studio-startup.js?v=studio-speed-2';

// Start server reads independently of the gameplay modules and realtime SDK.
// The full application reuses the same named Firebase app and Auth instance.

const db=getFirestore(app,DATABASE),functions=getFunctions(app,'europe-west1');
const panel=httpsCallable(functions,'readStudioPanel',{timeout:125000});

const documentData=async(path,id)=>(await getDoc(doc(db,path,id))).data();
let pending,started=false;

export function preloadStudio(){
 const params=new URLSearchParams(location.search);
 const screen=studioScreen(params,location);
 if(started||params.has('testRound')||!['staff','ai','teams'].includes(screen))return;
 started=true;
 pending=(async()=>{
  await auth.authStateReady();
  const user=auth.currentUser;
  if(!user?.emailVerified)return null;
  const isOwner=user.email===ADMIN_EMAIL;
  if(!isOwner&&!(await getDoc(doc(db,'instructors',user.email))).exists())return null;
  if(auth.currentUser!==user)return null;
  const api={
   getAiSettings:async()=>(await panel({screen:'ai'})).data,
   listTeamUsers:async token=>(await panel({screen:'teams',...(token?{pageToken:token}:{})})).data,
   getDefaults:async()=>(await documentData('settings','defaults'))??{...DEFAULT_CONFIG},
   getDefaultTeamComposition:async()=>({teamComposition:(await documentData('studioTeamDefaults',user.uid))?.teamComposition??{}}),
   listSessions:async all=>{
    const rooms=collection(db,'sessions');
    const result=await getDocs(all?rooms:query(rooms,where('owner','==',user.uid)));
    return result.docs.map(d=>({code:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.toMillis()||0)-(a.createdAt?.toMillis()||0));
   }
  };
  const readStart=Math.round(performance.now());
  const reads=screen==='staff'?{listSessions:api.listSessions(isOwner),getDefaults:api.getDefaults()}:
   screen==='teams'?{listSessions:api.listSessions(isOwner),getDefaultTeamComposition:api.getDefaultTeamComposition(),listTeamUsers:api.listTeamUsers()}:
   {getAiSettings:api.getAiSettings()};
  for(const request of Object.values(reads))request.catch(()=>{});
  const profile=documentData('profiles',user.uid);
  profile.catch(()=>{});
  return {user,screen,role:isOwner?'admin':'instructor',reads,profile,readStart};
 })();
 pending.catch(()=>{});
}

export async function takeStudioStartup(user,screen){
 preloadStudio();
 const request=pending;
 pending=null;
 const result=await request;
 return result?.user===user&&result.screen===screen&&auth.currentUser===user?result:null;
}
