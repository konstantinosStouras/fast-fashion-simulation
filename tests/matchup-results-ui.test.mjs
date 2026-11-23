import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {DEFAULT_CONFIG,resultFor} from '../model.js';
import {sharedMarket} from '../market.js';

test('five-team results agree across standings, individual play, history and instructor export',async t=>{
 const w=new JSDOM(readFileSync('index.html','utf8'),{url:'http://localhost:8791/?demo&studio=1',pretendToBeVisual:true}).window;
 for(const k of ['document','location','localStorage','sessionStorage','FormData'])globalThis[k]=w[k];
 globalThis.addEventListener=w.addEventListener.bind(w);
 const $=selector=>w.document.querySelector(selector),all=selector=>Array.from(w.document.querySelectorAll(selector));
 async function waitFor(condition){
  for(let i=0;i<250;i++){if(condition())return;await new Promise(resolve=>setTimeout(resolve,10));}
  assert.fail(w.document.body.textContent.slice(-2000));
 }
 const code='MILAN',names=['Alpha','Bravo','Charlie','Delta','Echo'],seed=57;
 const teams=names.map(name=>{const email=name.toLowerCase()+'@example.test';return {name,uid:'demo-'+email,email};});
 const [a,b,c,d,e]=teams.map(team=>team.uid);
 const teamOpponents={[a]:d,[d]:a,[b]:c,[c]:b,[e]:null};
 const session={code,name:'Five teams',owner:'demo-admin',mode:'team',status:'closed',phaseOffset:960,closedAt:Date.now(),startedAt:Date.now()-1081000,createdAt:Date.now()-1100000,seed,config:DEFAULT_CONFIG,teamOpponents,
  assignments:Object.fromEntries(teams.map(t=>[t.uid,t.uid])),teamNames:Object.fromEntries(teams.map(t=>[t.uid,t.name]))};
 const orders=Object.fromEntries(teams.map(({uid},n)=>[uid,Object.fromEntries([1,2,3].map(i=>[i,{variety:i===3&&n%2===0?8:4,quantity:25+25*n,cap:i===1?0:10*n}]))]));
 w.localStorage.setItem('ff:demo:v1',JSON.stringify({instructors:[],sessions:{[code]:session},people:{[code]:Object.fromEntries(teams.map(t=>[t.uid,t]))},orders:{[code]:orders}}));
 const api=await import('../backend-demo.js');
 const originalCreate=URL.createObjectURL;let csv;
 URL.createObjectURL=blob=>{csv=blob;return 'blob:matchup-test';};
 w.HTMLAnchorElement.prototype.click=function(){};
 t.after(async()=>{await api.logout();await new Promise(resolve=>setTimeout(resolve,20));w.close();URL.createObjectURL=originalCreate;});
 await api.loginGoogle();await import('../main.js?matchup-results-ui');await waitFor(()=>$('[data-session]'));
 $('[data-session]').click();await waitFor(()=>all('#leaderboard h3').length===3);
 const titles=all('#leaderboard h3').map(el=>el.textContent);
 assert.deepEqual(titles,['Alpha vs Delta','Bravo vs Charlie','Echo · Individual play']);
 assert.deepEqual(all('#leaderboard tbody').map(body=>body.rows.length),[2,2,1]);
 assert.equal(all('#leaderboard tbody')[2].querySelector('[data-label="Rank"]'),null);
 $('#export').click();const csvLines=(await csv.text()).trim().split('\r\n');
 const fields=line=>line.slice(1,-1).split('","');
 assert.match(csvLines[0],/"Play mode","Opponent"$/);
 const exported=csvLines.slice(1).map(fields);
 assert.equal(exported.length,15);
 for(const {uid,name} of teams){
  const opponent=teamOpponents[uid];
  for(const round of [1,2,3]){
   const order=orders[uid][round];
   const expected=opponent?sharedMarket(seed,round,{[uid]:order,[opponent]:orders[opponent][round]},DEFAULT_CONFIG).teams[uid]:resultFor(seed,round,order,DEFAULT_CONFIG);
   const row=exported.find(r=>r[1]===name&&Number(r[3])===round);
   assert.deepEqual(row.slice(8,13).map(Number),[expected.profit,expected.sales,expected.produced,expected.leftovers,expected.footprint]);
   assert.deepEqual(row.slice(-2),opponent?['Team competition',session.teamNames[opponent]]:['Individual play','']);
  }
 }
 for(const team of [teams[0],teams[4]]){
  await api.logout();await waitFor(()=>$('#open-login'));w.history.replaceState({},'', '/?demo');
  await api.loginEmail(team.email);await waitFor(()=>$('#join'));
  $('#my-profile').click();await waitFor(()=>$('[data-history]'));
  const historyProfit=$('.history-results [data-label="Team profit"]').textContent;
  $('[data-history]').click();await waitFor(()=>$('#season-results'));
  assert.equal($('.result-stats strong').textContent,historyProfit);
  if(team.uid===a){
   assert.deepEqual(all('#leaderboard [data-label="Team"]').map(el=>el.firstChild.textContent).sort(),['Alpha','Delta']);
   assert.match($('.team-standing').textContent,/rank [12] of 2/);
   assert.equal($('.own-team [data-label="Profit"]').textContent,historyProfit);
  }else{
   assert.equal($('#leaderboard'),null);assert.equal($('.results-nav a[href="#leaderboard"]'),null);
   assert.match($('#final-feedback').textContent,/Matched demand draws/);
   const sum=exported.filter(r=>r[1]==='Echo').reduce((n,r)=>n+Number(r[8]),0);
   assert.equal(Number(historyProfit.replace(/[^\d.-]/g,'')),sum);
  }
 }
});
