import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {DEFAULT_CONFIG} from '../model.js';
import {suggestCityCodes} from '../studio.js';

test('falls back to numbered cities once the plain names are taken', async () => {
 const suggestions = await suggestCityCodes(new Set(), async code => code.endsWith('2'));
 assert.equal(new Set(suggestions).size, 4);
 for (const code of suggestions) assert.match(code, /^[A-Z]+2$/);
});

test('instructor chooses globally available codes and can recover from a simultaneous claim', async t => {
 const dom = new JSDOM(readFileSync('index.html', 'utf8'), {url:'http://localhost:8791/?demo&studio=1', pretendToBeVisual:true});
 const w = dom.window;
 for (const key of ['window','document','location','localStorage','sessionStorage','FormData']) globalThis[key] = w[key];
 globalThis.addEventListener = w.addEventListener.bind(w);
 const $ = selector => w.document.querySelector(selector);
 async function waitFor(condition) {
  for (let i = 0; i < 150; i++) {
   if (condition()) return;
   await new Promise(resolve => setTimeout(resolve, 10));
  }
  assert.fail('Timed out waiting for studio state');
 }
 const backend = await import('../backend-demo.js');
 t.after(async () => { await backend.logout(); w.close(); });
 t.mock.method(Math, 'random', () => 0);
 await backend.loginGoogle();
 await backend.grant('host@example.test');
 await backend.createSession('Other host’s closed class', DEFAULT_CONFIG, 'individual', 'ROME');
 await backend.closeSession('ROME');
 await backend.createSession('Other host’s active class', DEFAULT_CONFIG, 'individual', 'TOKYO');
 await backend.logout();
 await backend.loginEmail('host@example.test', 'synthetic');
 await backend.createSession('My class', DEFAULT_CONFIG, 'individual', 'PARIS');
 await import('../main.js?city-picker');
 const choices = () => [...w.document.querySelectorAll('#city-suggestions button')];
 await waitFor(() => choices().length === 4);
 assert.deepEqual(choices().map(button => button.textContent), ['LIMA', 'OSLO', 'MILAN', 'LONDON']);
 const input = $('#classroom-code');
 assert.equal(input.value, 'LIMA');
 choices()[2].click();
 assert.equal(input.value, 'MILAN');

 const form = $('#create');
 form.elements.name.value = 'My new team class';
 form.elements.mode.value = 'team';
 await backend.createSession('First claimant', DEFAULT_CONFIG, 'individual', 'MILAN');
 form.requestSubmit();
 await waitFor(() => $('#classroom-code-status').textContent.includes('MILAN is already in use') && choices().length === 4);
 assert.ok(choices().every(button => button.textContent !== 'MILAN'));
 assert.equal(form.elements.name.value, 'My new team class');
 assert.equal(form.elements.mode.value, 'team');
 assert.equal(input.checkValidity(), false);
 input.value = 'rio';
 input.dispatchEvent(new w.Event('input', {bubbles:true}));
 assert.equal(input.value, 'RIO');
 assert.equal(input.checkValidity(), true);
 form.requestSubmit();
 await waitFor(() => $('[data-session="RIO"]'));
 const sessions = JSON.parse(w.localStorage.getItem('ff:demo:v1')).sessions;
 assert.equal(sessions.RIO.name, 'My new team class');
 assert.equal(sessions.RIO.mode, 'team');
 assert.equal(sessions.MILAN.name, 'First claimant');
});
