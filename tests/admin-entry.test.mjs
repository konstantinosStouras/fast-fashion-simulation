import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
test('studio deep link opens authorized studio but never grants a student access',async t=>{
 const dom=new JSDOM(readFileSync('index.html','utf8'),{url:'http://localhost:8791/?demo&studio=1'}),w=dom.window;
 for(const k of ['document','location','localStorage','FormData'])globalThis[k]=w[k];globalThis.addEventListener=w.addEventListener.bind(w);
 const wait=async fn=>{for(let i=0;i<100;i++){await new Promise(r=>setTimeout(r,10));if(fn())return;}throw Error('Expected studio state did not appear');};
 const api=await import('../backend-demo.js');t.after(async()=>{await api.logout();await new Promise(r=>setTimeout(r,20));w.close();});
 const entry=w.document.querySelector('script[type="module"][src]').getAttribute('src');
 await api.loginGoogle();await import(new URL('../'+entry,import.meta.url));await wait(()=>w.document.querySelector('#create'));assert.ok(w.document.querySelector('#preview-settings'));
 await api.logout();await wait(()=>w.document.querySelector('#admin-login'));await api.loginEmail('student@example.test','synthetic-only');await wait(()=>w.document.querySelector('#admin-message')?.textContent.includes('does not have administrator access'));assert.equal(w.document.querySelector('#create'),null);assert.equal(w.document.querySelector('#staff'),null);
});
