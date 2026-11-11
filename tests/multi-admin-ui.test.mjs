import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {DEFAULT_CONFIG} from '../model.js';

test('independent admin studios, owner access management and student join links',async t=>{
 const dom=new JSDOM(readFileSync('index.html','utf8'),{url:'http://localhost:8791/?demo&studio=1',pretendToBeVisual:true}),w=dom.window;
 for(const k of ['document','location','localStorage','FormData'])globalThis[k]=w[k];globalThis.window=w;globalThis.addEventListener=w.addEventListener.bind(w);w.scrollTo=()=>{};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 const $=s=>w.document.querySelector(s),wait=async fn=>{for(let i=0;i<150;i++){await new Promise(r=>setTimeout(r,10));if(fn())return;}throw Error('UI state did not appear');};
 const api=await import('../backend-demo.js');t.after(async()=>{await api.logout();await new Promise(r=>setTimeout(r,20));w.close();});
 await api.loginGoogle();const ownerUid=api.currentUser().uid;const original=await api.createSession('Owner class',DEFAULT_CONFIG);
 await import('../main.js?multi-admin-test');await wait(()=>$('#grant'));
 assert.match($('#app').textContent,/PLATFORM OWNER/);assert.match($('#app').textContent,/Administrators/);
 $('#grant input').value='javad@example.test';$('#grant').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await wait(()=>$('#instructors').textContent.includes('javad@example.test'));
 await api.logout();await api.loginEmail('admin@admin.com','test-only');await wait(()=>$('#create'));
 assert.notEqual(api.currentUser().uid,ownerUid);assert.match($('#account').textContent,/admin@admin.com/);assert.equal($('#grant'),null);assert.equal($('#defaults'),null);assert.ok(!$('#active-sessions').textContent.includes('Owner class'));
 const code=await api.createSession('Dedicated class',DEFAULT_CONFIG);$('#staff').click();await wait(()=>$('[data-card-link]'));
 assert.match($('#app').textContent,/SESSION ID/);assert.equal($('[data-card-link]').dataset.cardLink,code);
 await api.logout();await api.loginEmail('javad@example.test','test-only');await wait(()=>$('#create'));assert.ok(!$('#active-sessions').textContent.includes('Dedicated class'));assert.equal($('#grant'),null);
 const javadCode=await api.createSession('Javad class',DEFAULT_CONFIG);assert.notEqual(javadCode,original);assert.notEqual(javadCode,code);
 await api.logout();dom.reconfigure({url:'http://localhost:8791/?demo&session='+code});globalThis.location=w.location;
 await api.loginEmail('student@example.test','test-only');await wait(()=>$('#join'));assert.equal($('#join').elements.code.value,code);assert.equal($('#staff'),null);
 $('#join').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await wait(()=>$('#app').textContent.includes('Dedicated class'));
});
