export function entryMember(s,team){return s.entryMembers?.[team]??team;}
export function handoff(s,uid,name,requested){
 const team=s.assignments?.[uid],current=entryMember(s,team);
 if(s.status!=='running'||!team)throw Error('Team roles are available during play.');
 const requests={...s.entryRequests};
 if(!requested){
  if(current===uid)throw Error('You already enter decisions.');
  requests[uid]=name;
  return {entryRequests:requests};
 }
 if(current!==uid||s.assignments[requested]!==team||!Object.hasOwn(requests,requested))throw Error('This request is no longer available.');
 const nextName=requests[requested];
 delete requests[requested];
 return {entryRequests:requests,entryMembers:{...s.entryMembers,[team]:requested},entryNames:{...s.entryNames,[team]:nextName}};
}
