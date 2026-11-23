import test from 'node:test';
import assert from 'node:assert/strict';
import {assignJoiningTeam, getTeamComposition, materializeTeams, validateTeams} from '../functions/teams.js';

const people = ids => ids.map(uid => ({uid}));

test('code joins fill teams to the saved size, retain the captain and make a smaller final team', () => {
  const ids = ['f','c','g','a','e','d','b'];
  for (const [teamSize, expected] of [[undefined,[3,3,1]], [2,[2,2,2,1]], [7,[7]]]) {
    const lobby = {mode:'team', status:'lobby', teamSize};
    for (const uid of ids) {
      const before = {...lobby.assignments};
      Object.assign(lobby, assignJoiningTeam(lobby, uid));
      for (const [member,captain] of Object.entries(before)) assert.equal(lobby.assignments[member],captain);
    }
    const {assignments,teamNames} = lobby;
    assert.equal(assignments.f,'f');
    assert.deepEqual(Object.keys(teamNames).map(captain=>Object.values(assignments).filter(id=>id===captain).length),expected);
    assert.ok(validateTeams(people(ids),assignments,teamNames,teamSize ?? 3));
    assert.deepEqual(assignJoiningTeam(lobby,'c'),{assignments,teamNames});
    assert.deepEqual(materializeTeams(people(ids).reverse(),lobby),{assignments,teamNames});
  }
});

test('legacy lobbies with missing assignments receive the same teams on preview and start', () => {
  const roster = people(['g','a','f','e','b','d','c']);
  const session = {mode:'team',status:'lobby',teamSize:3,assignments:{a:'e',e:'e'},teamNames:{e:'North'}};
  const formed = materializeTeams(roster,session);
  assert.deepEqual(formed,materializeTeams(roster.toReversed(),session));
  assert.deepEqual(formed,{assignments:{a:'e',e:'e',b:'e',c:'c',d:'c',f:'c',g:'g'},teamNames:{e:'North',c:'Team 2',g:'Team 3'}});
  assert.deepEqual(materializeTeams(roster,{...session,...formed}),formed);
  assert.deepEqual(materializeTeams(roster,{...session,status:'running'}),{assignments:session.assignments,teamNames:session.teamNames});
});

test('directory reservations and automatic members share a team without filling another student’s reserved seat', () => {
  const room = {teamSize:2,teamComposition:{a:'1',absent:'1'}};
  for (const uid of ['a','b','c','d']) Object.assign(room,assignJoiningTeam(room,uid));
  assert.deepEqual(room.assignments,{a:'a',b:'b',c:'b',d:'d'});
  assert.deepEqual(getTeamComposition(room),{a:'1',absent:'1',b:'2',c:'2',d:'3'});
  assert.deepEqual(materializeTeams(people(['d','c','b','a']),room),{assignments:room.assignments,teamNames:room.teamNames});
  const joined=assignJoiningTeam(room,'absent');
  assert.equal(joined.assignments.absent,'a');
  assert.deepEqual(joined.teamNames,room.teamNames);
});

test('enforce configured size and classroom limits while retaining previous explicit team sizes', () => {
  const preset = {a:'1',b:'1',c:'1',d:'1'}, roster=people(Object.keys(preset));
  assert.throws(()=>materializeTeams(roster,{teamComposition:preset,teamSize:3}),/up to 3/);
  assert.throws(()=>assignJoiningTeam({teamComposition:preset,teamSize:3},'d'),/up to 3/);
  const legacy=materializeTeams(roster,{teamComposition:preset});
  assert.ok(validateTeams(roster,legacy.assignments,legacy.teamNames));
  assert.equal(validateTeams(roster,legacy.assignments,legacy.teamNames,3),false);
  const many=people(Array.from({length:501},(_,i)=>'u'+i));
  assert.throws(()=>materializeTeams(many,{teamSize:20}),/500/);
  assert.throws(()=>materializeTeams(many.slice(0,101),{teamSize:1}),/100 teams/);
  const full=materializeTeams(many.slice(0,500),{teamSize:5});
  assert.equal(Object.keys(full.teamNames).length,100);
  assert.throws(()=>assignJoiningTeam({...full,teamSize:5},'extra'),/500/);
  assert.throws(()=>assignJoiningTeam({teamSize:0},'first'),/1–20/);
});
