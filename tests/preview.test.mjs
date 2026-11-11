import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

test('staff preview plays every phase without writes, clock waiting or live-session changes',async t=>{
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
 click('#preview-settings');await wait(()=>$('#preview-next'));
 assert.match($('h1').textContent,/Practice/);assert.match(w.document.body.textContent,/Market mean 960/);assert.equal($('#demo-forward'),null);
 const clock=$('#clock').textContent,now=Date.now;
 Date.now=()=>now()+3600000;try{await new Promise(r=>setTimeout(r,600));assert.equal($('#clock').textContent,clock);}finally{Date.now=now;}
 for(let round=0;round<4;round++){
   $('#order-form [name=quantity]').value=String(90-round*10);
   if(round===3)$('#order-form [name=variety]').value='8';
   submit('#order-form');await wait(()=>$('.save-state').textContent.includes('Saved'));
   click('#preview-next');
   if(round!==1){assert.ok($('#order-form [name=cap]'));$('#order-form [name=cap]').value='60';submit('#order-form');await wait(()=>$('.save-state').textContent.includes('cap 60'));click('#preview-next');}
 }
 assert.ok($('.stats'));assert.equal($('#order-form'),null);assert.equal($('#preview-round').disabled,true);assert.match(w.document.body.textContent,/Practice is excluded/);
 assert.equal(w.localStorage.getItem('ff:demo:v1'),before,'preview must not create any database-like records');
 assert.equal(w.localStorage.getItem('ff:session:demo-admin'),null,'preview must not replace real student resume state');
 click('#preview-next');assert.equal($('#preview-next').disabled,true);
 click('#preview-restart');assert.match($('h1').textContent,/Practice/);assert.match($('.save-state').textContent,/Not saved/);
 $('#order-form [name=quantity]').value='137';click('#preview-restart');assert.equal($('#order-form [name=quantity]').value,'80','Restart must clear an unsaved draft too');
 click('#preview-round');assert.match($('h1').textContent,/Order ahead/);
 click('#preview-exit');await wait(()=>$('#create'));
 // Preview an already-running classroom and verify its status, timing and records are unchanged.
 $('#create [name=name]').value='Live class';submit('#create');await wait(()=>$('#start'));
 let records=JSON.parse(w.localStorage.getItem('ff:demo:v1')),code=Object.keys(records.sessions)[0];
 await backend.startSession(code);await wait(()=>$('#preview-session')&&!$('#start'));
 const liveBefore=w.localStorage.getItem('ff:demo:v1');
 click('#preview-session');await wait(()=>$('#preview-next'));assert.match($('h1').textContent,/Practice/);
 submit('#order-form');await wait(()=>$('.save-state').textContent.includes('Saved'));click('#preview-round');
 click('#preview-exit');await wait(()=>$('#roster'));assert.equal(w.localStorage.getItem('ff:demo:v1'),liveBefore);
 assert.equal($('#preview-next'),null);assert.equal($('#start'),null,'the real class must still be running');
 // Signing out clears preview and students never receive its controls.
 click('#preview-session');await wait(()=>$('#preview-next'));click('#out');await wait(()=>$('#open-login'));assert.equal($('#preview-next'),null);
 click('#open-login');$('#email').value='student@example.test';$('#password').value='test-only-123';submit('#auth-form');await wait(()=>$('#join'));
 assert.equal($('#staff'),null);assert.equal($('#preview-settings'),null);assert.equal($('#preview-next'),null);
});
