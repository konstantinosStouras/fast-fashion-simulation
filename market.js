// Shared-market competition: customers choose a team/style, then switch if it stocks out.
// Fixed prices; every additional style adds choice weight. Demand exists only once.
import {DEFAULT_ORDER,ROUNDS,demandFor,resultFor,signalFor,validOrder} from './model.js';
function randomFor(seed){return ()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};}
function choose(items,u){const total=items.reduce((n,p)=>n+p.weight,0);let value=u*total;return items.find(p=>(value-=p.weight)<0)||items.at(-1);}
export function sharedMarket(seed,index,teamOrders,config){
 const ids=Object.keys(teamOrders).sort();if(!ids.length)return {teams:{},demand:0,sales:0,lostSales:0};
 const orders=Object.fromEntries(ids.map(uid=>[uid,teamOrders[uid]||DEFAULT_ORDER]));for(const o of Object.values(orders))if(!validOrder(o,index))throw Error('Invalid team order');
 const base=demandFor(seed,index,4,{...config,rebound:0}).reduce((n,p)=>n+p.demand,0);
 const expansion=ids.filter(uid=>orders[uid].variety===8).length/ids.length;
 const demand=Math.round(base*(1+config.rebound*expansion));
 const random=randomFor(seed+(index===0?999:0)+781),weights=Array.from({length:8},()=>.5+random());
 const products=ids.flatMap(uid=>Array.from({length:orders[uid].variety},(_,i)=>({uid,style:i+1,weight:weights[i],stock:orders[uid].quantity,earlySales:0,lateSales:0,preferred:0,latePreferred:0,retained:0,switchedIn:0,switchedOut:0,missed:0,added:0})));
 const customers=Array.from({length:demand},(_,i)=>({preferred:choose(products,random()),fallback:random(),early:i<Math.floor(demand/2)}));
 for(const c of customers){c.preferred.preferred++;if(!c.early)c.preferred.latePreferred++;}
 const serve=early=>{for(const c of customers.filter(c=>c.early===early)){const preferred=c.preferred,chosen=preferred.stock>0?preferred:choose(products.filter(p=>p.stock>0),c.fallback);if(!chosen){preferred.missed++;continue;}chosen.stock--;chosen[early?'earlySales':'lateSales']++;if(chosen.uid===preferred.uid)preferred.retained++;else{chosen.switchedIn++;preferred.switchedOut++;}}};
 serve(true);
 const signals={};for(const uid of ids)signals[uid]=[];
 for(const p of products){const normal=Math.sqrt(-2*Math.log(Math.max(random(),1e-12)))*Math.cos(2*Math.PI*random());const signal=Math.max(0,Math.round(p.latePreferred*(1+config.forecastSd*normal)));signals[p.uid].push({style:p.style,sales:p.earlySales,stock:p.stock,signal,stockout:p.stock===0});p.added=ROUNDS[index].quick?Math.min(orders[p.uid].cap,Math.max(0,signal-p.stock)):0;p.stock+=p.added;}
 serve(false);
 const teams={};for(const uid of ids){const own=products.filter(p=>p.uid===uid),sum=k=>own.reduce((n,p)=>n+p[k],0),o=orders[uid],initial=o.variety*o.quantity,sales=sum('earlySales')+sum('lateSales'),replenished=sum('added'),leftovers=sum('stock'),produced=initial+replenished,footprint=produced*config.unitCarbon+leftovers*config.leftoverCarbon;teams[uid]={sales,replenished,leftovers,produced,demand:sum('preferred'),lostSales:sum('preferred')-sum('retained'),switchedIn:sum('switchedIn'),switchedOut:sum('switchedOut'),profit:sales*config.price+leftovers*config.salvage-initial*config.initialCost-replenished*config.refillCost-o.variety*config.styleCost,footprint,perSale:sales?footprint/sales:null,signals:signals[uid]};}
 const sales=Object.values(teams).reduce((n,t)=>n+t.sales,0);return {teams,demand,sales,lostSales:demand-sales};
}

export function makeTeamOpponents(teamNames){
 const captains=Object.keys(teamNames).sort();
 return Object.fromEntries(captains.map((uid,index)=>[uid,captains[index%2===0?index+1:index-1]??null]));
}

// Once play starts the saved map is authoritative. Older sessions keep the
// classroom-wide market their participants actually played.
export function usesPairedMarkets(session){
 return session.mode==='team' && (session.teamOpponents!=null || session.status==='lobby');
}

export function teamMatchup(session,captain){
 const names=session.teamNames||{};
 if(!Object.hasOwn(names,captain))return [];
 if(!usesPairedMarkets(session))return Object.keys(names).sort();
 const opponents=session.teamOpponents??makeTeamOpponents(names);
 return opponents[captain]==null?[captain]:[captain,opponents[captain]];
}

export function teamMatchups(session){
 const names=session.teamNames||{},captains=Object.keys(names).sort();
 if(!usesPairedMarkets(session))return captains.length?[captains]:[];
 const opponents=session.teamOpponents??makeTeamOpponents(names);
 const groups=[];
 for(const captain of captains){
  const rival=opponents[captain];
  if(rival==null)groups.push([captain]);
  else if(captain<rival)groups.push([captain,rival]);
 }
 return groups;
}

const cache=new Map();
export function teamRound(session,index,allOrders,captain){
 const groups=captain===undefined?teamMatchups(session):[teamMatchup(session,captain).sort()].filter(group=>group.length);
 const orders=Object.fromEntries(groups.flat().map(uid=>[uid,allOrders[uid]?.[index]||DEFAULT_ORDER]));
 const paired=usesPairedMarkets(session);
 const {seed,config}=session;
 const key=JSON.stringify([seed,index,config,paired,groups,orders]);
 if(cache.has(key))return cache.get(key);

 const round={teams:{},demand:0,sales:0,lostSales:0};
 for(const group of groups){
  if(paired && group.length===1){
   const [uid]=group,order=orders[uid];
   const result=resultFor(seed,index,order,config);
   round.teams[uid]={...result,signals:signalFor(seed,index,order,config),switchedIn:0,switchedOut:0};
   round.demand+=result.demand;
   round.sales+=result.sales;
  }else{
   const marketOrders=Object.fromEntries(group.map(uid=>[uid,orders[uid]]));
   const market=sharedMarket(seed,index,marketOrders,config);
   Object.assign(round.teams,market.teams);
   round.demand+=market.demand;
   round.sales+=market.sales;
  }
 }
 round.lostSales=round.demand-round.sales;
 if(cache.size>=16)cache.delete(cache.keys().next().value);
 cache.set(key,round);
 return round;
}
