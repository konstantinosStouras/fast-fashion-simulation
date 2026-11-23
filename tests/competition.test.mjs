import test from 'node:test';
import assert from 'node:assert/strict';
import {groupTeams,validateTeams,decisionOwner,leaderboard} from '../competition.js';
import {DEFAULT_CONFIG,resultFor} from '../model.js';
test('team allocation covers every joined student, keeps captains in their team and handles a remainder',()=>{const people=Array.from({length:7},(_,i)=>({uid:'u'+i}));const t=groupTeams(people,3);assert.ok(validateTeams(people,t.assignments,t.teamNames));assert.equal(Object.keys(t.teamNames).length,3);assert.deepEqual(Object.keys(t.assignments).sort(),people.map(p=>p.uid));assert.equal(validateTeams(people,{...t.assignments,u0:'outsider'},t.teamNames),false);assert.throws(()=>groupTeams(people,0));assert.equal(decisionOwner({mode:'team',assignments:{}},'u0'),null);});
test('leaderboard excludes practice and unfinished periods; ties share rank and early closure freezes results',()=>{const s={mode:'team',seed:42,config:DEFAULT_CONFIG,teamNames:{a:'A',b:'B'}};const orders={a:{0:{variety:4,quantity:200,cap:200},1:{variety:4,quantity:0,cap:0}},b:{1:{variety:4,quantity:0,cap:0}}};assert.equal(leaderboard(s,orders,419)[0].periods,0);assert.equal(leaderboard(s,orders,420)[0].periods,1);assert.deepEqual(leaderboard(s,orders,420).map(r=>r.rank),[1,1]);assert.equal(leaderboard(s,orders,659)[0].periods,1);assert.equal(leaderboard(s,orders,960)[0].periods,3);});
test('each matchup has independent standings and an unpaired team has an individual score without a rank',()=>{
 const s={mode:'team',status:'running',seed:42,config:DEFAULT_CONFIG,teamNames:{a:'A',b:'B',c:'C',d:'D',e:'E'},teamOpponents:{a:'d',d:'a',b:'c',c:'b',e:null}};
 const empty={variety:4,quantity:0,cap:0},stocked={variety:4,quantity:100,cap:0};
 const orders={a:{1:stocked},d:{1:empty},b:{1:empty},c:{1:stocked},e:{1:stocked}};
 const ranks=Object.fromEntries(leaderboard(s,orders,420).map(r=>[r.uid,r.rank]));
 assert.deepEqual(ranks,{a:1,d:2,b:2,c:1,e:null});
 const participant=leaderboard(s,orders,420,'d');
 assert.deepEqual(participant.map(r=>[r.uid,r.rank]),[['a',1],['d',2]]);
 assert.deepEqual(leaderboard(s,{a:orders.a,d:orders.d},420,'d'),participant);
 const [unpaired]=leaderboard(s,orders,420,'e');
 assert.equal(unpaired.profit,resultFor(s.seed,1,stocked,s.config).profit);
 assert.equal(unpaired.switchedIn,0);assert.equal(unpaired.switchedOut,0);
 delete s.teamOpponents;
 assert.equal(leaderboard(s,orders,420,'d').length,5,'historical shared-market rankings stay available');
});

test('main AI ranks each team against its own opponent and never includes practice in the standings',()=>{
 const empty={variety:4,quantity:0,cap:0},stocked={variety:4,quantity:200,cap:0};
 const s={mode:'team',status:'running',seed:42,config:{...DEFAULT_CONFIG,demandSd:0},teamNames:{a:'Alpha',b:'Beta',c:'Gamma'},
  teamOpponents:{a:'b',b:'a',c:null},aiOpponent:{practice:false,main:true},aiOrders:{a:{1:empty},b:{1:stocked},c:{1:empty}}};
 const orders={a:{0:empty,1:stocked},b:{0:stocked,1:empty},c:{1:empty}};
 const rows=leaderboard(s,orders,420);
 assert.deepEqual(rows.map(row=>[row.uid,row.rank]),[['a',1],['ai/a',2],['ai/b',1],['b',2],['ai/c',1],['c',1]]);
 const own=leaderboard(s,orders,420,'b');
 assert.deepEqual(own,rows.filter(row=>row.matchup[0]==='b'));
 assert.ok(own[0].isAi);assert.equal(own[0].name,'AI opponent');
 assert.equal(own[0].sales+own[1].sales,480);
 assert.equal(leaderboard(s,orders,419,'b')[0].periods,0);
});
