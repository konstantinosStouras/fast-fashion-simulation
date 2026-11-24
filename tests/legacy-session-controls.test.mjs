import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {DEFAULT_CONFIG} from '../model.js';

test('legacy running session cards support close, delete and delete all',async t=>{
 const dom=new JSDOM(readFileSync('index.html','utf8'),{url:'http://localhost:8791/?demo&studio=1',pretendToBeVisual:true}),w=dom.window;
 for(const key of ['document','location','localStorage','sessionStorage','FormData'])globalThis[key]=w[key];
 globalThis.addEventListener=w.addEventListener.bind(w);
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 const $=s=>w.document.querySelector(s),wait=async fn=>{for(let i=0;i<300;i++){if(fn())return;await new Promise(r=>setTimeout(r,10));}throw Error(w.document.body.textContent.slice(-2000));};
 const sessions={},people={},orders={};
 for(const code of ['OLDCLOSE','OLDDELETE','OLDBULK']){
  sessions[code]={code,name:code,owner:'demo-admin',mode:'team',config:DEFAULT_CONFIG,seed:42,status:'running',createdAt:Date.now()-200000,startedAt:Date.now()-100000,assignments:{alice:'alice'},teamNames:{alice:'Team A'}};
  people[code]={alice:{uid:'alice',name:'Alice'}};orders[code]={alice:{1:{variety:4,quantity:100,cap:0}}};
 }
 w.localStorage.setItem('ff:demo:v1',JSON.stringify({instructors:[],sessions,people,orders}));
 const api=await import('../backend-demo.js');
 t.after(async()=>{await api.logout();await new Promise(r=>setTimeout(r,20));w.close();});
 await api.loginGoogle();await import('../main.js?legacy-session-controls');
 await wait(()=>$('[data-card-close="OLDCLOSE"]'));
 const confirm=async selector=>{await new Promise(r=>setTimeout(r,30));await wait(()=>$(selector)&&!$(selector).disabled);$(selector).click();await wait(()=>$('[data-yes]'));$('[data-yes]').click();};
 const saved=()=>JSON.parse(w.localStorage.getItem('ff:demo:v1'));
 await confirm('[data-card-close="OLDCLOSE"]');
 await wait(()=>$('#past-sessions [data-session="OLDCLOSE"]'));
 assert.equal(saved().sessions.OLDCLOSE.status,'closed');assert.equal(saved().orders.OLDCLOSE.alice[1].quantity,100);
 await confirm('[data-card-delete="OLDDELETE"]');await wait(()=>!$('[data-session="OLDDELETE"]'));
 assert.equal(saved().people.OLDDELETE,undefined);assert.equal(saved().orders.OLDDELETE,undefined);
 await confirm('#active-delete-all');await wait(()=>$('#active-count').textContent==='0 active');
 assert.equal(saved().sessions.OLDBULK,undefined);assert.equal(saved().people.OLDBULK,undefined);assert.equal(saved().orders.OLDBULK,undefined);
 assert.equal(saved().sessions.OLDCLOSE.status,'closed');
});
