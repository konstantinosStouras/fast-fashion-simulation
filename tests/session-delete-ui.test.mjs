import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {DEFAULT_CONFIG} from '../model.js';

test('deletion clears open and offline results, resume links, delayed reads and profile totals',async t=>{
 const dom=new JSDOM(readFileSync('index.html','utf8'),{url:'http://localhost:8791/?demo',pretendToBeVisual:true}),w=dom.window;
 for(const k of ['document','location','localStorage','sessionStorage','FormData'])globalThis[k]=w[k];globalThis.addEventListener=w.addEventListener.bind(w);
 const $=s=>w.document.querySelector(s),submit=s=>$(s).dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
 const wait=async fn=>{for(let i=0;i<300;i++){await new Promise(r=>setTimeout(r,10));if(fn())return;}throw Error(w.document.body.textContent.slice(-1000));};
 const api=await import('../backend-demo.js'),code='DELETEQA',uid='demo-delete@example.test';
 const seed=()=>w.localStorage.setItem('ff:demo:v1',JSON.stringify({instructors:[],sessions:{[code]:{code,name:'Deletion test',owner:'demo-admin',mode:'team',status:'closed',startedAt:Date.now()-700000,closedAt:Date.now()-1000,config:DEFAULT_CONFIG,seed:42,assignments:{[uid]:uid},teamNames:{[uid]:'Deletion team'}}},people:{[code]:{[uid]:{uid,name:'Captain',email:'delete@example.test'}}},orders:{[code]:{[uid]:{1:{variety:4,quantity:120,cap:0},2:{variety:4,quantity:100,cap:45}}}}}));
 seed();let held=false,queued=[],sessionStatus,sessionDeliver,orderDeliver,marketGate=null;
 globalThis.__deleteApi={...api,watchSession:(code,fn,error,status)=>{sessionStatus=status;sessionDeliver=fn;return api.watchSession(code,s=>{if(held)queued.push(()=>{status?.(true);fn(s);});else{status?.(true);fn(s);}},error);},watchOrders:(code,uid,fn,error,status)=>{orderDeliver=fn;return api.watchOrders(code,uid,fn,error,status);},readMarketOrders:async(...args)=>{const snapshot=await api.readMarketOrders(...args);if(marketGate)await marketGate;return snapshot;}};
 let source=readFileSync('main.js','utf8').replace(/api=await import\(demo\?'\.\/backend-demo\.js':'\.\/backend\.js\?v=[^']+'\)/,'api=globalThis.__deleteApi');source=source.replace(/from '(\.\/[^']+)'/g,(_,p)=>'from '+JSON.stringify(new URL('../'+p.slice(2),import.meta.url).href));
 t.after(async()=>{await api.logout();await new Promise(r=>setTimeout(r,20));w.close();delete globalThis.__deleteApi;});
 await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));await wait(()=>$('#open-login'));await api.loginEmail('delete@example.test');await wait(()=>$('#join'));$('#join [name=code]').value=code;submit('#join');await wait(()=>$('.result-stats'));
 const reopen=async()=>{seed();$('#deleted-home').click();await wait(()=>$('#join'));$('#join [name=code]').value=code;submit('#join');};
 const assertCleared=()=>{assert.equal($('.result-stats'),null);assert.equal($('#leaderboard'),null);assert.equal($('#order-form'),null);assert.equal(new URL(w.location.href).searchParams.has('session'),false);assert.equal(w.localStorage.getItem('ff:session:'+uid),null);assert.equal(w.sessionStorage.getItem('ff:session:'+uid),null);};
 // Confirmed parent deletion wins over callbacks already queued by cancelled subscriptions.
 const oldOrder=orderDeliver;await api.deleteSession(code);await wait(()=>$('#session-unavailable'));assertCleared();oldOrder({1:{variety:4,quantity:5,cap:0}});assertCleared();
 // Offline users hide old scores immediately and receive the deletion explanation on reconnect.
 await reopen();await wait(()=>$('.result-stats'));held=true;w.dispatchEvent(new w.Event('offline'));sessionStatus(false);assert.ok($('#session-rechecking'));assert.equal($('.result-stats'),null);
 await api.deleteSession(code);w.dispatchEvent(new w.Event('online'));assert.equal($('.result-stats'),null);held=false;queued.splice(0).forEach(fn=>fn());await wait(()=>$('#session-unavailable'));assertCleared();
 // Deletion marker clears results before participant cleanup is complete.
 await reopen();await wait(()=>$('.result-stats'));const marker=JSON.parse(w.localStorage.getItem('ff:demo:v1'));marker.sessions[code].deletedAt=Date.now();w.localStorage.setItem('ff:demo:v1',JSON.stringify(marker));await api.saveDefaults(DEFAULT_CONFIG);await wait(()=>$('#session-unavailable'));assertCleared();assert.ok(JSON.parse(w.localStorage.getItem('ff:demo:v1')).orders[code]);
 // In-flight final reads cannot resurrect the removed session.
 let release;marketGate=new Promise(resolve=>release=resolve);await reopen();await wait(()=>$('#app').textContent.includes('Reading the shared market'));await api.deleteSession(code);await wait(()=>$('#session-unavailable'));release();marketGate=null;await new Promise(r=>setTimeout(r,20));assertCleared();
 // Profile history updates its totals while open; an unrelated resume shortcut is preserved.
 await reopen();await wait(()=>$('.result-stats'));$('#my-profile').click();await wait(()=>$('.history-results'));w.localStorage.setItem('ff:session:'+uid,'OTHERAAA');await api.deleteSession(code);await wait(()=>$('#profile-history')?.textContent.includes('No sessions yet'));assert.equal($('.history-results'),null);assert.equal(w.localStorage.getItem('ff:session:'+uid),'OTHERAAA');
});
