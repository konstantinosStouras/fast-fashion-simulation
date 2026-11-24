export function studioScreen(params,location){
 if(params.has('sessionCode')||params.has('session')||params.get('view')==='profile')return '';
 const tab=params.get('studio');
 if(['ai','teams','administrators'].includes(tab))return tab;
 return /\/admin\/(?:index\.html)?$/.test(location.pathname)||tab==='1'||location.hash==='#admin'?'staff':'';
}

// Start the initial screen's reads as soon as the role is confirmed. A panel
// consumes each request once. Its retries, edits and pagination use fresh reads.
function firstRead(read,...args){
 let pending=read(...args);
 // An account change or a failed profile read can discard this startup.
 pending.catch(()=>{});
 return (...nextArgs)=>{
  if(!pending)return read(...nextArgs);
  const first=pending;
  pending=null;
  return first;
 };
}

export function studioStartupApi(api,screen,isOwner){
 if(screen==='ai')return {...api,getAiSettings:firstRead(api.getAiSettings)};
 if(screen==='teams')return {...api,listSessions:firstRead(api.listSessions,isOwner),
  getDefaultTeamComposition:firstRead(api.getDefaultTeamComposition),listTeamUsers:firstRead(api.listTeamUsers)};
 if(screen==='staff')return {...api,listSessions:firstRead(api.listSessions,isOwner),getDefaults:firstRead(api.getDefaults)};
 return api;
}

// Use the document's navigation clock. Browser checks read this after a full
// reload so transport and polling delays do not inflate the screen-ready time.
export function markStudioReady(element){
 const clock=element.ownerDocument.defaultView.performance;
 element.dataset.readyMs=String(Math.round(clock.now()));
}
