import {
 isPracticeAttempt,
 practiceMarket,
 startPracticeAttempt,
 submitPracticePlan,
 submitPracticeResponse
} from './team-practice.js';

// Keep the current attempt usable if the browser blocks session storage.
let lastKey, lastState;

function practiceKey(room,userId){
 return 'ff:team-practice:'+JSON.stringify([userId,room.code,room.seed,room.createdAt?.toMillis()]);
}

export function clearTeamPractice(storage,room,userId){
 const key=practiceKey(room,userId);
 storage.removeItem(key);
 if(lastKey===key){lastKey=null;lastState=null;}
}

function readState(storage,key){
 let saved;
 try { saved=JSON.parse(storage.getItem(key)); } catch { /* Ignore an incomplete draft. */ }
 if(saved && Number.isSafeInteger(saved.round) && saved.round>0 && isPracticeAttempt(saved.attempt))return saved;
 return key===lastKey?lastState:null;
}

export function mountTeamPractice(panel,{room,userId,storage,signalTable,money}){
 const key=practiceKey(room,userId);
 const config=room.config;
 let state=readState(storage,key);
 function save(next){
  state=next;
  lastKey=key;
  lastState=state;
  storage.setItem(key,JSON.stringify(state));
 }
 function start(){
  if(!panel.isConnected)return;
  save({round:(state?.round??0)+1,attempt:startPracticeAttempt(config),draft:null});
  draw(true);
 }
 function draw(focus=false){
  if(!state){
   panel.innerHTML='<h2>Practice against AI</h2><p>Play as many unscored rounds as you like before class. Each teammate can practice independently. Your instructor starts the scored team competition.</p><button type="button" data-practice-start>Start a practice round</button>';
   panel.querySelector('[data-practice-start]').onclick=start;
   return;
  }
  const {attempt,round}=state;
  const prefix='<p class="eyebrow">AI PRACTICE · ROUND '+round+' · UNSCORED</p>';
  if(attempt.phase==='finished'){
   const {business,opponent}=practiceMarket(config,attempt).teams;
   const row=(label,score)=>'<tr><th scope="row">'+label+'</th><td>'+money(score.profit)+'</td><td>'+score.sales+'</td><td>'+score.leftovers+'</td><td>'+Math.round(score.footprint)+'</td></tr>';
   panel.innerHTML=prefix+'<h2 tabindex="-1">Practice results</h2><div class="table-wrap" tabindex="0" role="region" aria-label="Practice results"><table><thead><tr><th scope="col">Business</th><th scope="col">Profit</th><th scope="col">Sales</th><th scope="col">Leftovers</th><th scope="col">Footprint kg</th></tr></thead><tbody>'+row('You',business)+row('AI opponent',opponent)+'</tbody></table></div><p class="hint">Try a different order in a fresh market. Your classroom score comes from the three scored seasons.</p><button type="button" data-practice-start>Practice again</button>';
   panel.querySelector('[data-practice-start]').onclick=start;
  }else{
   const opening=attempt.phase==='plan';
   const title=opening?'Place your practice order':'Replenish your practice collection';
   const guidance=opening
    ? '<p>Your four styles compete with the AI for a market averaging '+config.demandMean+' purchases. Choose how much stock to buy before demand is known.</p>'
    : '<p>You ordered '+attempt.order.quantity+' units per style. Use your early sales and remaining stock to choose a replenishment cap.</p>'+signalTable(practiceMarket(config,attempt).teams.business.signals);
   panel.innerHTML=prefix+'<h2 tabindex="-1">'+title+'</h2>'+guidance+'<form data-practice-order><label>'+(opening?'Initial units per style':'Maximum extra units per style')+'<input name="units" type="number" inputmode="numeric" min="0" max="200" step="1" required></label><button>'+(opening?'Place order and see early sales':'Replenish and see results')+'</button></form>';
   const form=panel.querySelector('form');
   form.elements.units.value=state.draft??(opening?attempt.order.quantity:attempt.order.cap);
   form.elements.units.oninput=()=>save({...state,draft:form.elements.units.value});
   form.onsubmit=event=>{
    event.preventDefault();
    if(!panel.isConnected || !form.reportValidity())return;
    const units=form.elements.units.valueAsNumber;
    const next=opening?submitPracticePlan(config,attempt,units):submitPracticeResponse(attempt,units);
    save({round,attempt:next,draft:null});
    draw(true);
   };
  }
  if(focus)panel.querySelector('h2').focus();
 }
 draw();
}
