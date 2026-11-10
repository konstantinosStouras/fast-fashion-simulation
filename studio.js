export function sessionState(session,now=Date.now()){
 if(session.status==='closed')return 'Closed';
 if(session.status==='running'&&session.startedAt&&now-session.startedAt.toMillis()>=1080000)return 'Completed';
 return session.status==='running'?'Running':'Waiting to start';
}
export function partitionSessions(sessions,now=Date.now()){
 const active=[],past=[];for(const session of sessions)(['Closed','Completed'].includes(sessionState(session,now))?past:active).push(session);return {active,past};
}
