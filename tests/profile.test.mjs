import test from 'node:test';
import assert from 'node:assert/strict';
import {platformHandoff,profileFields,historyStats,PLATFORM_FIELDS} from '../profile.js';
import {DEFAULT_CONFIG,DEFAULT_ORDER,resultFor} from '../model.js';
import {safeStorage,friendlyAuthError,setBusy,revealInvalidField} from '../ui.js';
import {JSDOM} from 'jsdom';
const now=1800000,user={email:'student@example.test',emailVerified:true};
const handoff={v:1,sim:'ffo',ts:now-100,profile:Object.fromEntries(PLATFORM_FIELDS.map(k=>[k,k==='email'?user.email:'Example']))};
const storage=h=>({getItem:()=>JSON.stringify(h)});
test('portal import retains every registration field but never privileges',()=>{
 const h=structuredClone(handoff);Object.assign(h.profile,{approved:true,role:'admin',completed:{ffo:true},password:'secret'});
 assert.deepEqual(Object.keys(platformHandoff(storage(h),user,now)).sort(),[...PLATFORM_FIELDS].sort());
});
test('portal data is isolated by verified account, destination and fresh handoff',()=>{
 for(const h of [{...handoff,sim:'another-simulation'},{...handoff,ts:now+1},{...handoff,ts:now-21600001},{...handoff,profile:{email:'other@example.test'}}])assert.equal(platformHandoff(storage(h),user,now),null);
 assert.equal(platformHandoff(storage(handoff),{...user,emailVerified:false},now),null);
 assert.equal(platformHandoff({getItem:()=>'{broken'},user,now),null);
 assert.equal(platformHandoff({getItem:()=>{throw Error('Blocked')}},user,now),null);
});
test('profile validation trims details and rejects whitespace-only names',()=>{
 assert.deepEqual(profileFields(new Map([['firstName',' Ada '],['lastName',' Lovelace '],['universityId',' 123 ']])),{firstName:'Ada',lastName:'Lovelace',universityId:'123'});
 assert.throws(()=>profileFields(new Map([['firstName',' ']])),/complete/);
});
test('history excludes practice and freezes early-closed results',()=>{
 const base={seed:42,config:DEFAULT_CONFIG,orders:{0:{...DEFAULT_ORDER,quantity:200}},createdAt:{toMillis:()=>0},startedAt:{toMillis:()=>0}};
 const stats=historyStats([{...base,code:'one',status:'running'},{...base,code:'two',status:'closed',closedAt:{toMillis:()=>500000}},{...base,code:'three',startedAt:null,status:'lobby'}],1080000);
 assert.equal(stats.finished,1);assert.equal(stats.seasons,4);assert.equal(stats.rows[1].rounds.length,1);
 assert.equal(stats.profit,[1,2,3,1].reduce((sum,i)=>sum+resultFor(42,i,DEFAULT_ORDER,DEFAULT_CONFIG).profit,0));
});
test('blocked storage is safe and busy controls restore their original state',()=>{
 const s=safeStorage(()=>{throw Error('storage blocked')});assert.equal(s.getItem('x'),null);s.setItem('x','y');s.removeItem('x');
 const dom=new JSDOM('<main><button>A</button><button disabled>B</button><details><input required></details></main>');
 const root=dom.window.document.querySelector('main'),restore=setBusy(root,true);assert.ok([...root.querySelectorAll('button')].every(b=>b.disabled));restore();assert.equal(root.querySelector('button').disabled,false);assert.equal(root.querySelectorAll('button')[1].disabled,true);
 revealInvalidField({target:root.querySelector('input')});assert.equal(root.querySelector('details').open,true);dom.window.close();
 assert.match(friendlyAuthError({code:'auth/popup-blocked'}),/Allow pop-ups/);assert.match(friendlyAuthError({code:'auth/requires-recent-login'}),/sign in again/);
});
