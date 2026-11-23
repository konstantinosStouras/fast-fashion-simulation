import {DEFAULT_ORDER, validOrder, validateConfig} from './model.js';
import {sharedMarket} from './market.js';

const maxUnits = 200;
const units = value => Math.min(maxUnits, Math.max(0, Math.round(value)));
const validSeed = seed => Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff;

// Estimate profit before either business knows this round's demand or opening order.
// Test light, average and heavy rival inventory against independent demand draws.
function chooseOpeningOrder(config) {
  const meanPerStyle = config.demandMean / (2 * DEFAULT_ORDER.variety);
  const candidates = new Set([0, ...[0.4, 0.6, 0.8, 1, 1.2, 1.5, 2].map(ratio => units(meanPerStyle * ratio)), maxUnits]);
  const forecastCap = config.price > config.refillCost ? maxUnits : 0;
  let bestQuantity = 0, bestProfit = -Infinity;
  for (const quantity of candidates) {
    const opponent = {...DEFAULT_ORDER, quantity, cap: forecastCap};
    let profit = 0;
    for (let sample = 0; sample < 6; sample++) {
      const otherQuantity = units(meanPerStyle * [0.5, 1, 1.5][sample % 3]);
      const business = {...DEFAULT_ORDER, quantity: otherQuantity, cap: forecastCap};
      const sampleSeed = Math.imul(sample + 1, 2654435761) >>> 0;
      profit += sharedMarket(sampleSeed, 0, {business, opponent}, config).teams.opponent.profit;
    }
    if (profit > bestProfit) {
      bestProfit = profit;
      bestQuantity = quantity;
    }
  }
  return {...DEFAULT_ORDER, quantity: bestQuantity, cap: 0};
}

export function isPracticeAttempt(attempt) {
  return Boolean(attempt && validSeed(attempt.seed)
    && ['plan', 'respond', 'finished'].includes(attempt.phase)
    && validOrder(attempt.order, 0) && validOrder(attempt.opponentOrder, 0)
    && (attempt.phase === 'finished' || attempt.order.cap === 0)
    && (attempt.phase !== 'plan' || attempt.opponentOrder.cap === 0));
}

export function startPracticeAttempt(config, seed = crypto.getRandomValues(new Uint32Array(1))[0]) {
  if (!config || !validateConfig(config)) throw Error('Invalid practice settings.');
  if (!validSeed(seed)) throw Error('Invalid practice seed.');
  return {seed, phase: 'plan', order: {...DEFAULT_ORDER}, opponentOrder: chooseOpeningOrder(config)};
}

export function practiceMarket(config, attempt) {
  if (!isPracticeAttempt(attempt)) throw Error('Invalid practice attempt.');
  return sharedMarket(attempt.seed, 0, {business: attempt.order, opponent: attempt.opponentOrder}, config);
}

export function submitPracticePlan(config, attempt, quantity) {
  if (!isPracticeAttempt(attempt) || attempt.phase !== 'plan') throw Error('The opening order is already locked.');
  const order = {...DEFAULT_ORDER, quantity};
  if (!validOrder(order, 0)) throw Error('Choose a whole number of initial units from 0 to 200.');
  const midpoint = {...attempt, phase: 'respond', order};
  const signals = practiceMarket(config, midpoint).teams.opponent.signals;
  // A cap covers the largest projected shortfall. The market orders only as
  // much as each style's own forecast supports.
  const cap = config.price > config.refillCost
    ? units(Math.max(...signals.map(style => style.signal - style.stock))) : 0;
  return {...midpoint, opponentOrder: {...attempt.opponentOrder, cap}};
}

export function submitPracticeResponse(attempt, cap) {
  if (!isPracticeAttempt(attempt) || attempt.phase !== 'respond') throw Error('Submit an opening order before setting replenishment.');
  const order = {...attempt.order, cap};
  if (!validOrder(order, 0)) throw Error('Choose a whole-number replenishment cap from 0 to 200.');
  return {...attempt, phase: 'finished', order};
}
