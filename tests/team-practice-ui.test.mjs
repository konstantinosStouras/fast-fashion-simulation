import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {DEFAULT_CONFIG} from '../model.js';

test('clearing an instructor preview removes both stored and in-memory practice',async()=>{
 const {mountTeamPractice,clearTeamPractice}=await import('../team-practice-ui.js');
 const w=new JSDOM('<section></section>',{url:'http://localhost:8791/'}).window;
 try{
  const panel=w.document.querySelector('section'),userId='teacher';
  const room={code:'PREVIEW',seed:123,config:DEFAULT_CONFIG};
  for(const storage of [w.sessionStorage,{getItem:()=>null,setItem:()=>{},removeItem:()=>{}}]){
   mountTeamPractice(panel,{room,userId,storage});
   panel.querySelector('button').click();
   assert.ok(panel.querySelector('[data-practice-order]'));
   clearTeamPractice(storage,room,userId);
   mountTeamPractice(panel,{room,userId,storage});
   assert.equal(panel.querySelector('[data-practice-order]'),null);
   assert.match(panel.textContent,/Start a practice round/);
  }
 }finally{w.close();}
});

test('students join teams of the configured size, rehearse independently and enter the scored matchup when the instructor starts',async t=>{
 const w=new JSDOM(readFileSync('index.html','utf8'),{url:'http://localhost:8791/?demo',pretendToBeVisual:true}).window;
 for(const key of ['document','location','localStorage','sessionStorage','FormData'])globalThis[key]=w[key];
 globalThis.addEventListener=w.addEventListener.bind(w);
 const api=await import('../backend-demo.js');
 t.after(async()=>{await api.logout();await new Promise(resolve=>setTimeout(resolve,20));w.close();});
 const $=selector=>w.document.querySelector(selector);
 const submit=selector=>$(selector).dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
 const data=()=>JSON.parse(w.localStorage.getItem('ff:demo:v1'));
 async function wait(check){
  for(let i=0;i<180;i++){if(check())return;await new Promise(r=>setTimeout(r,10));}
  assert.fail(w.document.body.textContent.slice(-1800));
 }
 const emails=['captain@example.test','teammate@example.test','rival@example.test'];
 const [captain,teammate,rival]=emails.map(email=>'demo-'+email);
 await api.loginGoogle();
 const code=await api.createSession('At-home practice',DEFAULT_CONFIG,'team','PRACTICE',null,2);
 for(const email of [emails[0],emails[2]]){await api.loginEmail(email);await api.joinSession(code,email);}
 await api.loginEmail(emails[1]);
 await import('../main.js?home-practice-test');
 async function enterLobby(){
  await wait(()=>$('#join') || $('#team-practice'));
  if($('#join')){$('#join [name=code]').value=code;submit('#join');}
  await wait(()=>$('#team-practice'));
 }
 await enterLobby();
 const initial=data();
 assert.equal($('.team-banner h2').textContent,'Team 2');
 assert.deepEqual(initial.sessions[code].assignments,{[captain]:captain,[rival]:captain,[teammate]:teammate});
 $('[data-practice-start]').click();
 $('[data-practice-order] input').value='58';
 submit('[data-practice-order]');
 assert.match($('#team-practice').textContent,/You ordered 58 units per style/);
 assert.equal($('#team-practice tbody').rows.length,4);
 const cap=$('[data-practice-order] input');
 cap.value='13';cap.dispatchEvent(new w.Event('input',{bubbles:true}));

 // A fresh module and DOM mount recover the same midpoint and unsent input from tab storage.
 const fresh=w.document.createElement('section');w.document.body.append(fresh);
 const {mountTeamPractice}=await import('../team-practice-ui.js?reload-test');
 mountTeamPractice(fresh,{room:{...initial.sessions[code],createdAt:{toMillis:()=>initial.sessions[code].createdAt}},userId:teammate,storage:w.sessionStorage,signalTable:()=>'',money:String});
 assert.match(fresh.textContent,/You ordered 58 units per style/);
 assert.equal(fresh.querySelector('input').value,'13');
 fresh.remove();
 assert.deepEqual(data().orders,initial.orders);
 assert.deepEqual(data().sessions[code],initial.sessions[code]);

 await api.saveTeams(code,{[captain]:captain,[teammate]:captain,[rival]:rival},{[captain]:'North',[rival]:'South'});
 await wait(()=>$('.team-banner h2').textContent==='North' && $('[data-practice-order] input'));
 assert.equal($('[data-practice-order] input').value,'13');
 submit('[data-practice-order]');
 assert.match($('#team-practice').textContent,/Practice results/);
 assert.match($('#team-practice tbody').textContent,/AI opponent/);
 $('[data-practice-start]').click();
 assert.match($('#team-practice').textContent,/ROUND 2/);
 $('[data-practice-order] input').value='126';submit('[data-practice-order]');
 await api.logout();await wait(()=>$('#open-login'));
 w.history.replaceState({},'','/?demo');
 await api.loginEmail(emails[0]);await enterLobby();
 assert.match($('#team-practice').textContent,/Start a practice round/);
 $('[data-practice-start]').click();assert.match($('#team-practice').textContent,/ROUND 1/);
 await api.logout();await wait(()=>$('#open-login'));
 w.history.replaceState({},'','/?demo');
 await api.loginEmail(emails[1]);await enterLobby();
 assert.match($('#team-practice').textContent,/You ordered 126 units per style/);
 assert.deepEqual(data().orders,initial.orders);

 await api.startSession(code);
 await wait(()=>$('#order-form') && !$('#team-practice'));
 assert.match($('h1').textContent,/Order ahead/);
 assert.match($('.team-banner').textContent,/South/);
 assert.equal($('#order-form [name=quantity]').disabled,true);
 assert.deepEqual(data().orders,initial.orders);
});
