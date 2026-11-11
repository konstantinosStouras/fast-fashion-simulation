// Synthetic local data only. No production service or account is contacted.
import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {DEFAULT_CONFIG,resultFor} from '../model.js';
import {sharedMarket} from '../market.js';
import {leaderboard,groupTeams,validateTeams} from '../competition.js';
import {createStaticServer} from '../tools/serve.mjs';

test('2,000 shared markets and 8,000 individual outcomes conserve customers, stock and money',()=>{
 const start=performance.now();let customers=0;
 for(let seed=0;seed<2000;seed++){
  const index=seed%4,count=[1,2,10,100][Math.floor(seed/4)%4];
  const config={...DEFAULT_CONFIG,demandMean:seed%3?480:2000,demandSd:seed%7?96:1000,rebound:seed%2,forecastSd:seed%5?0.2:0.8};
  const orders=Object.fromEntries(Array.from({length:count},(_,i)=>['u'+i,{variety:index===3&&(seed+i)%2?8:4,quantity:(seed*17+i*71)%201,cap:(seed*31+i*47)%201}]));
  const market=sharedMarket(seed,index,orders,config);customers+=market.demand;
  assert.equal(market.sales+market.lostSales,market.demand);
  let totalSales=0,incoming=0,outgoing=0,preferred=0;
  for(const [uid,r] of Object.entries(market.teams)){
   const o=orders[uid];totalSales+=r.sales;incoming+=r.switchedIn;outgoing+=r.switchedOut;preferred+=r.demand;
   for(const key of ['sales','produced','leftovers','replenished','demand','lostSales','switchedIn','switchedOut'])assert.ok(Number.isInteger(r[key])&&r[key]>=0,key);
   assert.equal(r.sales+r.leftovers,r.produced);assert.ok(r.replenished<=o.variety*o.cap);
   if(index===1)assert.equal(r.replenished,0);
   assert.equal(r.profit,r.sales*config.price+r.leftovers*config.salvage-o.variety*o.quantity*config.initialCost-r.replenished*config.refillCost-o.variety*config.styleCost);
   assert.equal(r.footprint,r.produced*config.unitCarbon+r.leftovers*config.leftoverCarbon);
   assert.equal(r.sales-r.switchedIn,r.demand-r.lostSales);
  }
  assert.equal(totalSales,market.sales);assert.equal(incoming,outgoing);assert.equal(preferred,market.demand);
  if(seed%40===0)assert.deepEqual(sharedMarket(seed,index,Object.fromEntries(Object.entries(orders).reverse()),config),market);
  for(let round=0;round<4;round++){const o={...orders.u0,variety:round===3?8:4},r=resultFor(seed,round,o,config);assert.equal(r.sales+r.leftovers,r.produced);assert.equal(r.sales+r.lostSales,r.demand);assert.ok(Number.isFinite(r.profit));}
 }
 console.log(JSON.stringify({sharedMarkets:2000,individualOutcomes:8000,customers,elapsedMs:Math.round(performance.now()-start)}));
});

test('500 participants, 100 teams and 500 leaderboard refreshes stay practical',()=>{
 const people=Array.from({length:500},(_,i)=>({uid:'u'+i})),teams=groupTeams(people,5);
 assert.ok(validateTeams(people,teams.assignments,teams.teamNames));assert.equal(Object.keys(teams.teamNames).length,100);assert.throws(()=>groupTeams(people,3),/100 teams/);
 const s={seed:42,config:DEFAULT_CONFIG,...teams},started=performance.now();
 for(let i=0;i<500;i++){const rows=leaderboard(s,{},1080);assert.equal(rows.length,100);assert.ok(rows.every(r=>r.periods===3&&Number.isFinite(r.profit)));}
 const elapsed=performance.now()-started;console.log(JSON.stringify({leaderboardRefreshes:500,teams:100,elapsedMs:Math.round(elapsed)}));assert.ok(elapsed<5000,'500 cached leaderboard refreshes must finish within five seconds');
});

test('2,000 static requests at concurrency 50, MIME types, HEAD and path protection',async t=>{
 const server=createStaticServer();server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(resolve=>server.close(resolve)));
 const base='http://127.0.0.1:'+server.address().port,paths=['/','/main.js','/ui.css','/assets/google-g.png','/admin/','/missing-file'];let next=0;const latencies=[];
 await Promise.all(Array.from({length:50},async()=>{while(next<2000){const i=next++,p=paths[i%paths.length],start=performance.now(),r=await fetch(base+p);assert.equal(r.status,p==='/missing-file'?404:200);await r.arrayBuffer();latencies.push(performance.now()-start);}}));
 const png=await fetch(base+'/assets/google-g.png');assert.equal(png.headers.get('content-type'),'image/png');await png.arrayBuffer();
 const head=await fetch(base+'/main.js',{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');assert.ok(Number(head.headers.get('content-length'))>0);
 for(const p of ['/.git/config','/node_modules/jsdom/package.json','/%2e%2e%5cREADME.md','/.firebaserc']){const r=await fetch(base+p);assert.equal(r.status,403,p);await r.text();}
 const post=await fetch(base+'/',{method:'POST'});assert.equal(post.status,405);await post.text();
 latencies.sort((a,b)=>a-b);console.log(JSON.stringify({requests:2000,concurrency:50,p50Ms:Math.round(latencies[1000]),p95Ms:Math.round(latencies[1900]),maxMs:Math.round(latencies.at(-1))}));
});
