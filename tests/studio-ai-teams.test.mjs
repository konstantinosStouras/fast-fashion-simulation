import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {showAiSettingsPanel} from '../studio-ai.js';
import {showTeamsPanel} from '../studio-teams.js';

async function waitFor(check) {
 for (let i=0; i<180; i++) {
  if (check()) return;
  await new Promise(resolve => setTimeout(resolve,10));
 }
 assert.fail('Timed out waiting for the instructor interface');
}

test('admin saves a provider and model, restores the classroom draft and adjusts phases before start', async t => {
 const dom = new JSDOM(readFileSync('index.html','utf8'), {url:'http://localhost:8080/?demo&studio=1',pretendToBeVisual:true});
 const w=dom.window;
 for (const key of ['window','document','location','localStorage','sessionStorage','FormData']) globalThis[key]=w[key];
 globalThis.addEventListener=w.addEventListener.bind(w);
 const $=selector=>w.document.querySelector(selector);
 const backend=await import('../backend-demo.js');
 t.after(async()=>{await backend.logout();w.close();});
 await backend.loginGoogle();
 await import('../main.js?ai-studio-test');
 await waitFor(()=>$('#city-suggestions button'));
 const assertHeaderNavigation=active=>{
  assert.equal(w.document.querySelectorAll('.studio-nav').length,1);
  assert.deepEqual([...w.document.querySelectorAll('header > .studio-nav button')].map(button=>button.textContent),['Admin','AI settings','Users & Teams','Administrators']);
  assert.equal($('header > .studio-nav [aria-current="page"]')?.id,active);
  assert.equal($('#app .studio-nav'),null);
 };
 assertHeaderNavigation('studio-admin');
 assert.equal($('#join-as-student'),null);
 assert.equal($('#grant'),null);
 assert.equal($('#verified-accounts'),null);
 assert.doesNotMatch($('#app').textContent,/platform owner studio|set the conditions|let intuition play|join as a student/i);
 const draft=$('#create');
 draft.elements.name.value='Head-to-head classroom';
 draft.elements.code.value='KYOTO';
 draft.elements.mode.value='team';
 draft.elements.aiPractice.click();
 draft.requestSubmit();
 await waitFor(()=>$('#notice').textContent.includes('Choose a model'));
 $('#studio-ai').click();
 await waitFor(()=>$('#ai-key-form'));
 assertHeaderNavigation('studio-ai');
 assert.equal(new URL(w.location.href).searchParams.get('studio'),'ai');
 assert.equal($('#ai-key-form input[type=password]'),null);
 const provider=$('#ai-key-form').elements.provider;
 provider.value='anthropic';provider.dispatchEvent(new w.Event('change'));
 $('#ai-key-form').requestSubmit();
 await waitFor(()=>$('#ai-model-form').elements.aiModel.options.length===2);
 $('#ai-model-form').elements.aiModel.selectedIndex=1;
 $('#ai-model-form').requestSubmit();
 await waitFor(()=>$('#ai-settings-status').textContent==='Simulation model saved.');
 $('#studio-administrators').click();
 await waitFor(()=>$('#grant'));
 assertHeaderNavigation('studio-administrators');
 assert.equal(new URL(w.location.href).searchParams.get('studio'),'administrators');
 $('#studio-admin').click();
 await waitFor(()=>$('#create'));
 const form=$('#create');
 assert.equal(form.elements.code.value,'KYOTO');
 assert.equal(form.elements.name.value,'Head-to-head classroom');
 assert.ok(form.elements.aiPractice.checked);
 assert.equal(form.elements.aiMain.checked,false);
 form.requestSubmit();
 await waitFor(()=>$('[data-session="KYOTO"]'));
 const stored=()=>JSON.parse(w.localStorage.getItem('ff:demo:v1')).sessions.KYOTO;
 assert.deepEqual(stored().aiOpponent,{provider:'anthropic',model:'anthropic-demo-fast',practice:true,main:false});
 $('[data-session="KYOTO"]').click();
 await waitFor(()=>$('#session-ai-editor'));
 assertHeaderNavigation(undefined);
 $('#session-ai-editor').open=true;
 await waitFor(()=>!$('#session-ai-form button').disabled);
 $('#session-ai-form').elements.aiPractice.click();
 $('#session-ai-form').elements.aiMain.click();
 $('#session-ai-form').requestSubmit();
 await waitFor(()=>stored().aiOpponent.main);
 assert.deepEqual(stored().aiOpponent,{provider:'anthropic',model:'anthropic-demo-fast',practice:false,main:true});
 assert.ok(!JSON.stringify(w.localStorage).includes('demo-fixture'));
 $('#studio-teams').click();
 await waitFor(()=>$('#team-user-search'));
 assertHeaderNavigation('studio-teams');
 $('#studio-admin').click();
 await waitFor(()=>$('#create'));
 assertHeaderNavigation('studio-admin');
 await backend.logout();
 await waitFor(()=>$('#open-login'));
 assert.equal($('.studio-nav'),null);
});

test('live settings masks a new provider key and selects a model from multiple connected providers', async t => {
 const dom=new JSDOM('<main></main>'), panel=dom.window.document.querySelector('main');
 t.after(()=>dom.window.close());
 const $=selector=>panel.querySelector(selector);
 const settings={provider:'openai',model:'model-a',providers:[
  {id:'openai',label:'OpenAI',hasKey:true,models:[{id:'model-a',label:'Model A'}]},
  {id:'google',label:'Google',hasKey:false,models:[]}
 ]};
 const requests=[];
 const api={
  getAiSettings:async()=>structuredClone(settings),
  saveAiSettings:async request=>{
   requests.push(request);
   if (request.apiKey) {
    settings.providers[1].hasKey=true;
    settings.providers[1].models=[{id:'model-b',label:'Model B'},{id:'model-c',label:'Model C'}];
   }
   if (request.model) Object.assign(settings,{provider:request.provider,model:request.model});
   return structuredClone(settings);
  }
 };
 await showAiSettingsPanel(panel,api,{demo:false,confirmRemoval:async()=>true});
 const provider=$('#ai-key-form').elements.provider;
 provider.value='google';provider.dispatchEvent(new dom.window.Event('change'));
 const key=$('#ai-key-form').elements.apiKey;
 assert.equal(key.type,'password');
 key.value='synthetic-key';$('#ai-key-form').requestSubmit();
 await waitFor(()=>$('#ai-model-form select').options.length===3);
 assert.equal($('#ai-key-form').elements.apiKey.value,'');
 assert.equal(panel.innerHTML.includes('synthetic-key'),false);
 $('#ai-model-form select').value='model-c';
 $('#ai-model-form').requestSubmit();
 await waitFor(()=>$('#ai-current-model').textContent.includes('Google · Model C'));
 assert.deepEqual(requests,[{provider:'google',apiKey:'synthetic-key'},{provider:'google',model:'model-c'}]);
});

test('team editor searches across server pages and saves only changed assignments for the chosen classroom', async t => {
 const dom=new JSDOM('<main></main>');
 const w=dom.window, panel=w.document.querySelector('main'), $=selector=>panel.querySelector(selector);
 t.after(()=>w.close());
 const users=Array.from({length:30},(_,i)=>({uid:'id'+i,name:'Person '+i,email:'student'+i+'@example.test'}));
 const room=(code,mode='team',status='lobby')=>({code,name:'Class '+code,mode,status,assignments:{id0:'id0'},teamNames:{id0:'Team 3'}});
 let saved, tokens=[];
 const api={
  listSessions:async()=>[room('ROME'),room('MILAN'),room('SOLO','individual'),room('PAST','team','closed')],
  listTeamUsers:async token=>{
   tokens.push(token);
   return token ? {users:users.slice(20),nextPageToken:null} : {users:users.slice(0,20),nextPageToken:'cursor'};
  },
  saveTeamComposition:async(code,changes)=>{saved={code,changes};return {teamComposition:{id27:'2',id14:'4',id10:'9'}};}
 };
 await showTeamsPanel(panel,api,true,'ROME');
 assert.deepEqual(tokens,[undefined,'cursor']);
 assert.deepEqual([...$('#team-classroom').options].map(option=>option.value),['','ROME','MILAN']);
 assert.equal($('[data-team-user="id0"]').value,'3');
 const assign=(uid,value)=>{const select=$('[data-team-user="'+uid+'"]');select.value=value;select.dispatchEvent(new w.Event('change',{bubbles:true}));};
 assign('id0','');
 $('#team-directory-next').click();assign('id27','2');
 const search=$('#team-user-search');
 search.value='student14@example.test';search.dispatchEvent(new w.Event('input'));
 assert.equal(panel.querySelectorAll('tbody tr').length,1);
 assign('id14','4');
 const classroom=$('#team-classroom');
 classroom.value='MILAN';classroom.dispatchEvent(new w.Event('change'));
 assert.equal($('#save-team-directory').disabled,true);
 classroom.value='ROME';classroom.dispatchEvent(new w.Event('change'));
 assert.equal($('[data-team-user="id14"]').value,'4');
 $('#save-team-directory').click();
 await waitFor(()=>$('#team-directory-status').textContent.includes('saved'));
 assert.deepEqual(saved,{code:'ROME',changes:{id0:null,id27:'2',id14:'4'}});
 assert.equal($('#save-team-directory').disabled,true);
 search.value='student10@example.test';search.dispatchEvent(new w.Event('input'));
 assert.equal($('[data-team-user="id10"]').value,'9');
});

test('directory searches by student ID, shows live matchups and loads scoped classroom details only on demand', async t => {
 const dom=new JSDOM('<main></main>'), w=dom.window, panel=w.document.querySelector('main');
 t.after(()=>w.close());
 const $=selector=>panel.querySelector(selector);
 const people=[
  {uid:'one',name:'A. First',email:'a@demo.test',studentId:'S-210',registeredAt:'2026-05-10T12:00:00Z',lastSignInAt:'2026-05-11T10:00:00Z'},
  {uid:'two',name:'B. Second',email:'b@demo.test',studentId:'S-211'}
 ];
 const live={code:'LIVE',name:'Trading class',mode:'team',status:'running',startedAt:Date.now()-1000,assignments:{one:'one',two:'two'},teamNames:{one:'Amber',two:'Blue'},teamOpponents:{one:'two',two:'one'},aiOpponent:{provider:'openai',model:'example',main:true}};
 const pending={code:'WAIT',name:'Next class',mode:'team',status:'lobby',teamComposition:{one:'4'}};
 let calls=0, opened, fail=true;
 const api={
  listSessions:async all=>{assert.equal(all,false);return [live,pending];},
  listTeamUsers:async()=>({users:people}),
  getUserClassrooms:async uid=>{
   assert.equal(uid,'one');calls++;
   if(fail){fail=false;throw Error('offline');}
   return {sessions:[
    {code:'LIVE',name:'Trading class',mode:'team',status:'running',team:'Amber',joined:true,currentPhase:'practice',activeOpponent:'Blue',practiceOpponent:'Blue',mainOpponent:'AI opponent · OpenAI · example'},
    {code:'WAIT',name:'Next class',mode:'team',status:'lobby',team:'Team 4',joined:false,practiceOpponent:'Awaiting draw',mainOpponent:'Awaiting draw'},
    {code:'PAST',name:'Previous class',mode:'individual',status:'completed',joined:true,practiceOpponent:'Individual play',mainOpponent:'Individual play'}
   ]};
  }
 };
 await showTeamsPanel(panel,api,false,null,code=>{opened=code;});
 assert.equal($('#directory-title').textContent,'Registered users');
 assert.equal($('#directory-count').textContent,'2 registered users');assert.equal(calls,0);
 assert.match($('.directory-highlight').textContent,/Trading class.*In progress.*Amber.*Practice.*Blue/);
 $('#team-user-search').value='s-210';$('#team-user-search').dispatchEvent(new w.Event('input'));
 assert.equal(panel.querySelectorAll('.user-entry').length,1);assert.match($('.user-entry').textContent,/A. First.*Student ID · S-210/s);
 $('[data-user-details="one"]').click();await waitFor(()=>$('[data-retry-history="one"]'));
 $('[data-retry-history="one"]').click();await waitFor(()=>panel.querySelectorAll('.user-classroom').length===3);
 assert.match($('.user-details-row').textContent,/Practice opponentBlueMain phase opponentAI opponent · OpenAI · example/);
 assert.match($('.user-details-row').textContent,/Assigned · waiting to join/);assert.match($('.user-details-row').textContent,/Previous class.*Completed/s);
 $('[data-open-classroom="PAST"]').click();assert.equal(opened,'PAST');
 $('[data-user-details="one"]').click();assert.equal($('.user-details-row'),null);
 people.push({uid:'three',name:'C. Third',email:'c@demo.test'});
 $('#directory-refresh').click();await waitFor(()=>$('#directory-count').textContent==='3 registered users');
 assert.equal(calls,2);
});

test('collapsed rows include active individual and solo sessions without reading past or solo rosters', async t => {
 const dom=new JSDOM('<main></main>'), panel=dom.window.document.querySelector('main');
 t.after(()=>dom.window.close());
 const running=(code,mode='individual',startedAt=Date.now()-200000)=>({code,name:code,mode,status:'running',startedAt});
 const reads=[];
 await showTeamsPanel(panel,{
  listTeamUsers:async()=>({users:[{uid:'one',name:'First'},{uid:'two',name:'Second'}]}),
  listSessions:async()=>[running('IND'),{...running('SELF','solo'),owner:'two'},running('OLD','individual',Date.now()-1081000),running('UNAVAILABLE')],
  readParticipants:async code=>{reads.push(code);if(code==='UNAVAILABLE')throw Error('offline');return [{uid:'one'}];}
 },true);
 assert.deepEqual(reads.sort(),['IND','UNAVAILABLE']);
 const [first,second]=panel.querySelectorAll('.user-entry');
 assert.match(first.textContent,/IND.*In progress.*Main phase.*Individual play/s);
 assert.match(second.textContent,/SELF.*In progress.*Main phase.*Individual play/s);
 assert.doesNotMatch(panel.textContent,/OLD|UNAVAILABLE/);
 assert.ok(second.querySelector('[data-user-details]'));
});
