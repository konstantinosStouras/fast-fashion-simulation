import test from 'node:test';
import assert from 'node:assert/strict';
import {aiActive,competitorResult,makeTeamOpponents,sharedMarket,teamMatchup,teamMatchups,teamRound} from '../market.js';
import {DEFAULT_CONFIG,DEFAULT_ORDER,resultFor,signalFor} from '../model.js';
import {historyStats} from '../profile.js';
const c={...DEFAULT_CONFIG,demandMean:480,demandSd:0,rebound:0};
const stocked={variety:4,quantity:200,cap:0},empty={variety:4,quantity:0,cap:0};
test('one finite market is conserved and a stocked team wins customers from a stocked-out rival',()=>{const balanced=sharedMarket(42,1,{a:stocked,b:stocked},c),short=sharedMarket(42,1,{a:stocked,b:empty},c);assert.equal(short.demand,480);assert.equal(short.sales,480);assert.equal(short.teams.a.sales,480);assert.equal(short.teams.b.sales,0);assert.ok(short.teams.a.sales>balanced.teams.a.sales);assert.equal(short.teams.a.switchedIn,short.teams.b.switchedOut);assert.ok(short.teams.a.switchedIn>0);assert.equal(short.lostSales,0);const none=sharedMarket(42,1,{a:empty,b:empty},c);assert.equal(none.sales,0);assert.equal(none.lostSales,480);});
test('expanding variety steals market share without inventing demand when rebound is zero',()=>{let gain=0;for(let seed=0;seed<30;seed++){const focused=sharedMarket(seed,3,{a:stocked,b:stocked},c),expanded=sharedMarket(seed,3,{a:{...stocked,variety:8},b:stocked},c);assert.equal(expanded.demand,focused.demand);assert.equal(expanded.sales,480);gain+=expanded.teams.a.sales-focused.teams.a.sales;assert.equal(expanded.teams.a.sales-focused.teams.a.sales,focused.teams.b.sales-expanded.teams.b.sales);}assert.ok(gain>0);});
test('growth is applied once to the market and weighted by the fraction of expanded teams',()=>{const r=sharedMarket(42,3,{a:{...stocked,variety:8},b:stocked},{...c,rebound:.2});assert.equal(r.demand,528);assert.equal(sharedMarket(42,3,{a:{...stocked,variety:8},b:{...stocked,variety:8}},{...c,rebound:.2}).demand,576);});
test('replenishment cannot change early signals; results conserve stock and cash and are independent of team map order',()=>{const orders={a:{variety:4,quantity:20,cap:60},b:{variety:4,quantity:30,cap:0}},r=sharedMarket(42,2,orders,c),without=sharedMarket(42,2,{...orders,a:{...orders.a,cap:0}},c);assert.deepEqual(r.teams.a.signals,without.teams.a.signals);assert.deepEqual(r,sharedMarket(42,2,{b:orders.b,a:orders.a},c));for(const [uid,t]of Object.entries(r.teams)){assert.equal(t.produced,t.sales+t.leftovers);assert.equal(t.profit,t.sales*c.price+t.leftovers*c.salvage-orders[uid].variety*orders[uid].quantity*c.initialCost-t.replenished*c.refillCost-orders[uid].variety*c.styleCost);assert.ok(Number.isFinite(t.profit));}assert.ok(r.sales<=r.demand);});
test('profile history uses shared team outcomes and freezes early-closed periods',()=>{const s={mode:'team',seed:42,config:c,teamNames:{a:'A',b:'B'},decisionUid:'a',teamOrders:{a:{1:stocked},b:{1:empty}},orders:{1:stocked},startedAt:{toMillis:()=>0},closedAt:{toMillis:()=>430000}};const history=historyStats([s],2000000);assert.equal(history.seasons,1);assert.equal(history.profit,teamRound(s,1,s.teamOrders).teams.a.profit);});

test('lobby teams await the draw and saved opponents survive reordering and renaming',()=>{
 const teamNames={e:'E',b:'B',c:'C',a:'A',d:'D'};
 const lobby={mode:'team',status:'lobby',teamNames};
 const draw=makeTeamOpponents(teamNames);
 assert.deepEqual(Object.keys(draw).sort(),Object.keys(teamNames).sort());
 assert.equal(Object.values(draw).filter(uid=>uid===null).length,1);
 for(const [uid,rival] of Object.entries(draw))if(rival!==null){assert.notEqual(uid,rival);assert.equal(draw[rival],uid);}
 assert.deepEqual(teamMatchups(lobby),[['a'],['b'],['c'],['d'],['e']]);
 assert.deepEqual(teamMatchup(lobby,'b'),['b']);
 assert.deepEqual(teamMatchup(lobby,'outsider'),[]);
 const running={...lobby,status:'running',teamNames:{a:'Renamed',b:'B',c:'C',d:'D',e:'E'},teamOpponents:{b:'d',d:'b',c:null,a:'e',e:'a'}};
 assert.deepEqual(teamMatchups(running),[['a','e'],['b','d'],['c']]);
 assert.deepEqual(teamMatchup(running,'d'),['d','b']);
 assert.deepEqual(teamMatchups({...lobby,teamNames:{a:'One team'}}),[['a']]);
});

test('each pair gets its own market through practice and every scored season',()=>{
 const teamNames={a:'A',b:'B',c:'C',d:'D'};
 const session={mode:'team',status:'running',teamNames,teamOpponents:{a:'b',b:'a',c:'d',d:'c'},seed:42,config:{...c,rebound:.2}};
 for(const index of [0,1,2,3]){
  const orders={a:{[index]:{...stocked,cap:25}},b:{[index]:empty},c:{[index]:stocked},d:{[index]:stocked}};
  const original=teamRound(session,index,orders);
  const changed=teamRound(session,index,{...orders,c:{[index]:{...empty,variety:index===3?8:4}},d:{[index]:empty}});
  const firstPair=sharedMarket(session.seed,index,{a:orders.a[index],b:empty},session.config);
  assert.deepEqual(original.teams.a,firstPair.teams.a);
  assert.deepEqual(original.teams.b,firstPair.teams.b);
  assert.deepEqual(changed.teams.a,original.teams.a);
  assert.deepEqual(changed.teams.b,original.teams.b);
  assert.deepEqual(teamRound(session,index,{a:orders.a,b:orders.b},'b'),firstPair);
  assert.equal(original.demand,960);
  assert.equal(original.lostSales,original.demand-original.sales);
  assert.equal(changed.demand,index===3?1008:960);
 }
});

test('an unpaired team has individual-play signals, stockouts, growth and scores',()=>{
 for(const teamNames of [{c:'C'},{a:'A',b:'B',c:'C'}]){
  const session={mode:'team',status:'running',teamNames,teamOpponents:Object.keys(teamNames).length===1?{c:null}:{a:'b',b:'a',c:null},seed:141,config:DEFAULT_CONFIG};
  for(const index of [0,1,2,3]){
   const order=index===1?DEFAULT_ORDER:{variety:index===3?8:4,quantity:15,cap:42};
   const orders=index===1?{}:{c:{[index]:order},a:{[index]:empty}};
   const individual=resultFor(session.seed,index,order,session.config);
   const expected={...individual,signals:signalFor(session.seed,index,order,session.config),switchedIn:0,switchedOut:0};
   assert.deepEqual(teamRound(session,index,orders).teams.c,expected);
   assert.deepEqual(teamRound(session,index,orders,'c'),{teams:{c:expected},demand:individual.demand,sales:individual.sales,lostSales:individual.lostSales});
  }
 }
});

test('sessions already underway or closed without saved opponents keep historical market results',()=>{
 const teamNames={a:'A',b:'B',c:'C'};
 const orders={a:{1:stocked},b:{1:empty},c:{1:stocked}};
 const expected=sharedMarket(42,1,{a:stocked,b:empty,c:stocked},c);
 for(const status of ['running','closed']){
  const session={mode:'team',status,teamNames,seed:42,config:c};
  assert.deepEqual(teamMatchup(session,'a'),['a','b','c']);
  assert.deepEqual(teamRound(session,1,orders,'c'),expected);
 }
});

test('AI matchups conserve one fixed pie per entrant even when variety and rebound are high',()=>{
 const expanded={...stocked,variety:8};
 const s={mode:'team',seed:42,config:{...c,rebound:1},teamNames:{a:'A',b:'B',c:'C'},
  teamOpponents:{a:'b',b:'a',c:null},aiOpponent:{main:true,practice:false},
  aiOrders:{a:{3:expanded},b:{3:empty},c:{3:stocked}}};
 const orders={a:{3:expanded},b:{3:expanded},c:{3:empty}};
 const round=teamRound(s,3,orders);
 assert.equal(round.demand,3*480);
 for(const uid of Object.keys(s.teamNames)){
  const result=competitorResult(s,3,orders,uid);
  assert.deepEqual(result,round.teams[uid]);
  assert.equal(result.marketDemand,480);
  assert.equal(result.demand+result.opponent.demand,480);
  assert.equal(result.sales+result.opponent.sales,480);
  assert.equal(result.switchedIn,result.opponent.switchedOut);
 }
 assert.equal(round.teams.b.sales,480);
 assert.equal(round.teams.c.sales,0);
 assert.ok(round.teams.a.sales>0&&round.teams.a.sales<480);
 const otherTeamsChanged={...s,aiOrders:{...s.aiOrders,b:{3:stocked},c:{3:empty}}};
 assert.deepEqual(competitorResult(otherTeamsChanged,3,{a:orders.a},'a'),round.teams.a);
 assert.deepEqual(competitorResult({...s,mode:'individual'},3,orders,'b'),round.teams.b);
});

test('activating only practice changes that phase and unavailable AI plans cannot produce a score',()=>{
 const s={mode:'individual',seed:4,config:c,aiOpponent:{practice:true,main:false},aiOrders:{one:{0:stocked}}};
 const orders={one:{0:{...stocked,cap:20},1:stocked}};
 const practice=competitorResult(s,0,orders,'one');
 assert.equal(practice.sales+practice.opponent.sales,practice.marketDemand);
 assert.equal(practice.signals.length,4);
 assert.deepEqual(competitorResult(s,1,orders,'one'),resultFor(s.seed,1,stocked,c));
 assert.deepEqual([0,1,2,3,4].map(index=>aiActive(s,index)),[true,false,false,false,false]);
 assert.throws(()=>competitorResult(s,0,orders,'two'),/AI opponent decision/);
});

test('individual profile history scores only completed main rounds with the saved personal opponent',()=>{
 const s={mode:'individual',seed:24,config:c,decisionUid:'student',orders:{1:stocked,2:empty},
  aiOpponent:{practice:false,main:true},aiOrders:{student:{1:stocked}},startedAt:{toMillis:()=>0},closedAt:{toMillis:()=>425000}};
 const result=competitorResult(s,1,{student:s.orders},'student');
 const history=historyStats([s],2000000);
 assert.equal(history.seasons,1);
 assert.equal(history.profit,result.profit);
 assert.deepEqual(history.rows[0].rounds[0].opponent,result.opponent);
});
