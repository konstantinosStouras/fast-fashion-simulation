import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_CONFIG, DEFAULT_ORDER} from '../model.js';
import {sharedMarket} from '../market.js';
import {isPracticeAttempt, practiceMarket, startPracticeAttempt, submitPracticePlan, submitPracticeResponse} from '../team-practice.js';

test('team practice keeps opening orders locked and resolves both businesses in the same market', () => {
  const start = startPracticeAttempt(DEFAULT_CONFIG, 42);
  const mid = submitPracticePlan(DEFAULT_CONFIG, start, 33);
  const forecasts = practiceMarket(DEFAULT_CONFIG, mid).teams;
  assert.equal(mid.phase, 'respond');
  assert.equal(mid.order.quantity, 33);
  assert.deepEqual(start.order, DEFAULT_ORDER);
  assert.equal(start.opponentOrder.cap, 0);
  const shortages = forecasts.opponent.signals.map(row => row.signal - row.stock);
  assert.equal(mid.opponentOrder.cap, Math.min(200, Math.max(0, ...shortages)));
  const finished = submitPracticeResponse(mid, 65);
  assert.deepEqual(finished.opponentOrder, mid.opponentOrder);
  assert.deepEqual(finished.order, {variety: 4, quantity: 33, cap: 65});
  const market = practiceMarket(DEFAULT_CONFIG, finished);
  assert.deepEqual(market, sharedMarket(42, 0, {business: finished.order, opponent: mid.opponentOrder}, DEFAULT_CONFIG));
  assert.deepEqual(market.teams.business.signals, forecasts.business.signals);
  assert.equal(market.teams.business.sales + market.teams.opponent.sales + market.lostSales, market.demand);
  assert.equal(mid.order.cap, 0);
});

test('the practice rival uses the classroom economics and only its own public information', () => {
  const start = startPracticeAttempt(DEFAULT_CONFIG, 12);
  assert.deepEqual(start.opponentOrder, startPracticeAttempt(DEFAULT_CONFIG, 9876).opponentOrder);
  assert.ok(start.opponentOrder.quantity > 0);
  for (const quantity of [0, 80, 200]) {
    const mid = submitPracticePlan(DEFAULT_CONFIG, start, quantity);
    assert.equal(mid.opponentOrder.quantity, start.opponentOrder.quantity);
    const lowCap = submitPracticeResponse(mid, 0), highCap = submitPracticeResponse(mid, 200);
    assert.deepEqual(lowCap.opponentOrder, highCap.opponentOrder);
  }
  const lossMaking = {...DEFAULT_CONFIG, price: 6, salvage: 0};
  const lossMid = submitPracticePlan(lossMaking, startPracticeAttempt(lossMaking, 12), 0);
  assert.deepEqual(lossMid.opponentOrder, {variety: 4, quantity: 0, cap: 0});
});

test('fresh practice rounds use independent seeds and accept only valid restored decisions and transitions', () => {
  const first = startPracticeAttempt(DEFAULT_CONFIG, 1), next = startPracticeAttempt(DEFAULT_CONFIG, 2);
  const mid = submitPracticePlan(DEFAULT_CONFIG, first, 80);
  const finished = submitPracticeResponse(mid, 50);
  assert.deepEqual(next.order, DEFAULT_ORDER);
  assert.equal(next.phase, 'plan');
  assert.notDeepEqual(practiceMarket(DEFAULT_CONFIG, first), practiceMarket(DEFAULT_CONFIG, next));
  assert.deepEqual(practiceMarket(DEFAULT_CONFIG, finished), practiceMarket(DEFAULT_CONFIG, JSON.parse(JSON.stringify(finished))));
  assert.equal(isPracticeAttempt({}), false);
  assert.equal(isPracticeAttempt({...mid, seed: -1}), false);
  assert.equal(isPracticeAttempt({...mid, order: {...mid.order, cap: 20}}), false);
  assert.throws(() => submitPracticePlan(DEFAULT_CONFIG, first, 12.2));
  assert.throws(() => submitPracticePlan(DEFAULT_CONFIG, finished, 80));
  assert.throws(() => submitPracticeResponse(mid, 201));
  assert.throws(() => submitPracticeResponse(first, 10));
  assert.throws(() => submitPracticeResponse(finished, 10));
});
