import {sessionProgress} from './functions/session-progress.js';
const CITY_CODES = [
 'PARIS', 'ROME', 'TOKYO', 'LIMA', 'OSLO', 'MILAN', 'LONDON', 'DUBLIN',
 'BERLIN', 'MADRID', 'CAIRO', 'DUBAI', 'SEOUL', 'MIAMI', 'SYDNEY', 'BOSTON',
 'ATHENS', 'DELHI', 'LAGOS', 'PERTH', 'PISA', 'KYOTO', 'OSAKA', 'HANOI',
];

export async function suggestCityCodes(usedCodes, isAvailable) {
 const start = Math.floor(Math.random() * CITY_CODES.length);
 const cities = [...CITY_CODES.slice(start), ...CITY_CODES.slice(0, start)];
 const suggestions = [];
 for (let round = 1; suggestions.length < 4; round++) {
  const candidates = cities.map(city => round === 1 ? city : city + round).filter(code => !usedCodes.has(code));
  for (let offset = 0; offset < candidates.length && suggestions.length < 4;) {
   const batch = candidates.slice(offset, offset + 4 - suggestions.length);
   const available = await Promise.all(batch.map(isAvailable));
   suggestions.push(...batch.filter((code, index) => available[index]));
   offset += batch.length;
  }
 }
 return suggestions;
}

export function sessionState(session,now=Date.now()){
 if(session.status==='closed')return 'Closed';
 if(session.status==='running'&&sessionProgress(session,now)>=(session.phaseOffset==null?1080:960))return 'Completed';
 return session.status==='running'?'Running':'Waiting to start';
}
export function partitionSessions(sessions,now=Date.now()){
 const active=[],past=[];for(const session of sessions)(['Closed','Completed'].includes(sessionState(session,now))?past:active).push(session);return {active,past};
}
export function decisionSummary(session,phase,orders,completedRounds){
 if(session.status==='lobby')return 'Waiting to start';
 if(session.status==='closed'||phase.index>=4){
  if(!completedRounds.length)return 'No scored seasons completed';
  const saved=completedRounds.filter(i=>orders[i]).length,defaults=completedRounds.length-saved;
  return `${saved}/${completedRounds.length} scored decisions saved${defaults?` · ${defaults} used defaults`:''}`;
 }
 const order=orders[phase.index];
 return order?`${order.variety} styles · ${order.quantity} initial · cap ${order.cap}`:'No saved decision for this round';
}
