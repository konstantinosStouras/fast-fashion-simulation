import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

test('instructor rehearsal follows every student deadline without writing classroom records',async t=>{
 const dom=new JSDOM(readFileSync('index.html','utf8'),{url:'http://localhost:8791/?demo',pretendToBeVisual:true});
 const w=dom.window;
 for(const k of ['document','location','localStorage','sessionStorage','FormData'])globalThis[k]=w[k];
 globalThis.addEventListener=w.addEventListener.bind(w);
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 const $=s=>w.document.querySelector(s),click=s=>$(s).click(),submit=s=>$(s).dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
 const wait=async fn=>{for(let i=0;i<100;i++){await new Promise(r=>setTimeout(r,10));if(fn())return;}throw Error('UI condition not reached: '+w.document.body.textContent.slice(-800));};
 const backend=await import('../backend-demo.js');
 t.after(async()=>{await backend.logout();await new Promise(r=>setTimeout(r,20));dom.window.close();});
 await import('../main.js?preview-test');await wait(()=>$('#open-login'));
 click('#open-login');click('#google');await wait(()=>$('#staff'));click('#staff');await wait(()=>$('#create'));
 $('#create [name=demandMean]').value='960';
 const before=w.localStorage.getItem('ff:demo:v1');
 const realNow=Date.now;
 const startedAt=realNow();
 let now=startedAt;
 Date.now=()=>now;
 t.after(()=>{Date.now=realNow;});
 const advanceTo=async(seconds,condition)=>{
  now=startedAt+seconds*1000;
  await wait(condition);
 };
 click('#preview-settings');await wait(()=>$('#preview-exit')&&$('#order-form'));
 assert.match($('h1').textContent,/Practice/);assert.match(w.document.body.textContent,/Market mean 960/);assert.equal($('#demo-forward'),null);
 assert.equal($('#preview-next, #preview-round, #preview-restart'),null);
 const saveInitial=async(quantity)=>{
   $('#order-form').elements.quantity.value=String(quantity);
   submit('#order-form');await wait(()=>$('.save-state')?.textContent.includes(String(quantity)));
 };
 const saveRestock=async(seconds)=>{
   await advanceTo(seconds,()=>$('#order-form')?.elements.cap);
   $('#order-form').elements.cap.value='60';
   submit('#order-form');await wait(()=>$('.save-state')?.textContent.includes('cap 60'));
 };
 await saveInitial(90);
 await advanceTo(89,()=>$('#clock')?.textContent==='0:01');
 assert.equal($('#order-form').elements.quantity.value,'90');
 await saveRestock(90);
 for(const [seconds,title,quantity] of [[180,'Order ahead',80],[420,'Respond to demand',70],[660,'Expand the collection',60]]){
   await advanceTo(seconds,()=>$('h1')?.textContent.includes(title));
   if(seconds===660)$('#order-form').elements.variety.value='8';
   await saveInitial(quantity);
   if(seconds===420)await saveRestock(540);
   if(seconds===660)await saveRestock(810);
 }
 await advanceTo(960,()=>$('#season-results')&&$('#clock')?.textContent==='2:00');
 assert.equal($('#order-form'),null);assert.match(w.document.body.textContent,/Practice is excluded/);
 await advanceTo(1080,()=>$('#season-results')&&!$('#clock'));
 assert.equal(w.localStorage.getItem('ff:demo:v1'),before,'preview must not create any database-like records');
 assert.equal(w.localStorage.getItem('ff:session:demo-admin'),null,'preview must not replace real student resume state');
 click('#preview-exit');await wait(()=>$('#create'));
 // Preview an already-running classroom and verify its status, timing and records are unchanged.
 $('#create [name=name]').value='Live class';
 const createdName=$('#create [name=name]').value;
 const createdCard=()=>Array.from(document.querySelectorAll('.studio-session-card')).find(card=>card.querySelector('h4').textContent===createdName);
 submit('#create');
 await wait(createdCard);
 assert.ok($('#create'),'creating a session keeps the admin dashboard open');
 createdCard().querySelector('[data-session]').click();await wait(()=>$('#start'));
 let records=JSON.parse(w.localStorage.getItem('ff:demo:v1')),code=Object.keys(records.sessions)[0];
 await backend.startSession(code);await wait(()=>$('#preview-session')&&!$('#start'));
 const liveBefore=w.localStorage.getItem('ff:demo:v1');
 click('#preview-session');await wait(()=>$('#preview-exit'));assert.match($('h1').textContent,/Practice/);
 await saveInitial(137);
 const rehearsalUrl=w.location.href;
 const reloadStorage={...w.sessionStorage};
 click('#preview-exit');await wait(()=>$('#roster'));assert.equal(w.localStorage.getItem('ff:demo:v1'),liveBefore);
 assert.equal($('#preview-exit'),null);assert.equal($('#start'),null,'the real class must still be running');
 // Bootstrap a fresh app module with the URL and tab storage captured during the rehearsal.
 for(const [key,value] of Object.entries(reloadStorage))w.sessionStorage.setItem(key,value);
 dom.reconfigure({url:rehearsalUrl});
 now+=30000;
 await import('../main.js?preview-test-reloaded');
 await wait(()=>$('#order-form')?.elements.quantity.value==='137'&&$('#clock')?.textContent==='1:00');
 assert.equal(w.localStorage.getItem('ff:demo:v1'),liveBefore);
 // Signing out clears preview and students never receive its controls.
 click('#out');await wait(()=>$('#open-login'));assert.equal($('#preview-exit'),null);
 click('#open-login');$('#email').value='student@example.test';$('#password').value='test-only-123';submit('#auth-form');await wait(()=>$('#join'));
 assert.equal($('#staff'),null);assert.equal($('#preview-settings'),null);assert.equal($('#preview-exit'),null);
});
