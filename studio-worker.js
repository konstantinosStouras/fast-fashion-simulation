// No authenticated response is written to CacheStorage, IndexedDB or disk.
const entries=new Map(),ttl=5*60*1000;
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
// Both entry documents are public static HTML. Keep a recent successful copy
// in memory and allow a slow CDN response to update it for the next reload.
const documents=new Map(),assets=new Map(),studioClients=new Set(),base=new URL(self.registration.scope);
const shellCache='ffo-public-studio-html-v1';
function cacheableShell(response){
 return response.ok&&!response.redirected&&response.headers.get('content-type')?.includes('text/html')&&
  !/private|no-store|no-cache/i.test(response.headers.get('cache-control')||'');
}
async function recentShell(url){
 try{
  const cache=await caches.open(shellCache),response=await cache.match(url);
  const date=Date.parse(response?.headers.get('date'));
  const age=(Date.now()-date)/1000;
  const maxAge=Number(response?.headers.get('cache-control')?.match(/max-age=(\d+)/i)?.[1]||0);
  return age>=0&&age<maxAge?response:null;
 }catch{return null;}
}
self.addEventListener('fetch',event=>{
 const {request}=event,url=new URL(request.url);
 if(request.method!=='GET')return;
 if(request.mode==='navigate'){
  const studio=url.searchParams.get('studio');
  const admin=url.pathname===base.pathname+'admin/'&&!url.search;
  const tab=url.pathname===base.pathname&&['ai','teams','1'].includes(studio)&&[...url.searchParams].length===1;
  if(url.origin!==base.origin||(!admin&&!tab))return;
  if(studioClients.size>=32)studioClients.delete(studioClients.values().next().value);
  studioClients.add(event.resultingClientId);
  const previous=documents.get(url.href);
  const latest=fetch(request).then(response=>{
   if(cacheableShell(response))
    documents.set(url.href,{time:Date.now(),response:response.clone()});
   return response;
  });
  // The public HTML can outlive the worker. Protected data still goes to the
  // server when the five-minute account snapshot has expired.
  event.waitUntil(latest.then(async response=>{
   if(cacheableShell(response)&&typeof caches!=='undefined'){
    const copy=response.clone(),cache=await caches.open(shellCache);await cache.put(url.href,copy);
   }
  }).catch(()=>{}));
  if(request.cache==='reload'||request.cache==='no-store')event.respondWith(latest);
  else if(previous&&Date.now()-previous.time<120000)event.respondWith(previous.response.clone());
  else event.respondWith(recentShell(url.href).then(saved=>saved||latest));
  return;
 }
 if(!studioClients.has(event.clientId)||!['script','style','font'].includes(request.destination))return;
 const vendor=url.origin==='https://www.gstatic.com'&&/^\/firebasejs\/\d+\.\d+\.\d+\/[\w-]+\.js$/.test(url.pathname);
 const local=url.href.startsWith(base.href)&&/\.(js|css|woff2)$/.test(url.pathname);
 if((!local&&!vendor)||request.cache==='no-store'||request.cache==='reload')return;
 // Only public scripts, styles and fonts from this application's admin
 // documents enter this map. Authenticated APIs have other destinations.
 const hit=assets.get(url.href);
 if(hit&&Date.now()<hit.expires){event.respondWith(hit.response.clone());return;}
 event.respondWith(fetch(request,{cache:'default'}).then(response=>{
  const policy=response.headers.get('cache-control')||'';
  const maxAge=Number(policy.match(/(?:^|,)\s*max-age=(\d+)/i)?.[1]||0);
  const age=Number(response.headers.get('age'))||0;
  const seconds=Math.min(Math.max(0,maxAge-age),vendor?600:120);
  if(response.ok&&seconds&&!/no-store|no-cache|private/i.test(policy)&&!response.redirected){
   if(assets.size>=96)assets.delete(assets.keys().next().value);
   assets.set(url.href,{response:response.clone(),expires:Date.now()+seconds*1000});
  }
  return response;
 }));
});
self.addEventListener('message',event=>{
 const m=event.data;
 if(m?.schema!=='studio-memory-1'||typeof m.tabKey!=='string'||!event.source?.url||
    !event.source.url.startsWith(self.registration.scope))return;
 const now=Date.now();
 for(const [key,item] of entries){
  if(now-item.time>=ttl||(m.op==='clear'&&item.tabKey===m.tabKey))entries.delete(key);
 }
 if(!['staff','ai','teams'].includes(m.screen)||typeof m.login!=='string')return;
 const key=JSON.stringify([m.tabKey,m.login,m.screen]);
 if(m.op==='read')event.ports[0]?.postMessage(entries.get(key)?.text??null);
 if(m.op==='save'&&typeof m.text==='string'&&m.text.length<=1000000&&
    Number.isFinite(m.time)&&m.time<=now&&now-m.time<ttl&&!(entries.get(key)?.time>m.time)){
  entries.delete(key);
  if(entries.size>=24)entries.delete(entries.keys().next().value);
  entries.set(key,{tabKey:m.tabKey,text:m.text,time:m.time});
 }
});
