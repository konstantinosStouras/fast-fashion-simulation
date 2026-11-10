// Illustrative teaching model. No personal data, network calls or DOM access.
export const ROUNDS = [
  {name:'Practice', start:0, split:90, end:180, quick:true, scored:false},
  {name:'1 · Order ahead', start:180, split:420, end:420, quick:false, scored:true},
  {name:'2 · Respond to demand', start:420, split:540, end:660, quick:true, scored:true},
  {name:'3 · Expand the collection', start:660, split:810, end:960, quick:true, scored:true},
];
export const DEFAULT_ORDER = Object.freeze({variety:4, quantity:80, cap:0});
export const DEFAULT_CONFIG=Object.freeze({demandMean:480,demandSd:96,forecastSd:0.2,rebound:0.2,price:40,initialCost:12,refillCost:16,styleCost:150,salvage:5,unitCarbon:5,leftoverCarbon:1});
export const SETTINGS=[
 ['demandMean','Average market demand',480,80,2000,10,'Expected purchases across the whole collection, not per style.'],
 ['demandSd','Demand standard deviation',96,0,1000,1,'Season-level uncertainty. Demand is a normal draw, rounded and floored at zero. Default SD is 20% of the mean.'],
 ['forecastSd','Forecast error SD',0.2,0,0.8,0.05,'Relative error in the mid-season forecast: 0.20 means 20% standard deviation. Zero gives a perfect forecast.'],
 ['rebound','Extra consumption with 8 styles',0.2,0,1,0.05,'0 = purchases only shift between styles; 0.20 = total demand rises 20%; 0.50 = rises 50%.'],
 ['price','Selling price (€)',40,1,500,1,'Revenue per sold item. Fixed across all styles and seasons.'],
 ['initialCost','Initial unit cost (€)',12,0,500,1,'Cost for every unit ordered before demand is observed.'],
 ['refillCost','Replenishment unit cost (€)',16,0,500,1,'Cost per extra unit ordered after early sales. Usually higher than initial cost.'],
 ['styleCost','Development cost per style (€)',150,0,5000,10,'Charged once per style each season. Extra variety is not free.'],
 ['salvage','Leftover salvage value (€)',5,0,500,1,'Revenue recovered per unsold item. Must not exceed either production cost or the selling price.'],
 ['unitCarbon','Production footprint (kg CO₂e)',5,0,100,0.1,'Illustrative footprint per unit produced, including replenishment.'],
 ['leftoverCarbon','Extra leftover footprint (kg CO₂e)',1,0,100,0.1,'Additional handling/end-of-season footprint for each unsold item.']
];
export function validateConfig(c){return SETTINGS.every(([k,,v,min,max])=>Number.isFinite(c[k])&&c[k]>=min&&c[k]<=max)&&c.salvage<=Math.min(c.initialCost,c.refillCost,c.price);}
function config(value){return typeof value==='number'?{...DEFAULT_CONFIG,rebound:value}:{...DEFAULT_CONFIG,...value};}
export function phaseAt(elapsed) {
  if(elapsed<0) return {kind:'lobby',index:-1,end:0};
  const index=ROUNDS.findIndex(r=>elapsed<r.end);
  if(index<0)return {kind:elapsed<1080?'comparison':'finished',index:4,end:1080};
  const r=ROUNDS[index];return {kind:elapsed<r.split?'plan':'respond',index,end:elapsed<r.split?r.split:r.end};
}
export function validOrder(o,index) {
  return o && [4,...(index===3?[8]:[])].includes(o.variety) && Number.isInteger(o.quantity) && o.quantity>=0 && o.quantity<=200 && Number.isInteger(o.cap) && o.cap>=0 && o.cap<=200;
}
function rng(seed) {return ()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};}
export function demandFor(seed,index,variety,options=DEFAULT_CONFIG) {
  // Equal total base demand across scored seasons. New styles share that market;
  // only the explicit rebound parameter creates additional consumption.
  const c=config(options),random=rng(seed+(index===0?999:0));
  const normal=()=>Math.sqrt(-2*Math.log(Math.max(random(),1e-12)))*Math.cos(2*Math.PI*random());
  const base=Math.max(0,Math.round(c.demandMean+c.demandSd*normal()));
  const total=Math.round(base*(variety===8?1+c.rebound:1));
  const weights=Array.from({length:8},()=>Math.max(0.1,1+0.4*normal())).slice(0,variety);
  const sum=weights.reduce((a,b)=>a+b,0);
  const demand=weights.map(w=>Math.floor(total*w/sum));
  let remainder=total-demand.reduce((a,b)=>a+b,0);
  for(let i=0;i<remainder;i++)demand[i%variety]++;
  return demand.map((d,i)=>({style:i+1,demand:d,early:Math.floor(d/2),signal:Math.max(0,Math.round((d-Math.floor(d/2))*(1+c.forecastSd*normal())))}));
}
export function signalFor(seed,index,order,rebound) {
  return demandFor(seed,index,order.variety,rebound).map(s=>({style:s.style,sales:Math.min(s.early,order.quantity),stock:Math.max(0,order.quantity-s.early),signal:s.signal,stockout:s.early>order.quantity}));
}
export function resultFor(seed,index,order=DEFAULT_ORDER,rebound=DEFAULT_CONFIG) {
  if(!validOrder(order,index))throw new Error('Invalid order');
  const round=ROUNDS[index],c=config(rebound); let sales=0,leftovers=0,replenished=0,demand=0;
  for(const s of demandFor(seed,index,order.variety,rebound)) {
    const earlySales=Math.min(order.quantity,s.early), stock=order.quantity-earlySales;
    const add=round.quick?Math.min(order.cap,Math.max(0,s.signal-stock)):0;
    const lateSales=Math.min(stock+add,s.demand-s.early);
    sales+=earlySales+lateSales;leftovers+=stock+add-lateSales;replenished+=add;demand+=s.demand;
  }
  const initial=order.variety*order.quantity,produced=initial+replenished;
  return {sales,leftovers,replenished,produced,demand,lostSales:demand-sales,
    profit:sales*c.price+leftovers*c.salvage-initial*c.initialCost-replenished*c.refillCost-order.variety*c.styleCost,
    footprint:produced*c.unitCarbon+leftovers*c.leftoverCarbon,perSale:sales?(produced*c.unitCarbon+leftovers*c.leftoverCarbon)/sales:null};
}
export function scoredResults(seed,orders,rebound) {
  return [1,2,3].map(i=>({round:i,...resultFor(seed,i,orders[i]||DEFAULT_ORDER,rebound)}));
}
