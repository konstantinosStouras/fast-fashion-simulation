import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
test('instructor setup, student code gate, all rounds, saved scoring and sign-out',async t=>{
 const dom=new JSDOM(readFileSync('index.html','utf8'),{url:'http://localhost:8791/?demo',pretendToBeVisual:true});
 const w=dom.window;for(const k of ['document','location','localStorage','sessionStorage','FormData'])globalThis[k]=w[k];globalThis.addEventListener=w.addEventListener.bind(w);globalThis.confirm=()=>{throw Error('Use in-page confirmations');};w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 const $=s=>w.document.querySelector(s),click=s=>$(s).click(),submit=s=>$(s).dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
 const wait=async fn=>{for(let i=0;i<100;i++){await new Promise(r=>setTimeout(r,10));if(fn())return;}throw Error('UI condition not reached: '+w.document.body.textContent.slice(-1000));};
 t.after(async()=>{const b=await import('../backend-demo.js');await b.logout();await new Promise(r=>setTimeout(r,20));dom.window.close();});
 await import('../main.js?ui-test');await wait(()=>$('h1'));assert.match($('h1').textContent,/Speed sells/);assert.equal($('#order-form'),null);
 click('#open-login');assert.equal($('#auth').open,true);click('#google');await wait(()=>$('#staff'));click('#staff');await wait(()=>$('#create'));
 assert.equal($('#create [name=demandMean]').value,'480');assert.equal($('#create [name=demandSd]').value,'96');assert.ok($('.field-description'));
 $('#create [name=name]').value='QA executive class';submit('#create');await wait(()=>$('#start'));
 const data=JSON.parse(w.localStorage.getItem('ff:demo:v1')),code=Object.keys(data.sessions)[0];assert.equal(data.sessions[code].config.demandMean,480);
 click('#out');await wait(()=>$('#open-login'));click('#open-login');$('#email').value='student@example.test';$('#password').value='test-only-123';submit('#auth-form');await wait(()=>$('#join'));assert.equal($('#staff'),null);
 $('#join [name=name]').value='Student';$('#join [name=code]').value='BADCODEX';submit('#join');await wait(()=>$('#notice').textContent.includes('not found'));assert.equal($('#order-form'),null);
 $('#join [name=code]').value=code;submit('#join');await wait(()=>$('#leave'));
 const backend=await import('../backend-demo.js');await backend.startSession(code);await wait(()=>$('#order-form'));
 $('#order-form [name=quantity]').value='100';submit('#order-form');await wait(()=>$('.save-state').textContent.includes('100'));
 click('#demo-forward');assert.ok($('#order-form [name=cap]'));$('#order-form [name=cap]').value='50';submit('#order-form');await wait(()=>$('.save-state').textContent.includes('cap 50'));
 click('#demo-forward');assert.match($('h1').textContent,/Order ahead/);assert.equal($('#order-form [name=cap]'),null);submit('#order-form');await wait(()=>$('.save-state').textContent.includes('Saved'));
 click('#demo-forward');assert.match($('h1').textContent,/Respond to demand/);submit('#order-form');await wait(()=>$('.save-state').textContent.includes('Saved'));click('#demo-forward');$('#order-form [name=cap]').value='60';submit('#order-form');await wait(()=>$('.save-state').textContent.includes('cap 60'));
 click('#demo-forward');assert.match($('h1').textContent,/Expand/);$('#order-form [name=variety]').value='8';$('#order-form [name=quantity]').value='55';submit('#order-form');await wait(()=>$('.save-state').textContent.includes('55'));click('#demo-forward');$('#order-form [name=cap]').value='60';submit('#order-form');await wait(()=>$('.save-state').textContent.includes('cap 60'));click('#demo-forward');
 assert.equal($('.stats')!==null,true);assert.equal($('#order-form'),null);assert.match(w.document.body.textContent,/Practice is excluded/);assert.match(w.document.body.textContent,/20%/);assert.equal(JSON.parse(w.localStorage.getItem('ff:demo:v1')).orders[code]['demo-student@example.test'][3].variety,8);
 click('#out');await wait(()=>$('#open-login'));assert.equal($('.stats'),null);
});

