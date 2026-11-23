import {escapeHtml as esc} from './ui.js?v=ai-opponent-1';
import {sessionTeamRoster} from './session-team-roster.js';

function membersList(members, waiting) {
 if (!members.length) return '<span class="hint">No members</span>';
 return '<ul class="session-team-members">'+members.map(member=>{
  const details=[member.detail, member.captain && 'Captain', !member.joined && (waiting?'Waiting to join':'Did not join')].filter(Boolean);
  return '<li>'+esc(member.name)+(details.length?' <small>'+esc(details.join(' · '))+'</small>':'')+'</li>';
 }).join('')+'</ul>';
}

export function mountSessionTeams(container, api, users, allClassrooms, requestedCode, reloadSessions) {
 container.innerHTML = `<div class="session-team-heading"><h2 id="session-teams-title">Session teams</h2>
  <label>Session code<select id="session-team-code" disabled><option value="">Choose a session</option></select></label></div>
  <p class="hint" id="session-teams-status" role="status">Loading sessions…</p>
  <button type="button" class="small secondary" id="session-teams-retry" hidden>Retry</button>
  <div id="session-team-results"></div>`;
 const select=container.querySelector('select'), status=container.querySelector('[role="status"]');
 const retry=container.querySelector('button'), result=container.querySelector('#session-team-results');
 let options=new Map(), requested=requestedCode, selectedSession=null, participants=null;
 let stops=[], generation=0, disposed=false;
 function disconnect() {
  generation++;
  for(const stop of stops)stop();
  stops=[];
  selectedSession=null;
  participants=null;
 }
 function message(text, retryAction) {
  result.replaceChildren();
  status.textContent=text;
  retry.hidden=!retryAction;
  retry.onclick=retryAction || null;
 }
 function render() {
  if(disposed || !selectedSession || participants===null)return;
  const {teams,unassigned}=sessionTeamRoster(selectedSession,participants,users);
  const waiting=selectedSession.status==='lobby';
  status.textContent=teams.length?'':'No teams assigned in this session.';
  result.innerHTML=(teams.length ? `<div class="table-wrap"><table class="session-team-table" aria-labelledby="session-teams-title">
   <thead><tr><th scope="col">Team</th><th scope="col">Members</th><th scope="col">Practice opponent</th><th scope="col">Main phase opponent</th></tr></thead>
   <tbody>${teams.map(team=>`<tr><th scope="row">${esc(team.name)}</th><td data-label="Members">${membersList(team.members,waiting)}</td>
     <td data-label="Practice opponent">${esc(team.practiceOpponent)}</td><td data-label="Main phase opponent">${esc(team.mainOpponent)}</td></tr>`).join('')}</tbody></table></div>` : '')+
   (unassigned.length?'<div class="session-team-unassigned"><h3>Unassigned participants</h3>'+membersList(unassigned,waiting)+'</div>':'');
 }
 function selectSession() {
  disconnect();
  const initial=options.get(select.value);
  if(!initial){message(options.size?'Choose a session to view its teams.':'No sessions available.');return;}
  if(initial.mode!=='team'){message(initial.mode==='solo'?'Solo session · no teams.':'Individual session · no teams.');return;}
  message('Loading teams for '+initial.code+'…');
  const turn=generation;
  const current=()=>!disposed && turn===generation && container.isConnected;
  function subscribe(stop) {
   if(typeof stop!=='function')return;
   if(current())stops.push(stop);
   else stop();
  }
  function fail() {
   if(!current())return;
   disconnect();
   message('Teams could not load for '+initial.code+'.',selectSession);
  }
  try {
   subscribe(api.watchSession(initial.code, room=>{
    if(!current())return;
    if(!room || room.deletedAt || (!allClassrooms && room.owner!==initial.owner)){
     disconnect();
     options.delete(initial.code);
     select.selectedOptions[0]?.remove();
     select.value='';
     select.disabled=!options.size;
     message(initial.code+' is no longer available.');
     return;
    }
    if(room.mode!=='team'){
     disconnect();
     message(room.mode==='solo'?'Solo session · no teams.':'Individual session · no teams.');
     return;
    }
    selectedSession=room;
    render();
   }, fail));
   if(current())subscribe(api.watchParticipants(initial.code, rows=>{
    if(!current())return;
    participants=rows;
    render();
   }, fail));
  } catch {fail();}
 }
 select.onchange=selectSession;
 function setRooms(rooms) {
  if(disposed)return;
  const preferred=select.value || requested;
  requested=null;
  options=new Map(rooms.filter(room=>!room.deletedAt).map(room=>[room.code,room]));
  const sorted=[...options.values()].sort((a,b)=>a.code.localeCompare(b.code));
  select.innerHTML='<option value="">Choose a session</option>'+sorted.map(room=>
   `<option value="${esc(room.code)}">${esc(room.code)}${room.name?' · '+esc(room.name):''}</option>`).join('');
  select.disabled=!sorted.length;
  if(options.has(preferred))select.value=preferred;
  selectSession();
 }
 function roomsFailed() {
  if(disposed)return;
  disconnect();
  requested=select.value || requested;
  options.clear();
  select.innerHTML='<option value="">Choose a session</option>';
  select.disabled=true;
  message('Sessions could not load.',reloadSessions);
 }
 function dispose(){disposed=true;disconnect();}
 return {setRooms, roomsFailed, updateNames:render, dispose};
}
