import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeUserClassroom} from '../functions/user-classrooms.js';
import {DEFAULT_CONFIG, ROUNDS} from '../model.js';

const participant = 'student';
const startedAt = 100_000;
const room = {code: 'PARIS', name: 'Classroom', mode: 'team', status: 'running', startedAt,
  assignments: {student: 'captain', captain: 'captain', rival: 'rival'},
  teamNames: {captain: 'Team 1', rival: 'Team 2'}, teamOpponents: {captain: 'rival', rival: 'captain'},
  aiOpponent: {provider: 'openai', model: 'classroom-model', practice: true, main: false}};
const describe = (session, seconds, joined = true) => summarizeUserClassroom({...session,phaseOffset:seconds}, participant, joined);

test('a joined team member changes from its personal AI to the saved human opponent at the phase boundary', () => {
  const practice = describe(room, ROUNDS[0].end - 1);
  assert.equal(practice.team, 'Team 1');
  assert.equal(practice.practiceOpponent, 'AI opponent · OpenAI · classroom-model');
  assert.equal(practice.mainOpponent, 'Team 2');
  assert.equal(practice.activeOpponent, practice.practiceOpponent);
  assert.equal(practice.currentPhase, 'practice');
  assert.equal(describe(room, ROUNDS[1].start).activeOpponent, 'Team 2');
  const comparison = describe(room, ROUNDS.at(-1).end);
  assert.equal(comparison.currentPhase, null);
  assert.equal(comparison.status, 'completed');
  assert.equal(comparison.activeOpponent, null);
  const completed = describe(room, 1080);
  assert.equal(completed.status, 'completed');
  assert.equal(completed.currentPhase, null);
  assert.equal(completed.activeOpponent, null);
  assert.equal(describe({...room,status:'closed'},60).activeOpponent,null);
});

test('only waiting preassignments appear before joining and stale assignments do not invent an opponent', () => {
  const waiting = {...room,status:'lobby',teamComposition:{student:'8'}};
  const planned = describe(waiting,0,false);
  assert.equal(planned.team,'Team 8');
  assert.equal(planned.joined,false);
  assert.equal(planned.mainOpponent,'Awaiting draw');
  assert.equal(planned.activeOpponent,null);
  assert.equal(describe({...waiting,teamComposition:{}},0,false),null);
  assert.equal(describe({...waiting,status:'closed'},1000,false),null);
  assert.equal(describe({...waiting,status:'running'},45,false),null);
  assert.equal(describe({...room,deletedAt:1},45),null);
  const stale=describe({...room,assignments:{student:'gone'},teamComposition:{student:'8'}},30);
  assert.equal(stale.team,null);
  assert.equal(stale.practiceOpponent,'Unassigned');
  assert.equal(stale.activeOpponent,null);
});

test('individuals, unpaired teams and older classroom-wide markets describe their actual competition', () => {
  const bye = describe({...room,teamOpponents:{captain:null,rival:null}},200);
  assert.equal(bye.mainOpponent,'Bye · individual play');
  assert.equal(bye.activeOpponent,null);
  const legacy = describe({...room,teamOpponents:undefined},200);
  assert.equal(legacy.mainOpponent,'Classroom market');
  assert.equal(legacy.activeOpponent,'Classroom market');
  const individual = {...room,mode:'individual'};
  assert.equal(describe(individual,10).team,null);
  assert.equal(describe(individual,10).activeOpponent,describe(individual,10).practiceOpponent);
  assert.equal(describe(individual,200).activeOpponent,null);
});

test('demo directory shows account metadata while classroom activity follows staff ownership', async t => {
  const records=new Map();
  globalThis.localStorage={getItem:key=>records.get(key)||null,setItem:(key,value)=>records.set(key,value)};
  globalThis.addEventListener=()=>{};
  t.after(()=>{delete globalThis.localStorage;delete globalThis.addEventListener;});
  const api=await import('../backend-demo.js');
  await api.loginGoogle();await api.grant('teacher@example.test');
  const ownerRoom=await api.createSession('Owner classroom',DEFAULT_CONFIG,'team','ROME');
  await api.loginEmail('teacher@example.test');
  const teacherRoom=await api.createSession('Teacher classroom',DEFAULT_CONFIG,'team','LONDON');
  await api.register('student@example.test','demo',{firstName:'Ada',lastName:'Lane',universityId:'S500'});
  const uid=api.currentUser().uid;
  await api.loginEmail('student@example.test');await api.joinSession(ownerRoom,'Ada Lane');
  await assert.rejects(api.getUserClassrooms(uid),/instructor/);
  await api.loginEmail('teacher@example.test');
  await api.saveTeamComposition(teacherRoom,{[uid]:'7'});
  const {users}=await api.listTeamUsers();
  const account=users.find(person=>person.uid===uid);
  assert.equal(account.studentId,'S500');
  assert.ok(Number.isFinite(Date.parse(account.registeredAt)));
  assert.ok(Date.parse(account.lastSignInAt)>=Date.parse(account.registeredAt));
  const own=(await api.getUserClassrooms(uid)).sessions;
  assert.deepEqual(own.map(s=>[s.code,s.joined,s.team]),[[teacherRoom,false,'Team 7']]);
  await api.loginGoogle();
  const all=(await api.getUserClassrooms(uid)).sessions;
  assert.equal(all.length,2);
  assert.equal(all.find(s=>s.code===ownerRoom).joined,true);
});
