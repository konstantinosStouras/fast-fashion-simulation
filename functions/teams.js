// Shared by classroom setup and the trusted session-start transaction.
function randomIndex(size) {
  const bound = Math.floor(0x100000000 / size) * size;
  const value = new Uint32Array(1);
  do { globalThis.crypto.getRandomValues(value); } while (value[0] >= bound);
  return value[0] % size;
}

export function makeTeamOpponents(teamNames, random) {
  const captains = Object.keys(teamNames).sort();
  for (let i = captains.length - 1; i > 0; i--) {
    const j = random ? Math.floor(random() * (i + 1)) : randomIndex(i + 1);
    [captains[i], captains[j]] = [captains[j], captains[i]];
  }
  return Object.fromEntries(captains.map((uid, index) => [
    uid, captains[index % 2 === 0 ? index + 1 : index - 1] ?? null
  ]));
}

export const DEFAULT_TEAM_SIZE = 3;
export const validTeamSize = size => Number.isInteger(size) && size >= 1 && size <= 20;

// Studio preferences may have been saved for a larger team size. Reserve
// places within this classroom's limit; everyone else is grouped on arrival.
export function defaultTeamComposition(savedComposition, teamSize) {
  if (!validTeamSize(teamSize)) throw Error('Team size must be 1–20.');
  const counts = Array(101).fill(0);
  const entries = [];
  for (const uid of Object.keys(savedComposition || {}).sort()) {
    const number = savedComposition[uid];
    if (!/^(?:[1-9]\d?|100)$/.test(number) || counts[number] >= teamSize) continue;
    counts[number]++;
    entries.push([uid, number]);
  }
  return Object.fromEntries(entries);
}

// Numbered directory assignments must also refer to classrooms with custom team names.
function teamNumbers(teamNames = {}) {
  const teams = Object.keys(teamNames).sort();
  const numbers = new Map();
  const used = new Set();
  for (const captain of teams) {
    const name = teamNames[captain];
    const n = /^Team ([1-9]\d?|100)$/.exec(name)?.[1];
    if (n && !used.has(n)) { numbers.set(captain, n); used.add(n); }
  }
  let next = 1;
  for (const captain of teams) {
    if (numbers.has(captain)) continue;
    while (used.has(String(next))) next++;
    numbers.set(captain, String(next)); used.add(String(next));
  }
  return numbers;
}

export function getTeamComposition(session) {
  const numbers = teamNumbers(session.teamNames);
  const assigned = Object.entries(session.assignments || {})
    .filter(([, captain]) => numbers.has(captain)).map(([uid, captain]) => [uid, numbers.get(captain)]);
  return {...Object.fromEntries(assigned), ...session.teamComposition};
}

function capacity(session) {
  const size = session.teamSize ?? DEFAULT_TEAM_SIZE;
  if (!validTeamSize(size)) throw Error('Team size must be 1–20.');
  return size;
}

function availableNumber(captains, seats, size) {
  // Fill existing groups in team-number order before creating another group.
  for (let n = 1; n <= 100; n++) {
    const number = String(n);
    if (captains.has(number) && seats[n] < size) return number;
  }
  for (let n = 1; n <= 100; n++) {
    if (!captains.has(String(n)) && seats[n] < size) return String(n);
  }
  throw Error('This classroom has reached its limit of 100 teams. Increase the team size to admit more participants.');
}

export function assignJoiningTeam(session, uid) {
  const assignments = session.assignments || {}, teamNames = session.teamNames || {};
  if (Object.hasOwn(assignments, uid)) return {assignments, teamNames};
  if (Object.keys(assignments).length >= 500) throw Error('A classroom supports up to 500 participants.');
  const size = capacity(session);
  const numbers = teamNumbers(teamNames);
  const captains = new Map(Array.from(numbers, ([captain, number]) => [number, captain]));
  const seats = Array(101).fill(0);
  for (const captain of Object.values(assignments)) seats[numbers.get(captain)]++;
  const planned = session.teamComposition || {};
  for (const [student, number] of Object.entries(planned)) {
    if (!Object.hasOwn(assignments, student)) seats[number]++;
  }
  const number = Object.hasOwn(planned, uid) ? planned[uid] : availableNumber(captains, seats, size);
  const maxMembers = session.teamSize ?? 20;
  if (!/^(?:[1-9]\d?|100)$/.test(number)) throw Error('Choose a team number from 1 to 100.');
  if (seats[number] > maxMembers) throw Error('This team supports up to ' + maxMembers + ' members. Review the team assignments.');
  const captain = captains.get(number) || uid;
  if(session.randomTeams && !session.membershipEdited && !Object.hasOwn(planned,uid)){
    // Insert the newcomer into a uniformly drawn unlocked seat. The displaced
    // member takes the new seat, preserving capacities and reserved places.
    const composition={...getTeamComposition(session),[uid]:number};
    const movable=Object.keys({...assignments,[uid]:captain}).filter(id=>!Object.hasOwn(planned,id));
    const other=movable[randomIndex(movable.length)];
    [composition[uid],composition[other]]=[composition[other],composition[uid]];
    return materializeTeams(movable.concat(Object.keys(assignments).filter(id=>Object.hasOwn(planned,id))).map(id=>({uid:id})),{...session,teamComposition:composition});
  }
  return {
    assignments: {...assignments, [uid]: captain},
    teamNames: captain === uid ? {...teamNames, [uid]: 'Team ' + number} : teamNames
  };
}

export function materializeTeams(people, session) {
  if (session.status && session.status !== 'lobby') return {assignments: session.assignments || {}, teamNames: session.teamNames || {}};
  const ids = people.map(person => person.uid).sort();
  if (ids.length > 500 || new Set(ids).size !== ids.length) throw Error('A classroom supports up to 500 distinct participants.');
  const size = capacity(session);
  const existing = session.assignments || {}, planned = session.teamComposition || {};
  const numbers = teamNumbers(session.teamNames);
  const oldCaptains = new Map(Array.from(numbers, ([captain, number]) => [number, captain]));
  const seats = Array(101).fill(0);
  const members = new Map();
  const unassigned = [];
  const maxMembers = session.teamSize ?? 20;
  for (const number of Object.values(planned)) {
    if (!/^(?:[1-9]\d?|100)$/.test(number)) throw Error('Choose a team number from 1 to 100.');
    if (++seats[number] > maxMembers) throw Error('This team supports up to ' + maxMembers + ' members. Review the team assignments.');
  }
  for (const uid of ids) {
    const fixed = Object.hasOwn(planned, uid);
    const number = fixed ? planned[uid] : numbers.get(existing[uid]);
    // Keep legacy manually assembled teams. For automatic teams, preserve each
    // student's place whenever it fits beside the instructor's reserved seats.
    const limit = session.teamSize != null || session.teamComposition != null ? size : 20;
    if (!number || (!fixed && seats[number] >= limit)) { unassigned.push(uid); continue; }
    if (!fixed) seats[number]++;
    if (!members.has(number)) members.set(number, []);
    members.get(number).push(uid);
  }
  for (const uid of unassigned) {
    const number = availableNumber(members, seats, size);
    if (!members.has(number)) members.set(number, []);
    members.get(number).push(uid);
    seats[number]++;
  }
  const assignments = [], teamNames = [];
  for (const [number, students] of members) {
    const oldCaptain = oldCaptains.get(number);
    const name = oldCaptain ? session.teamNames[oldCaptain] : 'Team ' + number;
    const captain = students.includes(oldCaptain) ? oldCaptain : students[0];
    teamNames.push([captain, name]);
    students.forEach(uid => assignments.push([uid, captain]));
  }
  return {assignments: Object.fromEntries(assignments), teamNames: Object.fromEntries(teamNames)};
}

export function initialEntryRoles(teams,people){
  const entryMembers={},entryNames={};
  for(const team of Object.keys(teams.teamNames)){
    const members=people.filter(person=>teams.assignments[person.uid]===team);
    const editor=members[randomIndex(members.length)];
    entryMembers[team]=editor.uid;
    entryNames[team]=editor.name;
  }
  return {entryMembers,entryNames};
}

export function validateTeams(people, assignments, teamNames, maxSize = 20) {
  if (!validTeamSize(maxSize) || !assignments || !teamNames || typeof assignments !== 'object' || typeof teamNames !== 'object') return false;
  const ids = people.map(person => person.uid);
  const captains = Object.keys(teamNames);
  return ids.length > 0 && ids.length <= 500 && new Set(ids).size === ids.length &&
    captains.length <= 100 && Object.keys(assignments).length === ids.length &&
    ids.every(id => Object.hasOwn(assignments, id) && captains.includes(assignments[id])) &&
    captains.every(id => ids.includes(id) && assignments[id] === id &&
      typeof teamNames[id] === 'string' && teamNames[id].trim().length > 0 && teamNames[id].length <= 60 &&
      ids.filter(uid => assignments[uid] === id).length <= maxSize);
}
