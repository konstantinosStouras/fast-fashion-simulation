// Run with the Auth and Firestore emulators and the functions dependencies installed.
import {after, before, test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {createRequire} from 'node:module';
import {aiService} from '../functions/service.js';
import {DEFAULT_CONFIG} from '../model.js';

const requireServer = createRequire(new URL('../functions/package.json', import.meta.url));
const {initializeApp, deleteApp} = requireServer('firebase-admin/app');
const {getFirestore, Timestamp} = requireServer('firebase-admin/firestore');
const {getAuth} = requireServer('firebase-admin/auth');
for (const key of ['FIRESTORE_EMULATOR_HOST','FIREBASE_AUTH_EMULATOR_HOST']) {
  assert.match(process.env[key] || '', /^(localhost|127\.0\.0\.1):\d+$/, key + ' must point to a local emulator');
}
const run = randomBytes(4).toString('hex');
const app = initializeApp({projectId:'demo-fashion-futures-ai'}, 'ai-test-' + run);
const db = getFirestore(app), auth = getAuth(app);
const master = randomBytes(32).toString('base64');
const admin = {uid:'instructor-' + run, token:{email:'teacher-' + run + '@example.test', email_verified:true}};
const other = {uid:'other-' + run, token:{email:'other-' + run + '@example.test', email_verified:true}};
const call = (account, data) => ({auth:account, data});
const key = 'fixture-provider-credential';
const models = [{id:'model-one',label:'One'}, {id:'model-two',label:'Two'}];
const options = {db, auth, encryptionSecret:() => master, discover:async () => models};
const plans = (phase, quantity = 42) => Object.fromEntries((phase === 'practice' ? [0] : [1,2,3]).map(i => [i, {quantity,variety:4,cap:i === 1 ? 0 : 16}]));
let sequence = 0;
async function classroom(mode = 'individual') {
  const code = 'AI' + run.toUpperCase() + (++sequence);
  const ref = db.collection('sessions').doc(code);
  await ref.set({owner:admin.uid, createdAt:Timestamp.now(), status:'lobby', mode, config:DEFAULT_CONFIG, seed:42,
    aiOpponent:{provider:'openai',model:'model-one',practice:true,main:true}, assignments:{},teamNames:{}});
  return ref;
}
before(async () => {
  for (const account of [admin,other]) await db.collection('instructors').doc(account.token.email).set({createdAt:Timestamp.now()});
  await aiService(options).saveAiSettings(call(admin,{provider:'openai',apiKey:key}));
});
after(async () => { await deleteApp(app); });

test('regional studio reads use the existing instructor permissions and public response shapes',async()=>{
 const api=aiService(options);
 for(const [screen,read] of [['ai',api.getAiSettings],['teams',api.listTeamUsers]]){
  const request=call(admin,{screen});
  assert.deepEqual(await api.readStudioPanel(request),await read(request));
  await assert.rejects(api.readStudioPanel(call({uid:'student',token:{email:'student@example.test',email_verified:true}},{screen})),{code:'permission-denied'});
 }
 assert.throws(()=>api.readStudioPanel(call(admin,{screen:'other'})),{code:'invalid-argument'});
});

test('a full range of orphan profiles cannot hide or add registered accounts',async t=>{
 const uid='zy-directory-'+run, orphan='00-orphan-'+run, profiles=db.collection('profiles');
 const refs=Array.from({length:100},(_,i)=>profiles.doc(orphan+'-'+i));
 const batch=db.batch();
 for(const ref of refs)batch.set(ref,{firstName:'Orphan'});
 batch.set(profiles.doc(uid),{firstName:'Registered',lastName:'User',universityId:'TEST-1'});
 await batch.commit();await auth.createUser({uid});
 t.after(async()=>{const cleanup=db.batch();for(const ref of [...refs,profiles.doc(uid)])cleanup.delete(ref);await cleanup.commit();await auth.deleteUser(uid);});
 const page=await aiService(options).readStudioPanel(call(admin,{screen:'teams'}));
 assert.ok(!page.users.some(user=>user.uid.startsWith(orphan)));
 const found=page.users.find(user=>user.uid===uid);
 assert.equal(found?.name,'Registered User');assert.equal(found.studentId,'TEST-1');
});

test('keys and models remain private to each verified instructor', async () => {
  const api = aiService(options);
  const result = await api.getAiSettings(call(admin,{}));
  assert.equal(result.model,'model-one');
  assert(!JSON.stringify(result).includes(key));
  assert(!JSON.stringify((await db.collection('privateAiSettings').doc(admin.uid).get()).data()).includes(key));
  assert.equal((await api.getAiSettings(call(other,{}))).model,null);
  await assert.rejects(api.getAiSettings(call({...admin,token:{...admin.token,email_verified:false}},{})),{code:'permission-denied'});
  await assert.rejects(api.saveAiSettings(call(admin,{provider:'openai',model:'unlisted-model'})),{code:'invalid-argument'});
});

test('instructors can assign default teams before creating a classroom', async () => {
  const api = aiService(options), first='default-first-'+run, second='default-second-'+run;
  for (const uid of [first,second]) await auth.createUser({uid,email:uid+'@example.test'});
  const save = (actor,changes) => api.saveDefaultTeamComposition(call(actor,{changes}));
  const blank = {uid:first,token:{email:first+'@example.test',email_verified:true}};
  await assert.rejects(save(blank,{[first]:'8'}),{code:'permission-denied'});
  await assert.rejects(save(admin,{['missing-'+run]:'5'}),{code:'failed-precondition'});
  await Promise.all([save(admin,{[first]:'1'}),save(admin,{[second]:'1'})]);
  assert.deepEqual((await db.doc('studioTeamDefaults/'+admin.uid).get()).data().teamComposition,{[first]:'1',[second]:'1'});
  assert.deepEqual((await save(other,{[first]:'2'})).teamComposition,{[first]:'2'});
  await db.doc('deletedAccounts/'+first).set({deletedAt:Timestamp.now()});
  await assert.rejects(save(admin,{[first]:'3'}),{code:'failed-precondition'});
  assert.deepEqual((await save(admin,{[first]:null})).teamComposition,{[second]:'1'});
});

test('only one in-flight request owns a competitor and all enabled phases must be ready before start', async () => {
  const ref = await classroom();
  for (const uid of ['p1','p2']) await ref.collection('participants').doc(uid).set({joinedAt:Timestamp.now()});
  let release, entered;
  const gate = new Promise(resolve => { release = resolve; });
  const firstCall = new Promise(resolve => { entered = resolve; });
  let calls = 0;
  const api = aiService({...options,generate: async (p,m,k,phase) => {
    assert.equal(k, key); assert.equal(p, 'openai'); assert.equal(m, 'model-one');
    const quantity = ++calls; entered(); await gate; return plans(phase, quantity);
  }});
  const prep = (competitor, phase) => call(admin, {code:ref.id, competitor, phase});
  await assert.rejects(api.prepareAiOpponent(call(other, prep('p1','practice').data)), {code:'permission-denied'});
  const first = api.prepareAiOpponent(prep('p1','practice'));
  await firstCall;
  await assert.rejects(api.prepareAiOpponent(prep('p1','practice')), {code:'aborted'});
  release(); await first;
  assert.deepEqual((await api.prepareAiOpponent(prep('p1','practice'))).orders, plans('practice',1));
  await assert.rejects(api.startAiSession(call(admin,{code:ref.id})), {code:'failed-precondition'});
  await api.prepareAiOpponent(prep('p2','practice'));
  await api.prepareAiOpponent(prep('p1','main'));
  await api.prepareAiOpponent(prep('p2','main'));
  assert.equal(calls, 4);
  for (const [uid,q] of [['p1',1],['p2',2]]) {
    const round = (await ref.collection('participants').doc(uid).collection('aiRounds').doc('0').get()).data();
    assert.equal(round.order.quantity, q);
  }
  await api.startAiSession(call(admin,{code:ref.id}));
  const s = (await ref.get()).data();
  assert.equal(s.status,'running'); assert(s.startedAt instanceof Timestamp); assert.equal(s.phaseOffset,0);
  assert.deepEqual(await api.startAiSession(call(admin,{code:ref.id})), {started:true});
});

test('changed or closed classroom discards an in-flight provider response', async () => {
  const ref = await classroom();
  const competitor = 'captain';
  const participant = ref.collection('participants').doc(competitor);
  await participant.set({joinedAt:Timestamp.now()});
  const request = call(admin,{code:ref.id,competitor,phase:'practice'});
  const changed = aiService({...options,generate: async () => {
    await ref.update({'aiOpponent.model':'model-two'}); return plans('practice');
  }});
  await assert.rejects(changed.prepareAiOpponent(request), {code:'aborted'});
  assert(!(await participant.collection('aiRounds').doc('0').get()).exists);
  assert(!(await participant.collection('aiOpponents').doc('practice').get()).exists);
  const closed = aiService({...options,generate: async () => {
    await ref.update({status:'closed'}); return plans('practice');
  }});
  await assert.rejects(closed.prepareAiOpponent(request), {code:'failed-precondition'});
  assert(!(await participant.collection('aiOpponents').doc('practice').get()).exists);
});

test('directory and team editing use registered accounts, joined roster and ownership', async () => {
  const ref = await classroom('team');
  const students = [0,1,2].map(index => 'team-user-' + run + '-' + index);
  for (const uid of students) await auth.createUser({uid,email:uid+'@example.test'});
  await db.collection('profiles').doc(students[0]).set({firstName:'Student',lastName:'One',universityId:'private-id'});
  const api = aiService({...options,generate:async (p,m,k,phase) => plans(phase)});
  const studentAuth = {uid:students[0],token:{email:students[0]+'@example.test',email_verified:true}};
  await assert.rejects(api.listTeamUsers(call(studentAuth,{})),{code:'permission-denied'});
  let pageToken, person;
  do {
    const page = await api.listTeamUsers(call(admin, {pageToken}));
    person = page.users.find(user => user.uid === students[0]);
    pageToken = page.nextPageToken;
  } while (!person && pageToken);
  const metadata = (await auth.getUser(students[0])).metadata;
  assert.deepEqual(person,{uid:students[0], name:'Student One', email:students[0]+'@example.test', studentId:'private-id',
    playedSessionCodes:[],deletionProtected:false,
    registeredAt:new Date(metadata.creationTime).toISOString(),
    lastSignInAt:metadata.lastSignInTime ? new Date(metadata.lastSignInTime).toISOString() : null});
  const changes = {[students[0]]:'2',[students[1]]:'2',[students[2]]:'7'};
  await assert.rejects(api.saveTeamComposition(call(other,{code:ref.id,changes})),{code:'permission-denied'});
  await assert.rejects(api.saveTeamComposition(call(admin,{code:ref.id,changes:{['absent-' + run]:'1'}})),{code:'failed-precondition'});
  await ref.collection('participants').doc(students[1]).set({joinedAt:Timestamp.now()});
  const result = await api.saveTeamComposition(call(admin,{code:ref.id,changes}));
  assert.deepEqual(result.assignments,{[students[1]]:students[1]});
  for (const uid of [students[0],students[2]]) await ref.collection('participants').doc(uid).set({joinedAt:Timestamp.now()});
  await assert.rejects(api.prepareAiOpponent(call(admin,{code:ref.id,competitor:students[1],phase:'main'})),{code:'failed-precondition'});
  await assert.rejects(api.startAiSession(call(admin,{code:ref.id})),{code:'failed-precondition'});
  assert.equal((await ref.get()).data().status,'lobby');
});

test('verified concurrent team joins fill the selected size once and retain named teams', async () => {
  const ref = await classroom('team'), api = aiService(options);
  await ref.update({teamSize:2,teamPractice:true,rosterVersion:0,teamNames:{captain:'Studio North'},assignments:{captain:'captain'}});
  await ref.collection('participants').doc('captain').set({joinedAt:Timestamp.now()});
  const join = (uid, verified=true) => api.joinTeamClassroom(call(
    {uid,token:{email:uid+'@example.test',email_verified:verified}}, {code:ref.id,name:'Student '+uid}));
  await assert.rejects(join('stranger',false),{code:'permission-denied'});
  const removed = 'revoked' + run;
  await db.doc('deletedAccounts/' + removed).set({revoked:true});
  await assert.rejects(join(removed),{code:'permission-denied'});
  const ids=['one','two','three','four','five','six'].map(name=>name+run);
  await Promise.all([...ids,ids[0]].map(uid=>join(uid)));
  const s=(await ref.get()).data();
  assert.equal(s.teamNames.captain,'Studio North');
  assert.equal(s.assignments.captain,'captain');
  const teamSizes=Object.keys(s.teamNames).map(captain=>Object.values(s.assignments).filter(uid=>uid===captain).length);
  assert.deepEqual(teamSizes.sort(),[1,2,2,2]);
  assert.equal(s.rosterVersion,6);
  for(const uid of ids){
    assert(await ref.collection('participants').doc(uid).get().then(d=>d.exists));
    assert.deepEqual((await db.doc('profiles/'+uid+'/sessions/'+ref.id).get()).data(),{joined:true});
  }
  await ref.update({status:'running',phaseOffset:180,startedAt:Timestamp.now()});
  assert.deepEqual(await join(ids[0]),{joined:true});
  await assert.rejects(join('late'+run),{code:'failed-precondition'});
  assert.equal((await ref.get()).data().rosterVersion,6);
});

test('user classroom lookups recover real joins, waiting assignments and scoped phase-specific opponents', async () => {
  const uid = 'history-' + run, email = uid + '@example.test';
  await auth.createUser({uid,email});
  const api = aiService(options);
  const studio = {uid:'platform-owner',token:{email:'kstouras@gmail.com',email_verified:true}};
  const student = {uid,token:{email,email_verified:true}};
  const history = db.collection('profiles').doc(uid).collection('sessions');
  const room = async (data, joined, linked = false, participantUid = uid) => {
    const ref = await classroom(data.mode || 'team');
    await ref.update({name:'Example ' + ref.id, ...data});
    if (joined) await ref.collection('participants').doc(participantUid).set({joinedAt:Timestamp.now(),email});
    if (linked) await history.doc(ref.id).set({joined:true});
    return ref;
  };
  const running = await room({status:'running',phaseOffset:180,startedAt:Timestamp.fromMillis(Date.now()-200000),
    assignments:{[uid]:'captain'},teamNames:{captain:'Team 4',rival:'Team 8'},teamOpponents:{captain:'rival',rival:'captain'},
    aiOpponent:{provider:'openai',model:'model-one',practice:true,main:false}},true,true);
  const planned = await room({teamComposition:{[uid]:'7'}},false);
  const legacy = await room({mode:'individual',status:'running',phaseOffset:960,startedAt:Timestamp.fromMillis(100000)},true);
  const otherRoom = await room({owner:other.uid, mode:'individual', status:'closed',startedAt:Timestamp.fromMillis(1)},true,true);
  const solo = await room({owner:uid, mode:'solo',status:'closed',startedAt:Timestamp.fromMillis(1)},true,true);
  const stale = await room({mode:'individual',status:'closed'},false,true);
  const removed = await room({deletedAt:Timestamp.now()},true,true);
  const absent = await room({teamComposition:{[uid]:'4'},status:'closed'},false);
  const reusedEmail = await room({mode:'individual'},true,false,'previous-uid');
  // Fill the first query page. Put an unlinked participant past its final
  // cursor, then change the user's sign-in email after their classroom join.
  const archive = db.batch();
  for (let i = 0; i < 100; i++) {
    archive.set(db.collection('sessions').doc('B' + run + String(i).padStart(3,'0')), {owner:admin.uid,mode:'individual',status:'closed'});
  }
  const historical = db.collection('sessions').doc('Z' + run);
  archive.set(historical, {owner:admin.uid, name:'Past cohort', mode:'individual', status:'closed', startedAt:Timestamp.fromMillis(2), createdAt:Timestamp.fromMillis(1)});
  archive.set(historical.collection('participants').doc(uid), {email,joinedAt:Timestamp.now()});
  await archive.commit();
  await auth.updateUser(uid,{email: 'new-' + email});
  await auth.createUser({uid:admin.uid,email:admin.token.email});
  const instructorSolo = await room({mode:'solo',owner:admin.uid,status:'closed'},true,false,admin.uid);
  await assert.rejects(api.getUserClassrooms(call(student,{uid})),{code:'permission-denied'});
  await assert.rejects(api.getUserClassrooms(call({...admin,token:{...admin.token,email_verified:false}},{uid})),{code:'permission-denied'});
  await assert.rejects(api.getUserClassrooms(call(admin,{uid:'invalid/path'})),{code:'invalid-argument'});
  const byCode = async account => new Map((await api.getUserClassrooms(call(account,{uid}))).sessions.map(s => [s.code,s]));
  const own = await byCode(admin);
  assert.deepEqual([...own.keys()],[running.id,planned.id,legacy.id,historical.id]);
  assert.equal(own.get(historical.id).joined,true);
  assert.equal(own.get(running.id).joined,true);
  assert.equal(own.get(running.id).team,'Team 4');
  assert.match(own.get(running.id).practiceOpponent,/AI.*OpenAI.*model-one/);
  assert.equal(own.get(running.id).mainOpponent,'Team 8');
  assert.equal(own.get(running.id).currentPhase,'main');
  assert.equal(own.get(running.id).activeOpponent,'Team 8');
  assert.equal(own.get(planned.id).joined,false);
  assert.equal(own.get(planned.id).team,'Team 7');
  assert.equal(own.get(legacy.id).status,'completed');
  assert.equal(own.get(legacy.id).activeOpponent,null);
  assert.deepEqual([...(await byCode(other)).keys()],[otherRoom.id]);
  const all = await byCode(studio);
  assert(all.has(solo.id) && all.has(otherRoom.id));
  const ownSolo = (await api.getUserClassrooms(call(admin,{uid:admin.uid}))).sessions;
  assert.deepEqual(ownSolo.map(s=>s.code),[instructorSolo.id]);
  assert.deepEqual((await api.getUserClassrooms(call(other,{uid:admin.uid}))).sessions,[]);
  for (const excluded of [stale,removed,absent,reusedEmail]) assert(!all.has(excluded.id));
  const directoryRow = async account => {
    let pageToken;
    do {
      const page = await api.listTeamUsers(call(account, {pageToken}));
      const row = page.users.find(user => user.uid === uid);
      if (row) return row;
      pageToken = page.nextPageToken;
    } while (pageToken);
    assert.fail('registered user missing from the directory');
  };
  // Only an actual member of a started session has a played code. Joined
  // lobbies, cancelled classes and preassignments still appear in the details.
  await room({mode:'individual',status:'closed',startedAt:null},true,true);
  await room({mode:'individual',status:'lobby'},true,true);
  assert.deepEqual((await directoryRow(admin)).playedSessionCodes, [running.id,legacy.id,historical.id].sort());
  assert.deepEqual((await directoryRow(other)).playedSessionCodes, [otherRoom.id]);
  assert.deepEqual((await directoryRow(studio)).playedSessionCodes, [running.id,legacy.id,historical.id,otherRoom.id,solo.id].sort());
});
