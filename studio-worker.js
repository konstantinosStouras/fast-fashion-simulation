// No authenticated response is written to CacheStorage, IndexedDB or disk.
const entries=new Map(),ttl=5*60*1000;
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
// Both entry documents are public static HTML. Keep a recent successful copy
// in memory and allow a slow CDN response to update it for the next reload.
const documents=new Map(),base=new URL(self.registration.scope);
self.addEventListener('fetch',event=>{
 const {request}=event,url=new URL(request.url);
 if(request.method!=='GET')return;
 if(request.mode==='navigate'){
  const studio=url.searchParams.get('studio');
  const admin=url.pathname===base.pathname+'admin/'&&!url.search;
  const tab=url.pathname===base.pathname&&['ai','teams','1'].includes(studio)&&[...url.searchParams].length===1;
  if(url.origin!==base.origin||(!admin&&!tab))return;
  const previous=documents.get(url.href);
  const latest=fetch(request).then(response=>{
   if(response.ok&&!response.redirected&&response.headers.get('content-type')?.includes('text/html'))
    documents.set(url.href,{time:Date.now(),response:response.clone()});
   return response;
  });
  if(!previous||Date.now()-previous.time>120000){event.respondWith(latest);return;}
  event.waitUntil(latest.then(()=>{},()=>{}));
  const fallback=()=>previous.response.clone();
  event.respondWith(Promise.race([latest.catch(fallback),new Promise(resolve=>setTimeout(()=>resolve(fallback()),120))]));
 }else if((url.href.startsWith(base.href)&&url.searchParams.has('v')&&/\.(js|css)$/.test(url.pathname))||
          (url.origin==='https://www.gstatic.com'&&/^\/firebasejs\/\d+\.\d+\.\d+\/[\w-]+\.js$/.test(url.pathname))){
  // Normal refresh can use the browser's fresh HTTP cache for versioned
  // assets. A hard reload still explicitly goes to the network.
  if(request.cache!=='reload'&&request.cache!=='no-store')event.respondWith(fetch(request,{cache:'default'}));
 }
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
