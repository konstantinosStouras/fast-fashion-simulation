import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {showTeamsPanel} from '../studio-teams.js';

function room(code, extra = {}) {
  return {code, name: 'Session ' + code, mode: 'team', status: 'lobby', ...extra};
}

function harness(t, sessions, registered = []) {
  const dom = new JSDOM('<main></main>');
  const panel = dom.window.document.querySelector('main');
  const listeners = {session: [], participants: []}, scopes = [], cleanup = [];
  function watch(kind) {
    return (code, next, error) => {
      const subscription = {code, next, error, active: true};
      listeners[kind].push(subscription);
      return () => { subscription.active = false; };
    };
  }
  const api = {
    listSessions: async allClassrooms => {
      scopes.push(allClassrooms);
      return sessions.map(session => ({...session}));
    },
    listTeamUsers: async () => ({users: registered}),
    getDefaultTeamComposition: async () => ({teamComposition: {}}),
    watchSession: watch('session'),
    watchParticipants: watch('participants')
  };
  const select = code => {
    const picker = panel.querySelector('#session-team-code');
    picker.value = code;
    picker.dispatchEvent(new dom.window.Event('change', {bubbles: true}));
  };
  const mount = (allClassrooms = false, requestedCode = null) =>
    showTeamsPanel(panel, api, allClassrooms, requestedCode, undefined, undefined, stop => cleanup.push(stop));
  function dispose() {
    for (const stop of cleanup.splice(0)) stop();
  }
  t.after(() => { dispose(); dom.window.close(); });
  return {panel, select, mount, listeners, scopes, dispose};
}

function teamRow(section, label) {
  const row = [...section.querySelectorAll('tbody tr')].find(node =>
    node.querySelector('th[scope="row"]')?.textContent.trim() === label);
  assert.ok(row, 'Team row is shown for ' + label);
  return [...row.querySelectorAll('td')].map(cell => cell.textContent);
}

test('the roster below registered users shows scoped session codes and independent phase opponents', async t => {
  const closed = room('OSLO', {
    name: 'Autumn <b>class</b>', status: 'closed', startedAt: 100,
    assignments: {captain:'captain', learner:'captain', rival:'rival', odd:'odd'},
    teamNames: {captain:'Indigo', rival:'Amber', odd:'Ochre'},
    teamOpponents: {captain:'rival', rival:'captain', odd:null},
    aiOpponent: {practice:true, main:false, provider:'anthropic', model:'example-model'}
  });
  const h = harness(t, [closed, room('LIMA'), room('REMOVED',{deletedAt:1})]);
  await h.mount(false, 'OUTSIDE');
  const section = h.panel.querySelector('#session-teams'), picker = section.querySelector('#session-team-code');
  assert.equal(h.panel.querySelector('.team-directory').nextElementSibling, section);
  assert.deepEqual(h.scopes, [false]);
  assert.equal(picker.value, '');
  assert.deepEqual([...picker.options].map(option => option.value).sort(), ['', 'LIMA', 'OSLO']);
  assert.match([...picker.options].find(o => o.value==='OSLO').textContent, /OSLO.*Autumn <b>class<\/b>/);
  assert.equal(section.querySelector('b'), null, 'Session titles are escaped');
  assert.equal(h.listeners.session.length + h.listeners.participants.length, 0);
  h.select('OSLO');
  h.listeners.session.at(-1).next(closed);
  h.listeners.participants.at(-1).next([
    {uid:'captain', name:'Ada'}, {uid:'learner', name:'<img src=x> Lin'},
    {uid:'rival', name:'Bea'}, {uid:'odd', name:'Kai'}
  ]);
  assert.deepEqual([...section.querySelectorAll('thead th')].map(cell => cell.textContent),
    ['Team','Members','Practice opponent','Main phase opponent']);
  const [members, practice, main] = teamRow(section,'Indigo');
  assert.match(members,/Ada/);
  assert.match(members,/<img src=x> Lin/);
  assert.equal(section.querySelector('img'),null);
  assert.match(practice,/AI opponent.*Anthropic.*example-model/);
  assert.equal(main,'Amber');
  assert.equal(teamRow(section,'Amber')[2],'Indigo');
  assert.match(teamRow(section,'Ochre')[2],/Bye.*individual play/i);
});

test('switching session cancels stale reads and keeps waiting assignments separate from joined users', async t => {
  const oldRoom = room('OLD'), nextRoom = room('NEXT',{teamComposition:{alex:'2',pat:'2'}});
  const h = harness(t, [oldRoom,nextRoom,room('INDIV',{mode:'individual',status:'closed'})], [{uid:'pat', name:'Pat Preassigned'}]);
  await h.mount(true,'OLD');
  const section = h.panel.querySelector('#session-teams');
  assert.deepEqual(h.scopes,[true]);
  assert.equal(section.querySelector('select').value,'OLD');
  const previous = h.listeners.session.at(-1);
  previous.next(oldRoom);
  const oldMembers = h.listeners.participants.at(-1);
  h.select('NEXT');
  assert.equal(previous.active,false);
  assert.equal(oldMembers.active,false);
  const current = h.listeners.session.at(-1);
  current.next(nextRoom);
  const currentMembers = h.listeners.participants.at(-1);
  currentMembers.next([{uid:'alex',name:'Alex Joined'},{uid:'extra',name:'Unassigned Jo'}]);
  previous.next({...oldRoom,teamComposition:{obsolete:'6'}});
  oldMembers.next([{uid:'obsolete',name:'Stale name'}]);
  oldMembers.error(new Error('Late subscription error'));
  const [members,practice,main] = teamRow(section,'Team 2');
  assert.match(members,/Alex Joined/);
  assert.match(members,/Pat Preassigned/);
  assert.match(members,/waiting to join|not joined|preassigned/i);
  assert.equal(practice,'AI practice opponent');
  assert.match(main,/draw/i);
  assert.match(section.textContent,/Unassigned Jo/);
  assert.doesNotMatch(section.textContent,/Stale name|Late subscription error/);
  current.next({...nextRoom,status:'running',startedAt:1,teamPractice:true,oddTeamAi:true,assignments:{pat:'pat'},teamNames:{pat:'Team 2'},teamOpponents:{pat:null}});
  assert.match(teamRow(section,'Team 2')[2],/AI opponent/);
  h.select('INDIV');
  assert.equal(current.active,false);
  assert.equal(currentMembers.active,false);
  assert.match(section.textContent,/individual.*no teams/i);
  assert.equal(section.querySelector('tbody tr'),null);
  assert.equal(h.listeners.participants.some(listener => listener.code==='INDIV'),false);
  h.dispose();
  assert.ok(Object.values(h.listeners).flat().every(listener => !listener.active));
});

test('empty sessions and denied roster reads do not show old membership', async t => {
  const rooms = [];
  const h = harness(t,rooms);
  await h.mount();
  const section = h.panel.querySelector('#session-teams'), picker=section.querySelector('select');
  assert.equal(picker.disabled,true);
  assert.equal(h.listeners.session.length + h.listeners.participants.length,0);
  assert.match(section.textContent,/no .*sessions|no sessions/i);
  const lobby=room('EMPTY',{teamComposition:{}});rooms.push(lobby);
  h.panel.querySelector('#directory-refresh').click();
  await new Promise(resolve => setImmediate(resolve));
  h.select('EMPTY');
  h.listeners.session.at(-1).next(lobby);
  h.listeners.participants.at(-1).next([]);
  assert.match(section.textContent,/no teams|no team assignments/i);
  h.listeners.participants.at(-1).error(new Error('Access denied'));
  const retry=[...section.querySelectorAll('button')].find(button => /retry/i.test(button.textContent));
  assert.ok(retry, 'A retry is available after a roster read fails');
  retry.click();
  h.listeners.session.at(-1).next({...lobby,teamComposition:{fresh:'1'}});
  h.listeners.participants.at(-1).next([{uid:'fresh',name:'New member'}]);
  assert.match(teamRow(section,'Team 1')[0],/New member/);
});
