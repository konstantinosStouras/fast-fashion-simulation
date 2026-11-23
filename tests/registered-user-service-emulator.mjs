import {after, test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {createRequire} from 'node:module';
import {registeredUserService} from '../functions/registered-users.js';
import {planRegisteredUserRemoval, protectedRegisteredUser} from '../functions/registered-user-classroom.js';
import {teamRound} from '../market.js';
import {DEFAULT_CONFIG} from '../model.js';

for (const key of ['FIRESTORE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST'])
  assert.match(process.env[key] || '', /^(localhost|127\.0\.0\.1):\d+$/, key + ' must target a local emulator');
const requireServer = createRequire(new URL('../functions/package.json', import.meta.url));
const {initializeApp, deleteApp} = requireServer('firebase-admin/app');
const {getFirestore, Timestamp} = requireServer('firebase-admin/firestore');
const {getAuth} = requireServer('firebase-admin/auth');
const run = randomBytes(4).toString('hex');
const app = initializeApp({projectId: 'demo-fashion-futures-ai'}, 'deletion-test-' + run);
const db = getFirestore(app), auth = getAuth(app);
const remove = registeredUserService({db, auth});
const owner = {uid: 'owner-' + run, token: {email: 'kstouras@gmail.com', email_verified: true}};
const call = (uids, account = owner) => ({auth: account, data: {uids}});
after(() => deleteApp(app));

test('only a verified owner can issue a bounded deletion, and access accounts are protected', async () => {
  await assert.rejects(remove(call(['any'], null)), {code: 'permission-denied'});
  await assert.rejects(remove(call(['any'], {uid:'teacher', token:{email:'teacher@example.test', email_verified:true}})), {code:'permission-denied'});
  await assert.rejects(remove(call(['any'], {...owner, token:{...owner.token, email_verified:false}})), {code:'permission-denied'});
  for (const ids of [[], ['a', 'a'], ['ref/escape'], Array.from({length:11}, (_,i)=>String(i))])
    await assert.rejects(remove(call(ids)), {code:'invalid-argument'});
  assert(protectedRegisteredUser({uid:'other', email:'KSTOURAS+ffo-admin@GMAIL.COM'},owner.uid));
  const mock = registeredUserService({db, auth:{getUsers:async () => ({users:[
    {uid:'alias', email:'kstouras+ffo-admin@gmail.com'}, {uid:'identity', email:'kstouras@gmail.com'}]})}});
  const result = await mock(call([owner.uid, 'alias', 'identity']));
  assert.deepEqual(result.deletedUids, []);
  assert.deepEqual(new Set(result.protectedUids),new Set([owner.uid,'alias','identity']));
});

test('a confirmed batch erases account records and preserves other teams, history and default rosters', async () => {
  const captain = 'a-' + run, teammate = 'z-' + run, rival = 'm-' + run, preassigned = 'p-' + run;
  const email = captain + '@example.test';
  await auth.createUser({uid:captain, email});
  await auth.createUser({uid:preassigned, email:preassigned + '@example.test'});
  const active = db.collection('sessions').doc('ACT' + run), closed = db.collection('sessions').doc('END' + run);
  const lobby = db.collection('sessions').doc('LOB' + run), solo = db.collection('sessions').doc('ONE' + run);
  const original = {owner:captain, mode:'team', status:'running', startedAt:Timestamp.now(), seed:25, config:DEFAULT_CONFIG,
    teamComposition:{[captain]:'1',[teammate]:'1',[rival]:'2'}, assignments:{[captain]:captain,[teammate]:captain,[rival]:rival},
    teamNames:{[captain]:'Team 1',[rival]:'Team 2'}, teamOpponents:{[captain]:rival,[rival]:captain}};
  const joined = {name:'Test player', email, joinedAt:Timestamp.now()};
  const order = {variety:4, quantity:85, cap:0};
  const rivalOrder = {...order, quantity:30};
  const profile = db.collection('profiles').doc(captain);
  const defaults = db.collection('studioTeamDefaults').doc(owner.uid);
  const grant = db.collection('instructors').doc(email), verified = db.collection('verifiedAccounts').doc(captain);
  const keys = db.collection('privateAiSettings').doc(captain);
  await Promise.all([active.set(original), closed.set({...original, status:'closed'}),
    lobby.set({...original,status:'lobby', rosterVersion:1,teamComposition:{...original.teamComposition,[preassigned]:'2'}}),
    solo.set({owner:captain,mode:'solo',status:'closed'}), profile.set({firstName:'Test'}),
    profile.collection('sessions').doc(active.id).set({joined:true}), grant.set({granted:true}), verified.set({email}), keys.set({provider:'google'}),
    defaults.set({teamComposition:{[captain]:'1',[preassigned]:'2',[teammate]:'1'}}),
    db.collection('studioTeamDefaults').doc(captain).set({teamComposition:{[rival]:'2'}})]);
  for (const room of [active,closed,lobby,solo]) {
    const person = room.collection('participants').doc(captain);
    await Promise.all([person.set(joined), person.collection('orders').doc('1').set(order),
      person.collection('aiRounds').doc('1').set({order}),person.collection('aiOpponents').doc('main').set({status:'ready'})]);
    if (room !== solo) await Promise.all([teammate,rival].map(uid=>room.collection('participants').doc(uid).set({name:uid,joinedAt:Timestamp.now()})));
  }
  const result = await remove(call([captain,preassigned,owner.uid]));
  assert.deepEqual(new Set(result.deletedUids),new Set([captain,preassigned]));
  assert.deepEqual(result.protectedUids,[owner.uid]);
  for (const uid of [captain,preassigned]) {
    await assert.rejects(auth.getUser(uid),{code:'auth/user-not-found'});
    assert((await db.collection('deletedAccounts').doc(uid).get()).exists);
  }
  for (const ref of [profile,profile.collection('sessions').doc(active.id),verified,keys,grant,solo,
    solo.collection('participants').doc(captain).collection('orders').doc('1'),db.collection('studioTeamDefaults').doc(captain)])
    assert.equal((await ref.get()).exists,false,ref.path);
  assert.deepEqual((await defaults.get()).get('teamComposition'),{[teammate]:'1'});
  const waiting = (await lobby.get()).data();
  assert.equal(waiting.owner,owner.uid);
  assert.equal(waiting.rosterVersion,2);
  assert.deepEqual(waiting.assignments,{[teammate]:teammate,[rival]:rival});
  assert.deepEqual(waiting.teamComposition,{[teammate]:'1',[rival]:'2'});
  const current = (await active.get()).data();
  assert.deepEqual(current.teamOpponents,{[teammate]:rival,[rival]:teammate});
  const promoted = active.collection('participants').doc(teammate);
  assert.deepEqual((await promoted.collection('orders').doc('1').get()).data(),order);
  assert.equal((await promoted.collection('aiOpponents').doc('main').get()).get('status'),'ready');
  assert.equal((await active.collection('participants').doc(captain).get()).exists,false);
  const previousResults = teamRound(original,1,{[captain]:{1:order},[rival]:{1:rivalOrder}});
  const newResults = teamRound(current,1,{[teammate]:{1:order},[rival]:{1:rivalOrder}});
  assert.deepEqual(previousResults.teams[rival],newResults.teams[rival]);
  assert.deepEqual(previousResults.teams[captain],newResults.teams[teammate]);
  const anonymous = closed.collection('participants').doc(captain);
  assert.equal((await anonymous.get()).get('name'),'Deleted user');
  assert.equal((await anonymous.get()).get('email'),'');
  assert.deepEqual((await anonymous.collection('orders').doc('1').get()).data(),order);
  assert.deepEqual(await remove(call([captain])),{deletedUids:[captain],protectedUids:[]});
});

test('deleting the last members of a running team keeps its rival and saved decision holder', () => {
  const session = {status:'running', mode:'team',startedAt:Date.now(),assignments:{a:'a',b:'a',c:'c'},
    teamNames:{a:'Team 1',c:'Team 2'},teamOpponents:{a:'c',c:'a'}};
  const plan=planRegisteredUserRemoval(session,'a','owner',new Set(['a','b']));
  assert.equal(plan.keepTeamResult,true);
  assert.equal(plan.replacementCaptain,null);
  assert.equal(plan.updates.teamOpponents,undefined);
});
