import {teamRound} from './market.js';
import {ROUNDS} from './model.js';
export const decisionOwner=(s,uid)=>s.mode==='team'?(s.assignments?.[uid]||null):uid;
export function groupTeams(people,size=3){
 if(!Number.isInteger(size)||size<1||size>20)throw Error('Team size must be 1–20.');
 const shuffled=[...people];for(let i=shuffled.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];}
 const assignments={},teamNames={};for(let i=0;i<shuffled.length;i+=size){const captain=shuffled[i].uid;teamNames[captain]='Team '+(i/size+1);for(const p of shuffled.slice(i,i+size))assignments[p.uid]=captain;}return {assignments,teamNames};
}
export function validateTeams(people,assignments,teamNames){
 const ids=people.map(p=>p.uid),captains=Object.keys(teamNames);
 return ids.length>0&&ids.length<=500&&captains.length<=100&&Object.keys(assignments).length===ids.length&&ids.every(id=>captains.includes(assignments[id]))&&captains.every(id=>ids.includes(id)&&assignments[id]===id&&typeof teamNames[id]==='string'&&teamNames[id].trim().length>0&&teamNames[id].length<=60&&ids.filter(uid=>assignments[uid]===id).length<=20);
}
export function leaderboard(s,orders,seconds){
 const rounds=[1,2,3].filter(i=>seconds>=ROUNDS[i].end);
 const rows=Object.entries(s.teamNames||{}).map(([uid,name])=>{const results=rounds.map(i=>teamRound(s,i,orders).teams[uid]);const sum=k=>results.reduce((a,r)=>a+r[k],0);return {uid,name,periods:rounds.length,profit:sum('profit'),leftovers:sum('leftovers'),footprint:sum('footprint'),sales:sum('sales'),switchedIn:sum('switchedIn'),switchedOut:sum('switchedOut')};}).sort((a,b)=>b.profit-a.profit||a.name.localeCompare(b.name));
 return rows.map((r,i)=>({...r,rank:rows.findIndex(x=>Math.abs(x.profit-r.profit)<1e-8)+1}));
}
