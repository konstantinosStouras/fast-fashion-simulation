import {classroomOpponent} from './functions/user-classrooms.js?v=team-handoff-1';

const byName = new Intl.Collator('en', {numeric: true, sensitivity: 'base'});

export function sessionTeamRoster(session, participants, directory) {
  const teams = new Map(), unassigned = [];
  if (session.mode !== 'team' || session.deletedAt) return {teams: [], unassigned};

  const joined = new Map(participants.map(person => [person.uid, person]));
  const closedBeforeStart = session.status === 'closed' && session.startedAt == null && session.teamOpponents == null;
  // Before the start, the numbered composition can include registered people
  // who have yet to join. After the start, the saved captains and assignments
  // identify the teams that actually played, including any captain transfer.
  const planned = (session.status === 'lobby' || closedBeforeStart) && session.teamComposition != null;
  const names = session.teamNames || {}, assignments = session.assignments || {};
  function addTeam(key, name, captain) {
    function opponent(phase) {
      if (closedBeforeStart) return 'Session did not start';
      const label = classroomOpponent(session, phase, name, captain);
      return session.teamOpponents == null && label === 'Classroom market'
        ? 'All other teams · classroom market' : label;
    }
    teams.set(key, {name, members: [], practiceOpponent: opponent('practice'), mainOpponent: opponent('main')});
  }
  if (!planned) {
    for (const [captain, name] of Object.entries(names)) addTeam(captain, name, captain);
  }

  const ids = new Set(joined.keys());
  if (planned) for (const uid of Object.keys(session.teamComposition)) ids.add(uid);
  const nameCounts = new Map(), members = [];
  for (const uid of ids) {
    const record = joined.get(uid), account = directory.get(uid);
    // An anonymous retained decision holder is still part of the historical
    // matchup. Its identity must also stay anonymous during a directory refresh.
    const anonymous = record?.name === 'Deleted user' && record.email === '';
    const name = anonymous ? record.name : account?.name || record?.name || account?.email || record?.email || 'Name unavailable';
    const member = {uid, name, joined: joined.has(uid), captain: false};
    members.push(member);
    nameCounts.set(name.toLowerCase(), (nameCounts.get(name.toLowerCase()) || 0) + 1);
    const number = planned ? session.teamComposition[uid] : null;
    // A deleted captain can retain an anonymous team result even though its
    // own assignment was cleared. Its team is still keyed by that captain.
    const key = planned ? number : Object.hasOwn(names, uid) ? uid : assignments[uid];
    if (planned && number && !teams.has(number)) addTeam(number, 'Team ' + number, null);
    const team = teams.get(key);
    if (!team) {
      unassigned.push(member);
      continue;
    }
    member.captain = planned ? member.joined && assignments[uid] === uid && names[uid] === team.name : key === uid;
    team.members.push(member);
  }
  for (const member of members) {
    if (nameCounts.get(member.name.toLowerCase()) < 2) continue;
    const record = joined.get(member.uid), account = directory.get(member.uid);
    if (record?.name === 'Deleted user' && record.email === '') continue;
    member.detail = account?.email || record?.email || account?.studentId || '';
  }
  const sortedTeams = [...teams.values()].sort((a, b) => byName.compare(a.name, b.name));
  const compareMembers = (a, b) => byName.compare(a.name, b.name) || byName.compare(a.detail || '', b.detail || '');
  for (const team of sortedTeams) team.members.sort(compareMembers);
  return {teams: sortedTeams, unassigned: unassigned.sort(compareMembers)};
}
