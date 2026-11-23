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

export function getTeamComposition(session) {
  if (session.teamComposition != null) return {...session.teamComposition};
  // Older classrooms store membership by captain UID. Reserve their numbered
  // names first, then assign available numbers to any custom-named teams.
  const teams = Object.entries(session.teamNames || {});
  const numbers = new Map();
  const used = new Set();
  for (const [captain, name] of teams) {
    const n = /^Team ([1-9]\d?|100)$/.exec(name)?.[1];
    if (n && !used.has(n)) { numbers.set(captain, n); used.add(n); }
  }
  let next = 1;
  for (const [captain] of teams) {
    if (numbers.has(captain)) continue;
    while (used.has(String(next))) next++;
    numbers.set(captain, String(next)); used.add(String(next));
  }
  return Object.fromEntries(Object.entries(session.assignments || {})
    .filter(([, captain]) => numbers.has(captain)).map(([uid, captain]) => [uid, numbers.get(captain)]));
}

export function materializeTeams(people, session) {
  if (session.teamComposition == null) return {assignments: session.assignments || {}, teamNames: session.teamNames || {}};
  const members = new Map();
  for (const {uid} of people) {
    const number = session.teamComposition[uid];
    if (!number) continue;
    if (!members.has(number)) members.set(number, []);
    members.get(number).push(uid);
  }
  const assignments = [], teamNames = [];
  for (const [number, ids] of members) {
    const name = 'Team ' + number;
    ids.sort();
    const captain = ids.find(uid => session.teamNames?.[uid] === name && session.assignments?.[uid] === uid) || ids[0];
    teamNames.push([captain, name]);
    ids.forEach(uid => assignments.push([uid, captain]));
  }
  return {assignments: Object.fromEntries(assignments), teamNames: Object.fromEntries(teamNames)};
}

export function validateTeams(people, assignments, teamNames) {
  if (!assignments || !teamNames || typeof assignments !== 'object' || typeof teamNames !== 'object') return false;
  const ids = people.map(person => person.uid);
  const captains = Object.keys(teamNames);
  return ids.length > 0 && ids.length <= 500 && new Set(ids).size === ids.length &&
    captains.length <= 100 && Object.keys(assignments).length === ids.length &&
    ids.every(id => Object.hasOwn(assignments, id) && captains.includes(assignments[id])) &&
    captains.every(id => ids.includes(id) && assignments[id] === id &&
      typeof teamNames[id] === 'string' && teamNames[id].trim().length > 0 && teamNames[id].length <= 60 &&
      ids.filter(uid => assignments[uid] === id).length <= 20);
}
