import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {discoverModels, generatePlan, validPlan} from '../functions/providers.js';
import {sealKey, openKey} from '../functions/keys.js';
import {getTeamComposition, makeTeamOpponents, materializeTeams} from '../functions/teams.js';
import {DEFAULT_CONFIG} from '../model.js';

const json = data => ({ok: true, json: async () => data});
const practice = {'0': {quantity: 57, variety: 4, cap: 28}};
const providers = {
  openai: {model: 'gpt-5-mini', catalog: {data: [{id: 'gpt-5-mini'}, {id: 'gpt-realtime'}]},
    reply: {output: [{content: [{type: 'output_text', text: JSON.stringify(practice)}]}]}},
  anthropic: {model: 'claude-sonnet-4-6', catalog: {data: [{id: 'claude-sonnet-4-6'}, {id: 'claude-opus-4', lifecycle: 'retired'}]},
    reply: {content: [{type: 'text', text: JSON.stringify(practice)}]}},
  google: {model: 'gemini-2.5-flash', catalog: {models: [
    {name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent']},
    {name: 'models/gemini-2.5-flash-image', supportedGenerationMethods: ['generateContent']}]},
    reply: {candidates: [{content: {parts: [{thought: true, text: 'internal'}, {text: JSON.stringify(practice)}]}}]}}
};

for (const [provider, fixture] of Object.entries(providers)) {
  test(provider + ' discovers account models and requests independent validated orders', async () => {
    const calls = [];
    const fetcher = async (url, options) => {
      calls.push({url, ...options});
      return json(options.method === 'GET' ? fixture.catalog : fixture.reply);
    };
    const key = 'fictional-test-key';
    const models = await discoverModels(provider, key, fetcher);
    assert.deepEqual(models.map(m => m.id), [fixture.model]);
    for (let i = 0; i < 2; i++) assert.deepEqual(await generatePlan(provider, fixture.model, key, 'practice', DEFAULT_CONFIG, fetcher), practice);
    assert.notEqual(calls[1].body, calls[2].body);
    for (const call of calls) {
      assert.doesNotMatch(call.url + (call.body || ''), /fictional-test-key/);
      assert.match(JSON.stringify(call.headers), /fictional-test-key/);
    }
    await assert.rejects(generatePlan(provider, fixture.model, key, 'main', DEFAULT_CONFIG, fetcher), /invalid retail strategy/);
  });
}

test('invalid orders and provider failures never produce a fallback plan or echo a key', async () => {
  assert.equal(validPlan({'0': {...practice[0], quantity: 200.5}}, 'practice'), false);
  assert.equal(validPlan({'1': practice[0], '2': practice[0], '3': practice[0]}, 'main'), false);
  const key = 'TEST-key-private';
  await assert.rejects(discoverModels('openai', key, async () => ({ok: false, status: 403, text: async () => key})), e =>
    e.code === 'failed-precondition' && !e.message.includes(key));
});

test('saved credentials bind ciphertext to their owner and provider', () => {
  const master = randomBytes(32).toString('base64');
  const stored = sealKey('a-fictional-api-key', master, 'instructor-1', 'google');
  assert(!JSON.stringify(stored).includes('fictional'));
  assert.equal(openKey(stored, master, 'instructor-1', 'google'), 'a-fictional-api-key');
  assert.throws(() => openKey(stored, master, 'instructor-2', 'google'), /could not be opened/);
  assert.throws(() => openKey(stored, master, 'instructor-1', 'openai'), /could not be opened/);
});

test('team plans retain existing captains and exclude preassigned users until they join', () => {
  const legacy = {assignments: {a:'b', b:'b', c:'c'}, teamNames: {b:'Team 2', c:'Studio X'}};
  assert.deepEqual(getTeamComposition(legacy), {a:'2', b:'2', c:'1'});
  const session = {...legacy, teamComposition: {a:'2', b:'2', c:'1', later:'3'}};
  assert.deepEqual(materializeTeams([{uid:'a'}, {uid:'b'}, {uid:'c'}], session), {assignments: legacy.assignments, teamNames:{b:'Team 2',c:'Team 1'}});
  assert.deepEqual(materializeTeams([{uid:'a'}], {...session, teamComposition:{}}), {assignments:{},teamNames:{}});
  const names = {a:'A',b:'B',c:'C',d:'D',e:'E'};
  const draw = makeTeamOpponents(names, () => 0);
  assert.equal(Object.values(draw).filter(r => r == null).length, 1);
  for (const [captain, rival] of Object.entries(draw)) if (rival) assert.equal(draw[rival], captain);
  assert.notDeepEqual(makeTeamOpponents(names, () => 0.999), draw);
});
