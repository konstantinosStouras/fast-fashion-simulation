import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {DEFAULT_CONFIG} from '../model.js';

test('registration verification gate, formatted session IDs and live team assignment',async t=>{
 const dom=new JSDOM(readFileSync('index.html','utf8'),{url:'http://localhost:8791/?demo&session=demo-aaab',pretendToBeVisual:true}),w=dom.window;
 for(const k of ['document','location','localStorage','sessionStorage','FormData'])globalThis[k]=w[k];globalThis.addEventListener=w.addEventListener.bind(w);
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 const $=s=>w.document.querySelector(s),click=s=>$(s).click(),submit=s=>$(s).dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
 const wait=async fn=>{for(let i=0;i<150;i++){await new Promise(r=>setTimeout(r,10));if(fn())return;}throw Error(w.document.body.textContent.slice(-1200));};
 const api=await import('../backend-demo.js');t.after(async()=>{await api.logout();await new Promise(r=>setTimeout(r,20));w.close();});
 await api.loginGoogle();const code=await api.createSession('Mobile joining class',DEFAULT_CONFIG,'team');
 let data=JSON.parse(w.localStorage.getItem('ff:demo:v1'));data.people[code]={a:{uid:'a',name:'Captain A',email:'a@example.test'},b:{uid:'b',name:'Captain B',email:'b@example.test'}};w.localStorage.setItem('ff:demo:v1',JSON.stringify(data));await api.logout();
 await import('../main.js?registration-join');await wait(()=>$('#open-login'));click('#open-login');click('[data-auth=register]');
 assert.equal(w.document.activeElement,$('#first-name'));assert.equal($('#password-help').hidden,false);
 $('#first-name').value='Casey';$('#last-name').value='Student';$('#university-id').value='QA-123';$('#email').value='casey@example.test';$('#password').value='SyntheticDemoOnly';submit('#auth-form');await wait(()=>$('#verified'));
 assert.equal($('#join'),null);assert.equal((await api.getProfile()).firstName,'Casey');click('#verified');await wait(()=>$('#notice').textContent.includes('not verified'));assert.equal($('#join'),null);
 // Simulate the verification email having been completed; production verification is unchanged.
 api.currentUser().emailVerified=true;click('#verified');await wait(()=>$('#join'));assert.equal($('#session-code').value,code);
 $('#session-code').value='badc-odex';$('#session-code').dispatchEvent(new w.Event('input',{bubbles:true}));assert.equal($('#session-code').value,'BADCODEX');submit('#join');await wait(()=>$('#join-status').textContent.includes('not found'));
 assert.equal($('#join [name=name]').value,'Casey Student');assert.equal($('#session-code').value,'BADCODEX');assert.equal($('#join button').disabled,false);
 $('#session-code').value='demo - aaab';$('#session-code').dispatchEvent(new w.Event('input',{bubbles:true}));assert.equal($('#session-code').value,code);assert.equal($('#session-code').checkValidity(),true);assert.equal($('#join-status').textContent,'');submit('#join');await wait(()=>$('#leave'));
 assert.match($('.team-banner').textContent,/Waiting for team assignment/);assert.match($('.session-context').textContent,new RegExp(code));assert.equal(w.document.activeElement,$('.team-banner h2'));
 const uid=api.currentUser().uid;await api.saveTeams(code,{a:'a',b:'b',[uid]:'a'},{a:'North team',b:'South team'});await wait(()=>$('.team-banner h2').textContent==='North team');assert.match($('.team-role').textContent,/You are a teammate/);
 await api.saveTeams(code,{a:'a',b:'b',[uid]:'b'},{a:'North team',b:'South team'});await wait(()=>$('.team-banner h2').textContent==='South team');
 await api.startSession(code);await wait(()=>$('#order-form'));assert.equal($('#order-form [name=quantity]').disabled,true);assert.equal($('#save-order').hidden,true);assert.equal($('.team-banner h2').textContent,'South team');
});
