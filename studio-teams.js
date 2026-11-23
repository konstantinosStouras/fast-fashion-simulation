import {escapeHtml as esc} from './ui.js?v=ai-opponent-1';
import {getTeamComposition} from './functions/teams.js?v=team-handoff-1';
import {classroomStatus, summarizeUserClassroom} from './functions/user-classrooms.js?v=team-handoff-1';
import {mountSessionTeams} from './studio-session-teams.js';

const PAGE_SIZE = 25;
const teamOptions = Array.from({length:100}, (_, index) => `<option value="${index+1}">Team ${index+1}</option>`).join('');

const phaseLabels = {practice:'Practice', main:'Main phase', comparison:'Final comparison'};
const dateFormat = new Intl.DateTimeFormat('en-GB', {dateStyle:'medium', timeStyle:'short'});

function formatDate(value) {
 const stamp = Date.parse(value);
 return Number.isFinite(stamp) ? dateFormat.format(stamp) : 'Unavailable';
}

function statusLabel(room, confirmed) {
 if (room.status === 'lobby')
  return room.joined ? 'Joined · waiting to start' : confirmed ? 'Assigned · waiting to join' : 'Preassigned';
 return {running:'In progress', closed:'Closed', completed:'Completed'}[room.status] || room.status;
}

function classroomHighlights(sessions, confirmed, playedCodes) {
 return sessions.filter(room => ['running','lobby'].includes(room.status)).map(room => {
  const phaseOpponent=room.currentPhase==='practice'?room.practiceOpponent:room.currentPhase==='main'?room.mainOpponent:null;
  const matchup=room.activeOpponent?'Opponent · '+room.activeOpponent:phaseOpponent;
  const detail = [statusLabel(room, confirmed),room.team,phaseLabels[room.currentPhase],matchup].filter(Boolean).join(' · ');
  const title = playedCodes?.includes(room.code) ? room.name : room.name+' · '+room.code;
  return `<div class="directory-highlight"><strong>${esc(title)}</strong><small>${esc(detail)}</small></div>`;
 }).join('');
}

function classroomDetails(person, history) {
 let content;
 if (!history || history.loading) content='<p role="status">Loading classroom participation…</p>';
 else if (history.error) content='<p role="alert">Classroom participation could not load.</p><button class="secondary small" type="button" data-retry-history="'+esc(person.uid)+'">Retry classrooms</button>';
 else if (!history.sessions.length) content='<p class="hint">No participation or team assignments in the classrooms you manage.</p>';
 else content=history.sessions.map(room => {
  const current=phaseLabels[room.currentPhase];
  return `<article class="user-classroom">
   <div class="user-classroom-heading"><div><strong>${esc(room.name)} · ${esc(room.code)}</strong><small>${esc(statusLabel(room,true))}${current?' · '+esc(current):''}</small></div><button class="secondary small" type="button" data-open-classroom="${esc(room.code)}" aria-label="Open classroom ${esc(room.name)} · ${esc(room.code)}">Open</button></div>
   <dl><dt>${room.mode==='team'?'Team':'Play mode'}</dt><dd>${esc(room.team || (room.mode==='team'?'Unassigned':room.mode==='solo'?'Solo':'Individual'))}</dd>
   <dt>Practice opponent</dt><dd>${esc(room.practiceOpponent)}</dd><dt>Main phase opponent</dt><dd>${esc(room.mainOpponent)}</dd></dl></article>`;
 }).join('');
 return `<p class="user-dates">Registered ${esc(formatDate(person.registeredAt))} · Last sign-in ${esc(formatDate(person.lastSignInAt))}</p>${content}`;
}

export async function showTeamsPanel(panel, api, allClassrooms, requestedCode, openClassroom, confirmAction, registerCleanup) {
 panel.innerHTML = `<section class="panel team-directory" aria-labelledby="directory-title">
  <div class="directory-heading"><div><h2 id="directory-title">Registered users</h2><span id="directory-count" class="hint" role="status">Loading users…</span></div><div class="directory-actions"><button type="button" class="secondary" id="directory-refresh">Refresh</button>
   ${allClassrooms ? '<button type="button" class="secondary danger" id="delete-all-users" disabled>Delete all registered users</button>' : ''}</div></div>
  ${allClassrooms ? '<p class="hint directory-delete-status" id="directory-delete-status" role="status"></p>' : ''}
  <div class="directory-filters"><label>Search by name, email or student ID<input id="team-user-search" type="search" autocomplete="off"></label>
  <label>Team assignments for<select id="team-classroom"><option value="">Default teams · new classrooms</option></select></label></div>
  <p id="assignment-help" class="hint"></p>
  <div class="table-wrap"><table class="team-user-table"><thead><tr><th scope="col">Registered user</th><th scope="col">Sessions played (code)</th><th scope="col">Team assignment</th>${allClassrooms ? '<th scope="col">Account</th>' : ''}</tr></thead><tbody></tbody></table></div>
  <div class="directory-pages"><button type="button" class="secondary" id="team-directory-prev">Previous</button><span id="team-directory-page"></span><button type="button" class="secondary" id="team-directory-next">Next</button></div>
  <p class="hint" id="team-directory-load" role="status"></p><button type="button" class="secondary" id="team-directory-retry" hidden>Retry loading users</button>
  <div class="button-row"><button id="save-team-directory" type="button">Save team assignments</button><span class="hint" id="team-directory-pending"></span></div>
  <p class="hint" id="team-directory-status" role="status" aria-live="polite"></p>
  <details class="assignment-notes"><summary>How teams and opponents are assigned</summary><p class="hint">Students join teams automatically using the classroom’s target team size. You can choose a different team for a student before the competition starts. Practice uses the built-in AI. The instructor’s start draws pairs for the three scored seasons. An unpaired team faces its own AI opponent.</p></details></section>
  <section id="session-teams" class="panel session-teams" aria-labelledby="session-teams-title"></section>`;
 const find = id => panel.querySelector('#'+id);
 const classroom = find('team-classroom'), search = find('team-user-search');
 const body = panel.querySelector('tbody'), feedback = find('team-directory-status'), loadStatus = find('team-directory-load');
 const users = new Map(), drafts = new Map([['',new Map()]]), histories = new Map(), individualRosters = new Map();
 const sessionTeams=mountSessionTeams(find('session-teams'),api,users,allClassrooms,requestedCode,loadRooms);
 registerCleanup?.(sessionTeams.dispose);
 let rooms = [], defaultRoster = null, selectedScope = requestedCode || '', roomLoadError = false;
 let page = 0, saving = false, deleting = false, refreshing = false, expandedUid = null, pageToken, directoryComplete = false, roomVersion = 0, listVersion = 0;
 const currentRoom = () => classroom.value ? rooms.find(room => room.code === classroom.value) : defaultRoster;
 function updateScopeHelp() {
  let message = classroom.value ? 'Students in '+classroom.value+' join in groups of '+(currentRoom()?.teamSize??3)+'. The last group may be smaller. You can adjust assignments below.'
   : defaultRoster ? 'New team classrooms start with these assignments. Choose a waiting classroom to change its teams separately.'
   : refreshing ? 'Loading default team assignments…' : 'Default team assignments could not load. Refresh to try again.';
  if (roomLoadError) message+=' Waiting classrooms could not load.';
  find('assignment-help').textContent=message;
 }
 async function loadDefaultRoster() {
  try {
   const roster=await api.getDefaultTeamComposition();
   if(panel.isConnected)defaultRoster=roster;
  } catch {
   if(panel.isConnected)defaultRoster=null;
  }
 }
 async function loadIndividualRosters(version) {
  const running=rooms.filter(room=>(room.mode || 'individual')==='individual' && classroomStatus(room).status==='running');
  // One roster per live individual classroom, with at most four concurrent reads.
  for(let offset=0;offset<running.length && panel.isConnected && version===roomVersion;offset+=4){
   await Promise.all(running.slice(offset,offset+4).map(async room=>{
    try {
     const people=await api.readParticipants(room.code);
     if(version===roomVersion)individualRosters.set(room.code,new Set(people.map(person=>person.uid)));
    } catch { /* Per-user classroom details remain available for this room. */ }
   }));
  }
  if(panel.isConnected && version===roomVersion)renderRows();
 }
 async function loadRooms() {
  const request=++listVersion;
  try {
   const result = await api.listSessions(allClassrooms);
   if (!panel.isConnected || request!==listVersion) return;
   roomLoadError=false;
   const visible=result.filter(room=>!room.deletedAt);
   sessionTeams.setRooms(visible);
   rooms = visible.map(room => room.status==='lobby' && room.mode==='team'
     ? {...room,teamComposition:getTeamComposition(room)} : room);
   const editable = rooms.filter(room => room.status==='lobby' && room.mode==='team');
   for (const room of editable) {
    if (!drafts.has(room.code)) drafts.set(room.code,new Map());
   }
   classroom.innerHTML='<option value="">Default teams · new classrooms</option>'+editable.map(room=>`<option value="${esc(room.code)}">${esc(room.name)} · ${esc(room.code)}</option>`).join('');
   selectedScope=editable.some(room=>room.code===selectedScope)?selectedScope:'';
   classroom.value=selectedScope;
   renderRows();
   void loadIndividualRosters(roomVersion);
  } catch {
   if (!panel.isConnected || request!==listVersion) return;
   rooms=[];roomLoadError=true;classroom.innerHTML='<option value="">Default teams · new classrooms</option>';
   sessionTeams.roomsFailed();
   renderRows();
  }
 }
 async function loadHistory(uid) {
  const entry={loading:true};
  histories.set(uid,entry);renderRows();
  try {
   const result=await api.getUserClassrooms(uid);
   entry.sessions=result.sessions;
  } catch {entry.error=true;}
  entry.loading=false;
  if(panel.isConnected && histories.get(uid)===entry)renderRows();
 }
 function updateSave() {
  const count = drafts.get(classroom.value)?.size || 0;
  find('team-directory-pending').textContent = count ? `${count} unsaved ${count===1?'assignment':'assignments'}` : '';
  find('save-team-directory').disabled = !count || !currentRoom() || saving || refreshing || deleting;
  find('directory-refresh').disabled = refreshing || saving || deleting;
  find('team-directory-retry').disabled = refreshing || saving || deleting;
  classroom.disabled = refreshing || saving || deleting;
  if(allClassrooms) find('delete-all-users').disabled = !directoryComplete || saving || refreshing || deleting || ![...users.values()].some(person=>person.deletionProtected===false);
 }
 function renderRows() {
  const room = currentRoom(), changes = drafts.get(classroom.value);
  const query = search.value.trim().toLowerCase();
  const matched = [...users.values()].filter(user => [user.name,user.email,user.studentId].filter(Boolean).join(' ').toLowerCase().includes(query));
  find('directory-count').textContent=refreshing?'Loading registered users… '+users.size+' found':directoryComplete?users.size+' registered '+(users.size===1?'user':'users'):users.size+' users loaded';
  const pages = Math.max(1, Math.ceil(matched.length / PAGE_SIZE));
  page = Math.min(page, pages - 1);
  const shown = matched.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const columns=allClassrooms?4:3;
  const focusedUid=panel.ownerDocument.activeElement?.dataset?.userDetails;
  body.innerHTML = shown.map(person => {
   const history=histories.get(person.uid), full=history?.sessions;
   const known=full || rooms.flatMap(room=>{
    const joined=Boolean(room.assignments?.[person.uid] || individualRosters.get(room.code)?.has(person.uid) || (room.mode==='solo' && room.status==='running' && room.owner===person.uid));
    if(!joined && !(room.status==='lobby' && room.teamComposition?.[person.uid]))return [];
    return summarizeUserClassroom(room,person.uid,joined) || [];
   });
   const expanded=expandedUid===person.uid;
   const name=person.name || person.email || 'Registered user';
   const playedCodes=person.playedSessionCodes;
   const played=playedCodes?.length
    ? `<ul class="played-session-codes" aria-label="Session codes played">${playedCodes.map(code=>`<li><code>${esc(code)}</code></li>`).join('')}</ul>`
    : `<small class="played-session-empty">${playedCodes ? 'No sessions played' : 'Session codes unavailable'}</small>`;
   return `<tr class="user-entry"><td data-label="Registered user"><strong>${esc(name)}</strong>
    ${person.email && person.email!==name ? `<small>${esc(person.email)}</small>` : ''}${person.studentId ? `<small>Student ID · ${esc(person.studentId)}</small>` : ''}</td>
    <td data-label="Sessions played (code)">${played}${classroomHighlights(known,Boolean(full),playedCodes)}<button type="button" class="secondary small user-details" data-user-details="${esc(person.uid)}" aria-expanded="${expanded}" aria-label="${expanded?'Hide':'View'} classrooms for ${esc(name)}">${expanded?'Hide classrooms':'View classrooms'}</button></td>
    <td data-label="Team assignment"><select data-team-user="${esc(person.uid)}" aria-label="Team for ${esc(name)}"${!room || saving || refreshing || deleting ? ' disabled' : ''}><option value="">Assign automatically</option>${teamOptions}</select></td>
    ${allClassrooms ? `<td data-label="Account">${person.deletionProtected===false ? `<button type="button" class="secondary small danger" data-delete-user="${esc(person.uid)}" aria-label="Delete user ${esc(person.email || name)}"${saving || refreshing || deleting ? ' disabled' : ''}>Delete user</button>` : `<small>${person.deletionProtected?'Protected account':'Unavailable'}</small>`}</td>` : ''}</tr>
    ${expanded?`<tr class="user-details-row"><td colspan="${columns}"><section aria-label="Classrooms for ${esc(name)}">${classroomDetails(person,history)}</section></td></tr>`:''}`;
  }).join('') || `<tr><td colspan="${columns}">`+(query?'No matching registered users.':refreshing?'Loading users…':'No users to display.')+'</td></tr>';
  if(focusedUid)Array.from(body.querySelectorAll('[data-user-details]')).find(button=>button.dataset.userDetails===focusedUid)?.focus({preventScroll:true});
  for (const select of body.querySelectorAll('select')) {
   const uid = select.dataset.teamUser;
   select.value = (changes?.has(uid) ? changes.get(uid) : room?.teamComposition?.[uid]) || '';
  }
  find('team-directory-prev').disabled = page === 0;
  find('team-directory-next').disabled = page + 1 >= pages;
  find('team-directory-page').textContent = matched.length ? `${page * PAGE_SIZE + 1}–${page * PAGE_SIZE + shown.length} of ${matched.length}` : '0 users';
  updateSave();
  updateScopeHelp();
 }
 async function requestDeletion(uid) {
  if(!allClassrooms || saving || refreshing || deleting || (!uid && !directoryComplete))return;
  const targets=(uid ? [users.get(uid)] : [...users.values()]).filter(person=>person?.deletionProtected===false);
  if(!targets.length)return;
  const person=targets[0], account=[person.name,person.email].filter(Boolean).join(' · ') || person.uid;
  const subject=uid ? account : `all ${targets.length} eligible registered ${targets.length===1?'user':'users'} across the full directory, including users outside this search`;
  const status=find('directory-delete-status');
  deleting=true;
  renderRows();
  let confirmed=false, deleted=0, protectedCount=0, error;
  try {
   confirmed=await confirmAction(`Permanently delete ${subject}? This removes their login and account information. ${uid?'':'Protected accounts will be kept. '}This cannot be undone.`);
   if(!confirmed)return;
   for(let offset=0;offset<targets.length;offset+=10) {
    if(panel.isConnected)status.textContent=`Deleting registered users… ${offset} of ${targets.length} processed.`;
    const batch=targets.slice(offset,offset+10).map(person=>person.uid);
    const result=await api.deleteRegisteredUsers(batch);
    deleted+=result.deletedUids.length;
    protectedCount+=result.protectedUids.length;
    for(const removed of result.deletedUids) {
     users.delete(removed);
     for(const changes of drafts.values())changes.delete(removed);
     if(expandedUid===removed)expandedUid=null;
    }
    if(panel.isConnected)renderRows();
   }
  } catch(cause) {
   error=cause;
  } finally {
   if(panel.isConnected && confirmed) {
    await refresh();
    if(directoryComplete) {
     for(const changes of drafts.values())for(const person of targets)if(!users.has(person.uid))changes.delete(person.uid);
     if(error)deleted=targets.filter(person=>!users.has(person.uid)).length;
    }
   }
   deleting=false;
   if(panel.isConnected) {
    renderRows();
    if(error)status.textContent=`Deletion stopped. ${deleted} of ${targets.length} deleted. ${error.message || 'Check your connection and try again.'}`;
    else if(confirmed)status.textContent=`${deleted} registered ${deleted===1?'user':'users'} deleted.`+(protectedCount?' Protected accounts were kept.':'');
   }
  }
 }
 if(allClassrooms)find('delete-all-users').onclick=()=>requestDeletion();
 body.onclick = event => {
  const button=event.target.closest('button');
  if(!button)return;
  if(button.dataset.deleteUser){void requestDeletion(button.dataset.deleteUser);return;}
  if(button.dataset.openClassroom){openClassroom?.(button.dataset.openClassroom);return;}
  if(button.dataset.retryHistory){void loadHistory(button.dataset.retryHistory);return;}
  const uid=button.dataset.userDetails;
  if(!uid)return;
  expandedUid=expandedUid===uid?null:uid;
  if(expandedUid && !histories.has(uid))void loadHistory(uid);
  else renderRows();
 };
 body.onchange = event => {
  const select = event.target.closest('[data-team-user]'), room = currentRoom();
  if (!select || !room || saving || deleting || refreshing) return;
  feedback.textContent = '';
  const uid = select.dataset.teamUser, changes = drafts.get(classroom.value), value = select.value || null;
  if (value === (room.teamComposition?.[uid] || null)) changes.delete(uid);
  else changes.set(uid, value);
  updateSave();
 };
 classroom.onchange = () => { selectedScope=classroom.value;page = 0; feedback.textContent = ''; renderRows(); };
 search.oninput = () => { page = 0; renderRows(); };
 find('team-directory-prev').onclick = () => { page--; renderRows(); };
 find('team-directory-next').onclick = () => { page++; renderRows(); };
 find('save-team-directory').onclick = async () => {
  const room = currentRoom(), edits = drafts.get(classroom.value);
  if (saving || refreshing || deleting || !room || !edits.size) return;
  saving = true; classroom.disabled = true; renderRows();
  feedback.textContent = 'Saving team assignments…';
  try {
   const changes=Object.fromEntries(edits);
   const saved = classroom.value ? await api.saveTeamComposition(room.code,changes) : await api.saveDefaultTeamComposition(changes);
   if (!panel.isConnected) return;
   Object.assign(room,saved);
   histories.clear();
   if(expandedUid)void loadHistory(expandedUid);
   edits.clear();
   feedback.textContent = classroom.value ? 'Team assignments saved for '+room.code+'.' : 'Default teams saved for new classrooms.';
  } catch (error) {
   if (panel.isConnected) feedback.textContent = error.message || 'Team assignments could not be saved. Try again.';
  } finally {
   saving = false;
   if (panel.isConnected) { classroom.disabled = false; renderRows(); }
  }
 };
 async function loadDirectory() {
  find('team-directory-retry').hidden = true;
  loadStatus.textContent = 'Loading registered users…';
  try {
   do {
    const result = await api.listTeamUsers(pageToken);
    if (!panel.isConnected) return;
    for (const user of result.users) users.set(user.uid, user);
    sessionTeams.updateNames();
    pageToken = result.nextPageToken;
    renderRows();
   } while (pageToken);
   directoryComplete = true;
   loadStatus.textContent = '';
  } catch {
   if (!panel.isConnected) return;
   loadStatus.textContent = 'The user directory could not finish loading.';
   find('team-directory-retry').hidden = false;
  }
 }
 async function refresh() {
  if(refreshing || saving)return;
  refreshing=true;directoryComplete=false;roomVersion++;roomLoadError=false;users.clear();histories.clear();individualRosters.clear();pageToken=undefined;
  renderRows();
  await Promise.all([loadDefaultRoster(),loadRooms(),loadDirectory()]);
  refreshing=false;
  if(!panel.isConnected)return;
  renderRows();
  if(expandedUid && users.has(expandedUid))void loadHistory(expandedUid);
 }
 find('directory-refresh').onclick = refresh;
 find('team-directory-retry').onclick = refresh;
 await refresh();
}
