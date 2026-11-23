import {randomUUID} from 'node:crypto';

export const providers = {openai: 'OpenAI', anthropic: 'Anthropic', google: 'Google'};
export const phaseRounds = {practice: [0], main: [1, 2, 3]};

// All endpoint hosts and paths originate here. The saved account model catalog
// is also checked before generating an order.
const endpoints = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
  google: 'https://generativelanguage.googleapis.com/v1beta'
};

export class AiError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

async function request(provider, path, key, body, fetcher) {
  const headers = {'Content-Type': 'application/json'};
  if (provider === 'openai') headers.Authorization = 'Bearer ' + key;
  if (provider === 'anthropic') Object.assign(headers, {'x-api-key': key, 'anthropic-version': '2026-10-21'});
  if (provider === 'google') headers['x-goog-api-key'] = key;
  let response;
  try {
    response = await fetcher(endpoints[provider] + path, {
      headers, method: body ? 'POST' : 'GET', body: body ? JSON.stringify(body) : undefined,
      redirect: 'error', signal: AbortSignal.timeout(body ? 90000 : 15000)
    });
  } catch {
    throw new AiError('unavailable', providers[provider] + ' could not be reached. Please retry.');
  }
  if (!response.ok) {
    if ([401, 403].includes(response.status)) throw new AiError('failed-precondition', providers[provider] + ' denied access. Check the API key and model permissions in AI settings.');
    if (response.status === 429) throw new AiError('resource-exhausted', providers[provider] + ' reported a rate or credit limit. Check the provider account and retry.');
    if (response.status >= 500) throw new AiError('unavailable', providers[provider] + ' is temporarily unavailable. Please retry.');
    throw new AiError('failed-precondition', providers[provider] + ' rejected the request. Check the key and selected model in AI settings.');
  }
  try {
    return await response.json();
  } catch {
    throw new AiError('unavailable', providers[provider] + ' returned an unreadable response. Please retry.');
  }
}

export async function discoverModels(provider, key, fetcher = fetch) {
  const path = provider === 'google' ? '/models?pageSize=1000' :
    provider === 'anthropic' ? '/models?limit=1000' : '/models';
  const response = await request(provider, path, key, null, fetcher);
  let models;
  if (provider === 'openai') {
    // The Models API also returns embeddings, realtime, transcription, image,
    // and tool-specialized models. Offer general-purpose structured text models.
    models = (response.data || []).filter(m => /^gpt-(4o|4\.1|[5-9](\.\d+)?)(-(mini|nano))?(-\d{4}-\d{2}-\d{2})?$/.test(m.id))
      .sort((a, b) => Number(/-\d{4}-/.test(a.id)) - Number(/-\d{4}-/.test(b.id)) || (b.created || 0) - (a.created || 0))
      .map(m => ({id: m.id, label: m.id}));
  } else if (provider === 'anthropic') {
    models = (response.data || []).filter(m => /^claude-(haiku|sonnet|opus|fable|mythos)-[a-z0-9-]+$/.test(m.id) &&
      m.capabilities?.structured_outputs?.supported !== false && (!m.lifecycle || m.lifecycle === 'active'))
      .map(m => ({id: m.id, label: m.display_name || m.id}));
  } else {
    models = (response.models || []).filter(m =>
      /^models\/gemini-[a-z0-9.-]+$/.test(m.name) && m.supportedGenerationMethods?.includes('generateContent') &&
      /(?:pro|flash)/.test(m.name) && !/(?:tts|audio|image|robotics|computer-use|live|research)/.test(m.name))
      .map(m => ({id: m.name.slice(7), label: m.displayName || m.name.slice(7)}));
  }
  if (!models.length) throw new AiError('failed-precondition', providers[provider] + ' returned no supported strategy models for this key.');
  return models;
}

function planSchema(phase) {
  const roundSchemas = phaseRounds[phase].map(round => [String(round), {
    type: 'object', additionalProperties: false, required: ['variety', 'quantity', 'cap'],
    properties: {
      variety: {type: 'integer', enum: round === 3 ? [4, 8] : [4]},
      quantity: {type: 'integer', description: 'Initial units per style, 0 through 200.'},
      cap: round === 1 ? {type: 'integer', enum: [0]} : {type: 'integer', description: 'Maximum refill units per style, 0 through 200.'}
    }
  }]);
  return {type: 'object', properties: Object.fromEntries(roundSchemas), required: roundSchemas.map(([id]) => id), additionalProperties: false};
}

export function validPlan(orders, phase) {
  if (!orders || !Object.hasOwn(phaseRounds, phase) || Object.keys(orders).length !== phaseRounds[phase].length) return false;
  const bounded = n => Number.isInteger(n) && n >= 0 && n <= 200;
  return phaseRounds[phase].every(round => {
    const order = orders[round];
    return order && Object.keys(order).length === 3 && (order.variety === 4 || (round === 3 && order.variety === 8)) &&
      bounded(order.quantity) && bounded(order.cap) && (round !== 1 || order.cap === 0);
  });
}

function strategyPrompt(phase, config) {
  const {demandMean, demandSd, forecastSd, price, initialCost, refillCost, styleCost, salvage} = config;
  return [
    'Independently design the profit-maximizing retail strategy for your own firm in a two-firm fast-fashion market.',
    'Your independent simulation draw is ' + randomUUID() + '.',
    'The human firm and your firm compete for one fixed number of customers per season. Market demand is a rounded normal draw floored at zero.',
    'Customers choose in proportion to style appeal, shared by both firms for matching styles. An unserved customer switches to available stock. Extra styles attract share but do not grow the market.',
    'Half the customers arrive early. In quick-response seasons each style gets a noisy forecast of its remaining preferred demand. Its automatic refill is min(cap, max(0, forecast - remaining stock)).',
    'Quantity is initial stock per style. Cap is maximum additional units per style. Both are whole numbers between 0 and 200.',
    'Profit equals sales times price plus leftovers times salvage, minus initial and refill procurement costs and the development cost of each offered style.',
    'Known numeric inputs in units and dollars: ' + JSON.stringify({demandMean, demandSd, forecastSd, price, initialCost, refillCost, styleCost, salvage}) + '.',
    phase === 'practice' ? 'Choose round 0: four styles, quick response.' :
      'Choose round 1: four styles, order ahead only, cap zero. Round 2: four styles, quick response. Round 3: choose four or eight styles, quick response.',
    'Assess the margins, uncertainty, capacity and competitor response to maximize expected profit in each season. Return the requested JSON object.'
  ].join('\n');
}

export async function generatePlan(provider, model, key, phase, config, fetcher = fetch) {
  const prompt = strategyPrompt(phase, config);
  const schema = planSchema(phase);
  let content;
  if (provider === 'openai') {
    const data = await request(provider, '/responses', key, {model, input: prompt, store: false, max_output_tokens: 4096,
      text: {format: {type: 'json_schema', name: 'retail_plan', strict: true, schema}}}, fetcher);
    content = data.output?.flatMap(item => item.content || []).filter(block => block.type === 'output_text').map(block => block.text).join('');
  } else if (provider === 'anthropic') {
    const data = await request(provider, '/messages', key, {model, max_tokens: 4096, messages: [{role: 'user', content: prompt}],
      output_config: {format: {type: 'json_schema', schema}}}, fetcher);
    content = data.content?.filter(block => block.type === 'text').map(block => block.text).join('');
  } else {
    const data = await request(provider, '/models/' + encodeURIComponent(model) + ':generateContent', key, {
      contents: [{role: 'user', parts: [{text: prompt}]}],
      generationConfig: {maxOutputTokens: 4096, responseMimeType: 'application/json', responseJsonSchema: schema}
    }, fetcher);
    content = data.candidates?.[0]?.content?.parts?.filter(part => !part.thought).map(part => part.text).join('');
  }
  let orders;
  try { orders = JSON.parse(content); } catch { /* Handled by the same validation as out-of-range orders. */ }
  if (!validPlan(orders, phase)) throw new AiError('failed-precondition', providers[provider] + ' returned an incomplete or invalid retail strategy. Retry preparation or select another model.');
  return orders;
}
