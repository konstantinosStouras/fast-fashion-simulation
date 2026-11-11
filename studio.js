export function sessionState(session,now=Date.now()){
 if(session.status==='closed')return 'Closed';
 if(session.status==='running'&&session.startedAt&&now-session.startedAt.toMillis()>=1080000)return 'Completed';
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
