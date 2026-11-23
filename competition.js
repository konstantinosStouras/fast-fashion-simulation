import {aiActive,teamMatchup,teamMatchups,teamRound,usesPairedMarkets} from './market.js?v=ai-opponents-1';
import {ROUNDS} from './model.js';
export {validateTeams} from './functions/teams.js';
export const decisionOwner=(s,uid)=>s.mode==='team'?(s.assignments?.[uid]||null):uid;
export function groupTeams(people,size=3){
 if(!Number.isInteger(size)||size<1||size>20)throw Error('Team size must be 1–20.');
 if(people.length>500||Math.ceil(people.length/size)>100)throw Error('A classroom supports up to 500 participants and 100 teams. Increase the team size.');
 const shuffled=[...people];for(let i=shuffled.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];}
 const assignments={},teamNames={};for(let i=0;i<shuffled.length;i+=size){const captain=shuffled[i].uid;teamNames[captain]='Team '+(i/size+1);for(const p of shuffled.slice(i,i+size))assignments[p.uid]=captain;}return {assignments,teamNames};
}
export function leaderboard(s,orders,seconds,captain){
 const aiMain=aiActive(s,1);
 const captains=captain===undefined?Object.keys(s.teamNames||{}).sort():[captain];
 const matchups=aiMain?captains.map(uid=>[uid,'ai/'+uid]):captain===undefined?teamMatchups(s):[teamMatchup(s,captain)];
 const rounds=[1,2,3].filter(i=>seconds>=ROUNDS[i].end);
 const markets=rounds.map(i=>teamRound(s,i,orders,captain).teams);
 return matchups.flatMap(matchup=>{
  const ranked=matchup.length>1||!usesPairedMarkets(s);
  const rows=matchup.map(uid=>{
   const isAi=aiMain&&uid===matchup[1];
   const sum=key=>markets.reduce((total,market)=>total+(isAi?market[matchup[0]].opponent:market[uid])[key],0);
   return {uid,name:isAi?'AI opponent':s.teamNames[uid],...(isAi?{isAi:true}:{}),matchup,periods:rounds.length,profit:sum('profit'),leftovers:sum('leftovers'),footprint:sum('footprint'),sales:sum('sales'),switchedIn:sum('switchedIn'),switchedOut:sum('switchedOut')};
  }).sort((a,b)=>b.profit-a.profit||a.name.localeCompare(b.name));
  return rows.map(row=>({...row,rank:ranked?rows.findIndex(r=>Math.abs(r.profit-row.profit)<1e-8)+1:null}));
 });
}
