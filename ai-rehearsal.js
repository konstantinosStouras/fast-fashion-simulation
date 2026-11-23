// Local classroom demos and private rehearsals use fixtures and make no API calls.
export function rehearsalAiOrders(config, draw) {
 const quantity = Math.min(200, Math.max(0, Math.round(config.demandMean / 8 * (0.7 + (draw % 31) / 100))));
 const cap = Math.min(200, Math.ceil(quantity / 2));
 return {
  0: { variety: 4, quantity, cap },
  1: { variety: 4, quantity, cap: 0 },
  2: { variety: 4, quantity, cap },
  3: { variety: draw % 2 ? 4 : 8, quantity, cap }
 };
}
