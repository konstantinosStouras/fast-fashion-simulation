import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {DEFAULT_CONFIG} from '../model.js';

test('closed team scores use one final server snapshot despite pending saves and delayed listeners',async t=>{
 const dom=new JSDOM(readFileSync('index.html','utf8'),{url:'http://localhost:8791/?demo',pretendToBeVisual:true}),w=dom.window;
 for(const k of ['document','location','localStorage','sessionStorage','FormData'])globalThis[k]=w[k];globalThis.addEventListener=w.addEventListener.bind(w);
 const $=s=>w.document.querySelector(s),submit=s=>$(s).dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
 const wait=async fn=>{for(let i=0;i<300;i++){await new Promise(r=>setTimeout(r,10));if(fn())return;}throw Error(w.document.body.textContent.slice(-1500));};
 const api=await import('../backend-demo.js'),code='CLOSEQA2',captain='demo-captain@example.test',mate='demo-mate@example.test';
 const data={instructors:[],sessions:{[code]:{code,name:'Close race',owner:'demo-admin',mode:'team',status:'running',startedAt:Date.now()-600000,closedAt:null,seed:42,config:DEFAULT_CONFIG,assignments:{[captain]:captain,[mate]:captain},teamNames:{[captain]:'Team A'}}},people:{[code]:{[captain]:{uid:captain,name:'Captain',email:'captain@example.test'},[mate]:{uid:mate,name:'Teammate',email:'mate@example.test'}}},orders:{[code]:{[captain]:{0:{variety:4,quantity:100,cap:20},1:{variety:4,quantity:120,cap:0},2:{variety:4,quantity:110,cap:35,revision:2}}}}};
 w.localStorage.setItem('ff:demo:v1',JSON.stringify(data));
 let rejectSave,releaseMarket,marketGate=null,failMarket=false;const delayed=[];
 globalThis.__closeApi={...api,saveOrder:()=>new Promise((_,reject)=>rejectSave=reject),watchOrders:(code,uid,fn,error,status)=>api.watchOrders(code,uid,o=>{const stale={...o,1:{variety:4,quantity:20,cap:0}};fn(stale);delayed.push(()=>fn(stale));},error,status),readMarketOrders:async(...args)=>{if(marketGate)await marketGate;if(failMarket)throw Error('Offline');return api.readMarketOrders(...args);}};
 let source=readFileSync('main.js','utf8').replace(/api=await import\(demo\?'\.\/backend-demo\.js':'\.\/backend\.js\?v=[^']+'\)/,'api=globalThis.__closeApi');
 source=source.replace(/from '(\.\/[^']+)'/g,(_,p)=>'from '+JSON.stringify(new URL('../'+p.slice(2),import.meta.url).href));
 t.after(async()=>{await api.logout();await new Promise(r=>setTimeout(r,20));w.close();delete globalThis.__closeApi;});
 await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));await wait(()=>$('#open-login'));await api.loginEmail('captain@example.test');await wait(()=>$('#join'));$('#join [name=code]').value=code;submit('#join');await wait(()=>$('#order-form [name=cap]'));
 $('#order-form [name=cap]').value='99';submit('#order-form');await wait(()=>rejectSave);
 marketGate=new Promise(resolve=>releaseMarket=resolve);await api.closeSession(code);await wait(()=>$('#app').textContent.includes('Reading the shared market'));
 assert.equal($('.result-stats'),null,'No provisional final scores before server read');assert.equal($('#pending-save'),null,'Closure must not wait indefinitely for a queued save');
 failMarket=true;releaseMarket();await wait(()=>$('#retry-market'));assert.equal($('.result-stats'),null);
 failMarket=false;marketGate=null;$('#retry-market').click();await wait(()=>$('.own-team'));
 const profit=$('.result-stats strong').textContent;
 assert.equal($('.own-team [data-label="Profit"]').textContent,profit,'Headline and leaderboard use the same final orders');
 assert.match($('#leaderboard').textContent,/after 1 scored periods/);assert.match($('#connection-status').textContent,/final team scores confirmed/);
 delayed.splice(0).forEach(fn=>fn());assert.equal($('.result-stats strong').textContent,profit,'A delayed subscription must not replace final data');
 rejectSave(Object.assign(Error('Closed'),{code:'permission-denied'}));await wait(()=>$('#notice').textContent.includes('session is closed'));assert.equal($('.result-stats strong').textContent,profit);
 await api.logout();await wait(()=>$('#open-login'));await api.loginEmail('mate@example.test');await wait(()=>$('#join'));$('#join [name=code]').value=code;submit('#join');await wait(()=>$('.own-team'));
 assert.equal($('.result-stats strong').textContent,profit);assert.equal($('#order-form'),null);
 await api.logout();await wait(()=>$('#open-login'));w.history.replaceState({},'','/?demo');await api.loginGoogle();await wait(()=>$('#staff'));$('#staff').click();await wait(()=>$('[data-session]'));$('[data-session]').click();await wait(()=>$('#roster [data-label="Profit"]'));
 for(const cell of w.document.querySelectorAll('#roster [data-label="Profit"]'))assert.equal(cell.textContent,profit);
 assert.equal($('#leaderboard [data-label="Profit"]').textContent,profit);
 delayed.splice(0).forEach(fn=>fn());await new Promise(r=>setTimeout(r,20));assert.equal($('#roster [data-label="Profit"]').textContent,profit,'Delayed staff listeners cannot mutate the final snapshot');
 const original=URL.createObjectURL;let csv;URL.createObjectURL=blob=>{csv=blob;return 'blob:close-qa';};w.HTMLAnchorElement.prototype.click=function(){};
 try{$('#export').click();const text=await csv.text();assert.match(text,/"1","4","120","0"/);assert.equal(text.trim().split('\r\n').length,2,'Only the completed scored season is exported');}finally{URL.createObjectURL=original;}
 // Closing during practice must remove both the save form and instructions to keep revising.
 await api.logout();await wait(()=>$('#open-login'));
 const early=JSON.parse(w.localStorage.getItem('ff:demo:v1'));early.sessions[code].startedAt=Date.now()-10000;early.sessions[code].closedAt=null;early.sessions[code].status='running';w.localStorage.setItem('ff:demo:v1',JSON.stringify(early));
 await api.loginEmail('captain@example.test');await wait(()=>$('#order-form'));await api.closeSession(code);await wait(()=>$('.result-stats'));
 assert.equal($('#order-form'),null);assert.equal($('.competition-instructions'),null);assert.equal($('.result-stats strong').textContent,'€0');assert.match($('#notice').textContent,/closed this session/);assert.match($('#season-results').textContent,/No seasons were completed/);
});
