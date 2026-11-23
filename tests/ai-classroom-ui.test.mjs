import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {DEFAULT_CONFIG} from '../model.js';
import {competitorResult} from '../market.js';

test('preassigned team, teammate, instructor export and individual review use the saved opponent', async t => {
 const w=new JSDOM(readFileSync('index.html','utf8'),{url:'http://localhost:8791/?demo&studio=1',pretendToBeVisual:true}).window;
 for(const key of ['document','location','localStorage','sessionStorage','FormData'])globalThis[key]=w[key];
 globalThis.addEventListener=w.addEventListener.bind(w);
 const api=await import('../backend-demo.js'),$=selector=>w.document.querySelector(selector);
 const load=()=>JSON.parse(w.localStorage.getItem('ff:demo:v1'));
 async function wait(check){
  for(let i=0;i<250;i++){if(check())return;await new Promise(r=>setTimeout(r,10));}
  assert.fail(w.document.body.textContent.slice(-1800));
 }
 const original=URL.createObjectURL;let csv;
 URL.createObjectURL=blob=>{csv=blob;return 'blob:ai-classroom';};
 w.HTMLAnchorElement.prototype.click=function(){};
 t.after(async()=>{await api.logout();await new Promise(r=>setTimeout(r,20));w.close();URL.createObjectURL=original;});
 const emails=['captain@example.test','teammate@example.test','rival@example.test','absent@example.test'];
 const ids=emails.map(email=>'demo-'+email);
 for(const email of emails)await api.loginEmail(email);
 await api.loginGoogle();
 const settings=await api.saveAiSettings({provider:'openai',apiKey:'demo-fixture'});
 const aiOpponent={provider:settings.provider,model:settings.model,practice:false,main:true};
 const team=await api.createSession('Team classroom',DEFAULT_CONFIG,'team','TOKYO',aiOpponent);
 const individual=await api.createSession('Individual classroom',DEFAULT_CONFIG,'individual','MILAN',aiOpponent);
 await api.saveTeamComposition(team,{[ids[0]]:'1',[ids[1]]:'1',[ids[2]]:'2',[ids[3]]:'3'});
 const upcoming=(await api.getUserClassrooms(ids[3])).sessions;
 assert.deepEqual(upcoming.map(entry=>[entry.code,entry.joined,entry.team,entry.activeOpponent]),[[team,false,'Team 3',null]]);
 for(const email of emails.slice(0,3)){
  await api.loginEmail(email);await api.joinSession(team,email);
  await api.joinSession(individual,email);
 }
 await api.loginGoogle();
 await api.startSession(team);await api.startSession(individual);
 const data=load(),room=data.sessions[team],human=ids[0];
 assert.equal(room.assignments[ids[1]],human);
 assert.equal(room.teamOpponents[human],ids[2]);
 const memberRoom=(await api.getUserClassrooms(ids[1])).sessions.find(entry=>entry.code===team);
 assert.equal(memberRoom.team,'Team 1');
 assert.equal(memberRoom.practiceOpponent,'Team 2');
 assert.equal(memberRoom.activeOpponent,'Team 2');
 assert.match(memberRoom.mainOpponent,/AI opponent/);
 assert.deepEqual((await api.getUserClassrooms(ids[3])).sessions,[]);
 assert.deepEqual(Object.keys(data.aiOrders[team]).sort(),[human,ids[2]].sort());
 assert.deepEqual(Object.keys(data.aiOrders[individual]).sort(),ids.slice(0,3).sort());
 assert.equal(data.aiOrders[team][human][0],undefined);
 // Settle two classrooms with the same stored decisions the live result readers use.
 for(const code of [team,individual]){
  Object.assign(data.sessions[code],{status:'closed',phaseOffset:960,startedAt:Date.now()-1100000,closedAt:Date.now()});
  data.orders[code]={[human]:{3:{variety:8,quantity:70,cap:20}}};
 }
 w.localStorage.setItem('ff:demo:v1',JSON.stringify(data));
 await import('../main.js?ai-classroom');
 await wait(()=>$('[data-session="TOKYO"]'));
 $('[data-session="TOKYO"]').click();
 await wait(()=>$('#leaderboard h3')&&$('#export')&&!$('#export').disabled);
 assert.deepEqual([...w.document.querySelectorAll('#leaderboard h3')].map(el=>el.textContent).sort(),['Team 1 vs AI opponent','Team 2 vs AI opponent']);
 $('#export').click();
 const lines=(await csv.text()).trim().split('\r\n').map(line=>line.slice(1,-1).split('","'));
 assert.equal(lines.length,7);
 assert.ok(lines[0].includes('AI profit $'));
 const expected=competitorResult({...room,aiOrders:data.aiOrders[team]},3,data.orders[team],human);
 const row=lines.find(cells=>cells[1]==='Team 1'&&cells[3]==='3');
 assert.equal(Number(row[8]),expected.profit);
 assert.equal(Number(row.at(-2)),expected.opponent.sales);
 assert.equal(Number(row.at(-1)),expected.marketDemand);
 for(const [code,email] of [[team,emails[1]],[individual,emails[0]]]){
  await api.logout();await wait(()=>$('#open-login'));w.history.replaceState({},'','/?demo');
  await api.loginEmail(email);await wait(()=>$('#my-profile'));$('#my-profile').click();
  await wait(()=>$('[data-history="'+code+'"]'));$('[data-history="'+code+'"]').click();
  await wait(()=>$('#season-results'));
  assert.match($('#season-results').textContent,/AI profit/);
  const result=competitorResult({...data.sessions[code],aiOrders:data.aiOrders[code]},3,data.orders[code],human);
  assert.equal($('#season-results tbody tr:last-child [data-label="Sales · yours / AI / market demand"]').textContent,
   result.sales+' / '+result.opponent.sales+' / '+result.marketDemand);
 }
});
