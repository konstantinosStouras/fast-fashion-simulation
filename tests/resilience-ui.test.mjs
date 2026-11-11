import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {DEFAULT_CONFIG} from '../model.js';

test('slow subscriptions, live updates, cancelled navigation and large classroom editing',async t=>{
 const dom=new JSDOM(readFileSync('index.html','utf8'),{url:'http://localhost:8791/?demo',pretendToBeVisual:true}),w=dom.window;
 for(const k of ['document','location','localStorage','sessionStorage','FormData'])globalThis[k]=w[k];
 globalThis.addEventListener=w.addEventListener.bind(w);
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 const $=s=>w.document.querySelector(s),click=s=>$(s).click(),submit=s=>$(s).dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
 const wait=async fn=>{for(let i=0;i<1000;i++){await new Promise(r=>setTimeout(r,10));if(fn())return;}throw Error('Condition not reached: '+w.document.body.textContent.slice(-1000));};
 const api=await import('../backend-demo.js');let holdOrders=false,pendingOrders=[],slowProfile=null,failSave=false,saveGate=null,orderStatus=null;
 globalThis.__resilienceApi={...api,saveOrder:async(...args)=>{if(saveGate)await saveGate;if(failSave)throw Error('Test connection unavailable');return api.saveOrder(...args);},watchOrders:(code,uid,fn,error,status)=>{orderStatus=status;return api.watchOrders(code,uid,o=>{if(holdOrders)pendingOrders.push(()=>fn(o));else fn(o);},error);},getProfile:()=>slowProfile||api.getProfile()};

 let source=readFileSync('main.js','utf8').replace(/api=await import\(demo\?'\.\/backend-demo\.js':'\.\/backend\.js\?v=[^']+'\)/,"api=globalThis.__resilienceApi");
 source=source.replace(/from '(\.\/[^']+)'/g,(_,p)=>'from '+JSON.stringify(new URL('../'+p.slice(2),import.meta.url).href));
 t.after(async()=>{await api.logout();await new Promise(r=>setTimeout(r,20));w.close();delete globalThis.__resilienceApi;});
 await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 await wait(()=>$('#open-login'));await api.loginEmail('resilience@example.test');await wait(()=>$('#join'));
 const code=await api.createSession('Slow classroom',DEFAULT_CONFIG);await api.joinSession(code,'Tester');await api.startSession(code);await api.saveOrder(code,0,{variety:4,quantity:123,cap:0});
 holdOrders=true;$('#join [name=code]').value=code;submit('#join');await wait(()=>pendingOrders.length);
 await t.test('cannot submit defaults while the saved order is still loading',()=>{assert.equal($('#order-form'),null);assert.match($('#app').textContent,/Loading.*(decision|order)/i);});
 holdOrders=false;pendingOrders.splice(0).forEach(fn=>fn());await wait(()=>$('#order-form'));
 assert.equal($('#order-form [name=quantity]').value,'123');
 $('#order-form [name=quantity]').value='137';await api.saveDefaults(DEFAULT_CONFIG);
 await t.test('unrelated subscription updates preserve unsaved quantities',()=>assert.equal($('#order-form [name=quantity]').value,'137'));
 submit('#order-form');await wait(()=>$('.save-state').textContent.includes('137'));
 await t.test('unsaved edits, pending saves and failed retries are visible next to the decision',async()=>{
  $('#order-form [name=quantity]').value='145';$('#order-form [name=quantity]').dispatchEvent(new w.Event('input',{bubbles:true}));assert.match($('.save-state').textContent,/Unsaved changes/);
  let releaseSave;saveGate=new Promise(resolve=>releaseSave=resolve);failSave=true;submit('#order-form');await wait(()=>$('.save-state').dataset.state==='saving');assert.match($('.save-state').textContent,/Saving/);
  releaseSave();await wait(()=>$('.save-state').dataset.state==='error');assert.equal($('#order-form [name=quantity]').value,'145');assert.match($('.save-state').textContent,/not confirmed/);
  saveGate=null;failSave=false;submit('#order-form');await wait(()=>$('.save-state').textContent.includes('Saved:')&&$('.save-state').textContent.includes('145'));assert.equal($('.save-state').getAttribute('role'),'status');
 });
 await t.test('offline recovery preserves drafts and blocks saving until server confirmation',async()=>{
  $('#order-form [name=quantity]').value='151';$('#order-form [name=quantity]').dispatchEvent(new w.Event('input',{bubbles:true}));
  w.dispatchEvent(new w.Event('offline'));assert.equal($('#save-order').disabled,true);assert.match($('#connection-status').textContent,/Offline.*clock keeps running/);
  orderStatus(false);w.dispatchEvent(new w.Event('online'));assert.equal($('#save-order').disabled,true);assert.match($('#connection-status').textContent,/Reconnecting/);assert.equal($('#order-form [name=quantity]').value,'151');
  orderStatus(true);assert.equal($('#save-order').disabled,false);assert.equal($('#order-form [name=quantity]').value,'151');
  submit('#order-form');await wait(()=>$('.save-state').textContent.includes('Saved:')&&$('.save-state').textContent.includes('151'));
 });
 await t.test('return after suspension immediately moves past expired deadlines',async()=>{
  const realNow=Date.now;Date.now=()=>realNow()+95000;
  try{w.document.dispatchEvent(new w.Event('visibilitychange'));assert.equal($('#order-form [name=quantity]'),null);assert.ok($('#order-form [name=cap]'));assert.equal($('#order-form [name=cap]').value,'0');}finally{Date.now=realNow;w.dispatchEvent(new w.Event('pageshow'));}
  assert.equal($('#order-form [name=quantity]').value,'151');
 });
 let resolveProfile;slowProfile=new Promise(resolve=>{resolveProfile=resolve;});click('#my-profile');
 // Signing out from another tab can arrive while the profile request is pending.
 await api.logout();await wait(()=>$('#open-login'));resolveProfile({firstName:'Old',lastName:'User',universityId:'old'});slowProfile=null;await new Promise(r=>setTimeout(r,30));
 await t.test('a delayed profile response cannot restore a signed-out view',()=>{assert.equal($('#profile-form'),null);assert.ok($('#enter'));});
 await api.loginGoogle();await wait(()=>$('#staff'));click('#staff');await wait(()=>$('#create'));
 $('#create [name=name]').value='Large team classroom';$('#create [name=mode]').value='team';submit('#create');await wait(()=>$('#team-setup'));
 const data=JSON.parse(w.localStorage.getItem('ff:demo:v1')),teamCode=Object.values(data.sessions).find(s=>s.mode==='team').code;
 data.people[teamCode]=Object.fromEntries(Array.from({length:500},(_,i)=>['p'+i,{uid:'p'+i,name:'Person '+i,email:'p'+i+'@example.test'}]));
 holdOrders=true;w.localStorage.setItem('ff:demo:v1',JSON.stringify(data));await api.saveDefaults(DEFAULT_CONFIG);await wait(()=>$('[data-team-member]'));
 await t.test('CSV export waits for all participant order subscriptions',()=>{assert.equal($('#export').disabled,true);assert.match($('#roster').textContent,/Loading/);});
 holdOrders=false;pendingOrders.splice(0).forEach(fn=>fn());await wait(()=>!$('#export').disabled);
 $('#team-size').value='5';$('[data-team-member="p0"]').value='p0';await api.saveDefaults(DEFAULT_CONFIG);
 await t.test('roster notifications preserve team setup drafts',()=>{assert.equal($('#team-size').value,'5');assert.equal($('[data-team-member="p0"]').value,'p0');});
 await t.test('large rosters use a bounded membership editor',()=>assert.equal(w.document.querySelectorAll('[data-team-member]').length,25));
 click('#team-next');assert.ok($('[data-team-member="p25"]'));click('#team-prev');assert.equal($('[data-team-member="p0"]').value,'p0');
 const assignments=Object.fromEntries(Array.from({length:500},(_,i)=>['p'+i,'p'+(Math.floor(i/5)*5)])),names=Object.fromEntries(Array.from({length:100},(_,i)=>['p'+i*5,'Team '+i]));
 await api.saveTeams(teamCode,assignments,names);await wait(()=>$('[data-team-member="p1"]').value==='p0');
 $('[data-team-member="p1"]').value='p25';click('#team-next');$('[data-team-member="p26"]').value='p0';submit('#team-form');
 await wait(()=>$('#notice').textContent==='Team membership saved.');
 await t.test('saving membership includes edits from every page',()=>{const saved=JSON.parse(w.localStorage.getItem('ff:demo:v1')).sessions[teamCode].assignments;assert.equal(saved.p1,'p25');assert.equal(saved.p26,'p0');assert.equal(Object.keys(saved).length,500);});
 await api.closeSession(teamCode);await wait(()=>$('#app').textContent.includes('Session closed'));
 await t.test('closing a lobby produces no scored results and remains navigable',()=>{assert.ok($('#back-staff'));assert.doesNotMatch($('#roster').textContent,/NaN|undefined/);});
 await api.logout();await wait(()=>$('#open-login'));await api.loginEmail('longname@example.test');await wait(()=>$('#solo-play'));await api.saveProfile({firstName:'A'.repeat(60),lastName:'B'.repeat(60),universityId:'LONG'});click('#my-profile');await wait(()=>$('#profile-home'));click('#profile-home');click('#solo-play');await wait(()=>$('#start-solo'));
 await t.test('long valid profile names fit the participant name limit',()=>{const d=JSON.parse(w.localStorage.getItem('ff:demo:v1')),solo=Object.values(d.sessions).find(s=>s.mode==='solo');assert.equal(d.people[solo.code][api.currentUser().uid].name.length,80);});
});
