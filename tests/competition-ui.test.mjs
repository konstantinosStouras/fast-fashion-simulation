import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {DEFAULT_CONFIG} from '../model.js';
test('solo start, team setup, captain saves, teammate read-only view and period leaderboard',async t=>{
 const dom=new JSDOM(readFileSync('index.html','utf8'),{url:'http://localhost:8791/?demo',pretendToBeVisual:true}),w=dom.window;
 for(const k of ['document','location','localStorage','sessionStorage','FormData'])globalThis[k]=w[k];globalThis.addEventListener=w.addEventListener.bind(w);
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 const $=s=>w.document.querySelector(s),click=s=>$(s).click(),submit=s=>$(s).dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
 const wait=async fn=>{for(let i=0;i<150;i++){await new Promise(r=>setTimeout(r,10));if(fn())return;}throw Error(w.document.body.textContent.slice(-1500));};
 const api=await import('../backend-demo.js');t.after(async()=>{await api.logout();await new Promise(r=>setTimeout(r,20));dom.window.close();});
 await import('../main.js?competition-ui');await wait(()=>$('#open-login'));await api.loginEmail('alice@example.test');await wait(()=>$('#solo-play'));click('#solo-play');await wait(()=>$('#start-solo'));assert.match(w.document.body.textContent,/Before|BEFORE YOU PLAY/);assert.equal($('#clock'),null);click('#start-solo');await wait(()=>$('#order-form'));submit('#order-form');await wait(()=>$('.save-state').textContent.includes('Saved'));let data=JSON.parse(w.localStorage.getItem('ff:demo:v1'));assert.equal(Object.values(data.sessions)[0].mode,'solo');
 await api.logout();await wait(()=>$('#open-login'));await api.loginGoogle();await wait(()=>$('#staff'));click('#staff');await wait(()=>$('#create'));$('#create [name=name]').value='Teams';$('#create [name=mode]').value='team';submit('#create');await wait(()=>$('#team-setup'));
 data=JSON.parse(w.localStorage.getItem('ff:demo:v1'));const code=Object.values(data.sessions).find(s=>s.mode==='team').code;
 // Populate the synthetic classroom with registered participants before testing assignment controls.
 data.people[code]=Object.fromEntries(['alice','bob','charlie','dana'].map(n=>['demo-'+n+'@example.test',{uid:'demo-'+n+'@example.test',name:n,email:n+'@example.test'}]));w.localStorage.setItem('ff:demo:v1',JSON.stringify(data));await api.saveDefaults(DEFAULT_CONFIG);await wait(()=>$('[data-team-member]'));assert.equal($('#team-size').value,'3');click('#group-teams');await wait(()=>Object.keys(JSON.parse(w.localStorage.getItem('ff:demo:v1')).sessions[code].teamNames).length===2);
 const assignments=Object.fromEntries(['alice','bob','charlie','dana'].map(n=>['demo-'+n+'@example.test','demo-'+(['alice','bob'].includes(n)?'alice':'charlie')+'@example.test']));await api.saveTeams(code,assignments,{'demo-alice@example.test':'Team A','demo-charlie@example.test':'Team B'});await api.startSession(code);await wait(()=>$('#leaderboard'));assert.equal($('#team-setup'),null);
 await api.logout();await wait(()=>$('#open-login'));w.localStorage.removeItem('ff:session:demo-alice@example.test');await api.loginEmail('alice@example.test');await wait(()=>$('#join'));$('#join [name=code]').value=code;submit('#join');await wait(()=>$('#order-form'));assert.equal($('#save-order').disabled,false);$('#order-form [name=quantity]').value='93';submit('#order-form');await wait(()=>$('.save-state').textContent.includes('93'));
 await api.logout();await wait(()=>$('#open-login'));await api.loginEmail('bob@example.test');await wait(()=>$('#join'));$('#join [name=code]').value=code;submit('#join');await wait(()=>$('#order-form'));assert.equal($('#save-order').disabled,true);assert.equal($('#order-form [name=quantity]').value,'93');assert.match($('.team-banner').textContent,/captain submits/);
 for(let i=0;i<3;i++){click('#demo-forward');await wait(()=>$('#demo-forward'));}await wait(()=>$('#leaderboard').textContent.includes('after 1 scored periods'));assert.match($('#leaderboard').textContent,/Team A/);assert.match($('#leaderboard').textContent,/Team B/);
 click('#my-profile');await wait(()=>$('#profile-history').textContent.includes('Teams'));assert.doesNotMatch($('#profile-history').textContent,/Solo/);
});

