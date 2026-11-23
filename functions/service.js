import {randomUUID} from 'node:crypto';
import {FieldPath, FieldValue, Timestamp} from 'firebase-admin/firestore';
import {AiError, discoverModels, generatePlan, phaseRounds, providers, validPlan} from './providers.js';
import {openKey, sealKey} from './keys.js';
import {getTeamComposition, makeTeamOpponents, materializeTeams, validateTeams} from './teams.js';
import {summarizeUserClassroom} from './user-classrooms.js';

const OWNER_EMAIL = 'kstouras@gmail.com'; // Same platform-owner identity as firestore.rules.
const timestamp = FieldValue.serverTimestamp;

function requireValue(condition, code, message) {
  if (!condition) throw new AiError(code, message);
}
function validUid(uid) {
  return typeof uid === 'string' && uid.length > 0 && uid.length <= 128 &&
    !uid.includes('/') && !['.', '..', '__proto__', 'constructor', 'prototype'].includes(uid) && !/^__.*__$/.test(uid);
}
function publicSettings(data = {}) {
  return {
    provider: data.provider ?? null, model: data.model ?? null,
    providers: Object.entries(providers).map(([id, label]) => ({
      id, label, hasKey: Boolean(data.connections?.[id]?.credential), models: data.connections?.[id]?.models || []
    }))
  };
}
function validTeamNumber(n) { return typeof n === 'string' && /^([1-9]\d?|100)$/.test(n); }
function isoDate(raw) {
  const millis = raw ? Date.parse(raw) : NaN;
  return Number.isFinite(millis) ? new Date(millis).toISOString() : null;
}

export function aiService({db, auth, encryptionSecret, discover = discoverModels, generate = generatePlan}) {
  const settingsRef = uid => db.collection('privateAiSettings').doc(uid);
  function sessionRef(code) {
    requireValue(typeof code === 'string' && /^[A-Z0-9]{3,12}$/.test(code), 'invalid-argument', 'Choose a valid classroom code.');
    return db.collection('sessions').doc(code);
  }
  async function instructor(request, tx) {
    const {uid, token} = request.auth || {};
    requireValue(uid && token?.email_verified === true && typeof token.email === 'string' && !token.email.includes('/'),
      'permission-denied', 'Sign in with a verified instructor account.');
    const isOwner = token.email === OWNER_EMAIL;
    if (!isOwner) {
      const ref = db.collection('instructors').doc(token.email);
      const snapshot = tx ? await tx.get(ref) : await ref.get();
      requireValue(snapshot.exists, 'permission-denied', 'Instructor access is required.');
    }
    return {uid, isOwner};
  }
  async function readOwnedSession(request, tx, ref) {
    const account = await instructor(request, tx);
    const s = (await tx.get(ref)).data();
    requireValue(s && (account.isOwner || s.owner === account.uid), 'permission-denied', 'You do not manage this classroom.');
    requireValue(!s.deletedAt, 'failed-precondition', 'This classroom is being deleted.');
    return s;
  }
  async function lobbyOpponent(request, tx, ref, competitor, phase) {
    const s = await readOwnedSession(request, tx, ref);
    requireValue(s.status === 'lobby' && s.aiOpponent?.[phase] === true && Object.hasOwn(providers, s.aiOpponent.provider),
      'failed-precondition', 'This phase needs an active AI opponent in a waiting classroom.');
    if (s.mode === 'team' && s.teamComposition != null) {
      // Resolve just this team against today's join list. A classroom-wide
      // roster scan on every provider request would multiply reads by team count.
      const number = s.teamComposition[competitor];
      requireValue(validTeamNumber(number), 'failed-precondition', 'Refresh the current team assignments.');
      const members = Object.keys(s.teamComposition).filter(uid => s.teamComposition[uid] === number);
      const docs = await tx.getAll(...members.map(uid => ref.collection('participants').doc(uid)), {fieldMask: ['joinedAt']});
      const joined = docs.filter(doc => doc.exists).map(doc => ({uid: doc.id}));
      requireValue(Object.hasOwn(materializeTeams(joined, s).teamNames, competitor), 'failed-precondition', 'Refresh the current team assignments.');
    } else {
      requireValue((await tx.get(ref.collection('participants').doc(competitor))).exists, 'failed-precondition', 'The participant must join the classroom first.');
      if (s.mode === 'team') requireValue(s.assignments?.[competitor] === competitor && Object.hasOwn(s.teamNames || {}, competitor),
        'failed-precondition', 'Refresh the current team assignments.');
    }
    return s;
  }
  function matches(doc, session, phase) {
    return doc?.status === 'ready' && doc.provider === session.aiOpponent.provider && doc.model === session.aiOpponent.model &&
      session.createdAt?.isEqual(doc.sessionCreatedAt) && validPlan(doc.orders, phase);
  }
  async function getAiSettings(request) {
    const account = await instructor(request);
    return publicSettings((await settingsRef(account.uid).get()).data());
  }
  async function saveAiSettings(request) {
    const account = await instructor(request);
    const {provider, apiKey, model, removeKey} = request.data || {};
    requireValue(Object.hasOwn(providers, provider), 'invalid-argument', 'Choose a supported AI provider.');
    const supplied = apiKey !== undefined;
    requireValue((supplied || model !== undefined || removeKey === true) && !(removeKey && (supplied || model !== undefined)),
      'invalid-argument', 'Choose a key or model action.');
    let connection;
    if (supplied) {
      requireValue(typeof apiKey === 'string' && /^[!-~]{8,1024}$/.test(apiKey.trim()), 'invalid-argument', 'Enter a valid provider API key.');
      const key = apiKey.trim();
      connection = {models: await discover(provider, key), credential: sealKey(key, encryptionSecret(), account.uid, provider)};
    }
    const ref = settingsRef(account.uid);
    return db.runTransaction(async tx => {
      await instructor(request, tx);
      const data = (await tx.get(ref)).data() || {};
      const connections = {...data.connections};
      if (removeKey) delete connections[provider];
      if (connection) connections[provider] = connection;
      let selected = data.provider ?? null, selectedModel = data.model ?? null;
      if (model !== undefined) {
        requireValue(typeof model === 'string' && connections[provider]?.models.some(m => m.id === model),
          'invalid-argument', 'Choose a model available with the saved provider key.');
        selected = provider; selectedModel = model;
      } else if (!connections[selected]?.models.some(m => m.id === selectedModel)) {
        selected = Object.keys(connections)[0] ?? null;
        selectedModel = connections[selected]?.models[0]?.id ?? null;
      }
      const next = {provider: selected, model: selectedModel, connections};
      tx.set(ref, next);
      return publicSettings(next);
    });
  }
  async function prepareAiOpponent(request) {
    const {code, competitor, phase} = request.data || {};
    const ref = sessionRef(code);
    requireValue(validUid(competitor) && Object.hasOwn(phaseRounds, phase), 'invalid-argument', 'Choose a competitor and phase.');
    const participant = ref.collection('participants').doc(competitor);
    const planRef = participant.collection('aiOpponents').doc(phase);
    const lease = randomUUID();
    const claim = await db.runTransaction(async tx => {
      const s = await lobbyOpponent(request, tx, ref, competitor, phase);
      const {provider, model} = s.aiOpponent;
      const prior = (await tx.get(planRef)).data();
      if (matches(prior, s, phase)) return {ready: prior.orders};
      requireValue(!(prior?.status === 'generating' && prior.provider === provider && prior.model === model &&
        s.createdAt.isEqual(prior.sessionCreatedAt) && prior.expiresAt?.toMillis() > Date.now()), 'aborted',
        'This opponent is already being prepared. Retry shortly.');
      const settings = (await tx.get(settingsRef(s.owner))).data();
      const connection = settings?.connections?.[provider];
      requireValue(connection?.credential && connection.models.some(m => m.id === model), 'failed-precondition',
        'The classroom owner needs to connect the selected model in AI settings.');
      tx.set(planRef, {status: 'generating', provider, model, lease, sessionCreatedAt: s.createdAt, expiresAt: Timestamp.fromMillis(Date.now() + 150000)});
      return {provider, model, credential: connection.credential, owner: s.owner, config: s.config, sessionCreatedAt: s.createdAt};
    });
    if (claim.ready) return {orders: claim.ready};
    try {
      const key = openKey(claim.credential, encryptionSecret(), claim.owner, claim.provider);
      const orders = await generate(claim.provider, claim.model, key, phase, claim.config);
      await db.runTransaction(async tx => {
        const s = await lobbyOpponent(request, tx, ref, competitor, phase);
        const current = (await tx.get(planRef)).data();
        requireValue(current?.lease === lease && s.createdAt.isEqual(claim.sessionCreatedAt) && s.owner === claim.owner &&
          s.aiOpponent.provider === claim.provider && s.aiOpponent.model === claim.model, 'aborted',
          'The classroom changed during preparation. Retry with its current settings.');
        const identity = {provider: claim.provider, model: claim.model, sessionCreatedAt: claim.sessionCreatedAt};
        tx.set(planRef, {...identity, status: 'ready', orders, createdAt: timestamp()});
        for (const round of phaseRounds[phase]) {
          tx.set(participant.collection('aiRounds').doc(String(round)), {...identity, order: orders[round]});
        }
      });
      return {orders};
    } catch (error) {
      // Only release this caller's claim. A restarted generation or a freshly
      // recreated classroom may already own this same document path.
      await db.runTransaction(async tx => {
        const active = (await tx.get(planRef)).data();
        if (active?.lease === lease) tx.delete(planRef);
      });
      throw error;
    }
  }
  async function startAiSession(request) {
    const ref = sessionRef(request.data?.code);
    return db.runTransaction(async tx => {
      const s = await readOwnedSession(request, tx, ref);
      const phases = Object.keys(phaseRounds).filter(p => s.aiOpponent?.[p] === true);
      requireValue(phases.length > 0, 'failed-precondition', 'Enable at least one AI opponent phase.');
      if (s.status === 'running') return {started: true};
      requireValue(s.status === 'lobby', 'failed-precondition', 'Only a waiting classroom can start.');
      const roster = await tx.get(ref.collection('participants').select());
      const people = roster.docs.map(doc => ({uid: doc.id}));
      requireValue(people.length, 'failed-precondition', 'At least one participant must join before starting an AI classroom.');
      let competitors = people.map(p => p.uid);
      const update = {status: 'running', startedAt: timestamp()};
      if (s.mode === 'team') {
        const teams = materializeTeams(people, s);
        requireValue(validateTeams(people, teams.assignments, teams.teamNames), 'failed-precondition', 'Assign every joined participant to a team before starting.');
        Object.assign(update, teams, {teamOpponents: makeTeamOpponents(teams.teamNames)});
        competitors = Object.keys(teams.teamNames);
      }
      const refs = competitors.flatMap(uid => phases.map(phase => ref.collection('participants').doc(uid).collection('aiOpponents').doc(phase)));
      for (let i = 0; i < refs.length; i += 100) {
        const docs = await tx.getAll(...refs.slice(i, i + 100));
        requireValue(docs.every(doc => matches(doc.data(), s, doc.id)), 'failed-precondition',
          'Each current competitor needs a prepared opponent for every enabled phase. Retry Start.');
      }
      tx.update(ref, update);
      return {started: true};
    });
  }

  async function listTeamUsers(request) {
    await instructor(request);
    const pageToken = request.data?.pageToken;
    requireValue(pageToken == null || (typeof pageToken === 'string' && pageToken.length <= 4096), 'invalid-argument', 'Invalid directory page.');
    const page = await auth.listUsers(100, pageToken || undefined);
    const refs = page.users.map(user => db.collection('profiles').doc(user.uid));
    const profiles = refs.length ? await db.getAll(...refs, {fieldMask: ['firstName', 'lastName', 'universityId']}) : [];
    const byUid = new Map(profiles.map(doc => [doc.id, doc.data()]));
    const users = page.users.map(({uid, displayName, email, metadata}) => {
      const profile = byUid.get(uid);
      const name = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ') || displayName || email || uid;
      return {uid, name, email: email || '', studentId: profile?.universityId || null,
        registeredAt: isoDate(metadata?.creationTime), lastSignInAt: isoDate(metadata?.lastSignInTime)};
    });
    return {users, nextPageToken: page.pageToken || null};
  }
  async function getUserClassrooms(request) {
    const account = await instructor(request);
    const uid = request.data?.uid;
    requireValue(validUid(uid), 'invalid-argument', 'Choose a registered user.');
    try { await auth.getUser(uid); }
    catch (error) {
      if (error.code === 'auth/user-not-found') throw new AiError('not-found', 'This registered account is no longer available.');
      throw error;
    }
    const rooms = db.collection('sessions');
    const teamNumber = new FieldPath('teamComposition', uid), assigned = new FieldPath('assignments', uid);
    const fields = ['name', 'mode', 'status', 'createdAt', 'startedAt', 'closedAt',
      'teamNames', 'teamOpponents', 'aiOpponent', assigned, teamNumber];
    const managed = account.isOwner ? rooms : rooms.where('owner', '==', account.uid);
    const pageSize = 100;
    const query = managed.orderBy(FieldPath.documentId()).limit(pageSize).select('owner', 'mode', 'status', 'deletedAt', teamNumber);
    const summaries = [];
    const now = Date.now();
    // History links and the email saved at joining can both be outdated. Read
    // the authoritative participant path only when an instructor opens a user.
    // A read-only snapshot keeps membership and pairing consistent on each page.
    let cursor;
    do {
      const batch = await db.runTransaction(async tx => {
        const page = await tx.get(cursor ? query.startAfter(cursor) : query);
        const visible = page.docs.filter(doc => !doc.get('deletedAt') && (doc.get('mode') !== 'solo' || doc.get('owner') === uid));
        const rows = [];
        if (visible.length) {
          const members = await tx.getAll(...visible.map(doc => doc.ref.collection('participants').doc(uid)), {fieldMask: ['joinedAt']});
          const joined = new Set(members.filter(doc => doc.exists).map(doc => doc.ref.parent.parent.id));
          const selected = visible.filter(doc => joined.has(doc.id) ||
            (doc.get('mode') === 'team' && doc.get('status') === 'lobby' && doc.get(teamNumber)));
          if (selected.length) {
            const details = await tx.getAll(...selected.map(doc => doc.ref), {fieldMask: fields});
            for (const doc of details) {
              const s = doc.data();
              const summary = summarizeUserClassroom({...s, code: doc.id}, uid, joined.has(doc.id), now);
              if (summary) rows.push({summary, createdAt: s.createdAt?.toMillis() || 0});
            }
          }
        }
        return {rows, next: page.size === pageSize ? page.docs.at(-1).id : null};
      }, {readOnly: true});
      summaries.push(...batch.rows);
      cursor = batch.next;
    } while (cursor);
    const priority = {running: 0, lobby: 1, closed: 2, completed: 2};
    summaries.sort((a,b) => priority[a.summary.status] - priority[b.summary.status] ||
      b.createdAt - a.createdAt || a.summary.code.localeCompare(b.summary.code));
    return {sessions: summaries.map(({summary}) => summary)};
  }
  async function saveTeamComposition(request) {
    const ref = sessionRef(request.data?.code);
    const changes = request.data?.changes;
    requireValue(changes && typeof changes === 'object' && !Array.isArray(changes), 'invalid-argument', 'Provide team assignments to update.');
    const entries = Object.entries(changes);
    requireValue(entries.length <= 500 && entries.every(([uid, number]) => validUid(uid) && (number === null || validTeamNumber(number))),
      'invalid-argument', 'Use team numbers from 1 through 100 for up to 500 users.');
    // Authenticate and authorize the classroom before looking up its requested accounts.
    const confirmLobby = async tx => {
      const s = await readOwnedSession(request, tx, ref);
      requireValue(s.mode === 'team' && s.status === 'lobby', 'failed-precondition', 'Teams can only be edited in a waiting team classroom.');
      return s;
    };
    const expected = await db.runTransaction(confirmLobby);
    const ids = entries.filter(([, number]) => number !== null).map(([uid]) => ({uid}));
    for (let i = 0; i < ids.length; i += 100) {
      const batch = await auth.getUsers(ids.slice(i, i + 100));
      requireValue(!batch.notFound.length, 'failed-precondition', 'A selected account no longer exists. Refresh the directory.');
    }
    return db.runTransaction(async tx => {
      const s = await confirmLobby(tx);
      requireValue(s.createdAt.isEqual(expected.createdAt), 'aborted', 'This classroom was replaced. Refresh its team assignments.');
      const composition = getTeamComposition(s);
      for (const [uid, number] of entries) {
        if (number === null) delete composition[uid];
        else composition[uid] = number;
      }
      const counts = new Map();
      for (const number of Object.values(composition)) counts.set(number, (counts.get(number) || 0) + 1);
      requireValue(Object.keys(composition).length <= 500 && [...counts.values()].every(n => n <= 20), 'invalid-argument',
        'A team can have up to 20 users and a classroom up to 500.');
      const roster = await tx.get(ref.collection('participants').select());
      const teams = materializeTeams(roster.docs.map(doc => ({uid: doc.id})), {...s, teamComposition: composition});
      tx.update(ref, {teamComposition: composition, ...teams});
      return {teamComposition: composition, ...teams};
    });
  }
  return {getAiSettings, saveAiSettings, prepareAiOpponent, startAiSession, listTeamUsers, getUserClassrooms, saveTeamComposition};
}
