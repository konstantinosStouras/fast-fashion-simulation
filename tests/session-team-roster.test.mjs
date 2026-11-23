import test from 'node:test';
import assert from 'node:assert/strict';
import {sessionTeamRoster} from '../session-team-roster.js';

const users = new Map([
  ['a', {name:'Alex', email:'a@example.test'}],
  ['b', {name:'Alex', email:'b@example.test'}],
  ['c', {name:'Carmen'}],
  ['d', {name:'Dana'}],
  ['pending', {name:'Emi'}]
]);
const participants = [...users.keys()].filter(uid => uid !== 'pending').map(uid => ({uid, name:uid}));
const session = {code:'MILAN', mode:'team', status:'running', startedAt:1,
  teamComposition:{a:'10', b:'2', c:'10', pending:'3'},
  assignments:{a:'c', b:'b', c:'c'}, teamNames:{b:'Team 2',c:'Team 10'},
  teamOpponents:{b:'c',c:'b'}, aiOpponent:{practice:true,main:false,provider:'anthropic',model:'model-X'}};

test('waiting numbered rosters show joined and preassigned names, including pending-only teams', () => {
  const {teams,unassigned} = sessionTeamRoster({...session,status:'lobby',startedAt:null}, participants, users);
  assert.deepEqual(teams.map(team => team.name), ['Team 2','Team 3','Team 10']);
  assert.deepEqual(teams[1].members, [{uid:'pending',name:'Emi',joined:false,captain:false}]);
  assert.deepEqual(teams[2].members.map(({uid,captain}) => [uid,captain]), [['a',false],['c',true]]);
  assert.equal(teams[0].members[0].detail, 'b@example.test');
  assert.equal(teams[2].members[0].detail, 'a@example.test');
  assert.deepEqual(unassigned, [{uid:'d',name:'Dana',joined:true,captain:false}]);
  assert(teams.every(team=>team.mainOpponent==='Awaiting draw'));
  assert(teams.every(team=>team.practiceOpponent==='AI practice opponent'));
});

test('started games show only participating teams, the saved human draw and the configured phase AI', () => {
  const {teams} = sessionTeamRoster(session, participants, users);
  assert.deepEqual(teams.map(({name,mainOpponent}) => [name, mainOpponent]), [['Team 2','Team 10'],['Team 10','Team 2']]);
  assert.equal(teams[0].practiceOpponent,'AI opponent · Anthropic · model-X');
  const mainAI = {...session, aiOpponent:{...session.aiOpponent,practice:false,main:true}, teamOpponents:{b:null,c:null}};
  assert(sessionTeamRoster(mainAI, participants, users).teams.every(team=>
    team.practiceOpponent==='Bye · individual play' && team.mainOpponent==='AI opponent · Anthropic · model-X'));
});

test('custom legacy teams, undrawn closed sessions and retained anonymous decision holders stay identifiable', () => {
  const legacy={...session,teamNames:{b:'Cobalt',c:'Amber'},teamComposition:undefined,teamOpponents:undefined,aiOpponent:undefined};
  const pending=sessionTeamRoster({...legacy,status:'lobby'},participants,users);
  assert.deepEqual(pending.teams.map(team=>[team.name,team.mainOpponent]),[['Amber','Awaiting draw'],['Cobalt','Awaiting draw']]);
  const completed=sessionTeamRoster({...legacy,status:'closed'},participants,users);
  assert(completed.teams.every(team=>team.mainOpponent==='All other teams · classroom market'));
  const cancelled=sessionTeamRoster({...session,status:'closed',startedAt:null,teamOpponents:null},participants,users);
  assert(cancelled.teams.every(team=>team.practiceOpponent==='Session did not start' && team.mainOpponent==='Session did not start'));
  const removed=sessionTeamRoster({...legacy,assignments:{a:'c',b:'b'}},
    participants.map(person=>person.uid==='c'?{uid:'c',name:'Deleted user',email:''}:person),users);
  const captain=removed.teams.find(team=>team.name==='Amber').members.find(member=>member.captain);
  assert.deepEqual(captain,{uid:'c',name:'Deleted user',joined:true,captain:true});
  assert.deepEqual(sessionTeamRoster({...session,mode:'individual'},participants,users),{teams:[],unassigned:[]});
});
