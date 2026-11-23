import {FieldPath} from 'firebase-admin/firestore';
import {AiError} from './providers.js';
import {ownerEmail, planRegisteredUserRemoval, protectedRegisteredUser, validDeletionBatch} from './registered-user-classroom.js';
export {protectedRegisteredUser};

function decisionRefs(member) {
  return [
    ...['orders', 'aiRounds'].flatMap(collection =>
      [0, 1, 2, 3].map(round => member.collection(collection).doc(String(round)))),
    ...['practice', 'main'].map(phase => member.collection('aiOpponents').doc(phase))
  ];
}

async function cleanClassroom(db, ref, deleting, ownerUid) {
  await db.runTransaction(async tx => {
    const room = await tx.get(ref);
    if (!room.exists) return;
    const session = room.data();
    const people = await tx.getAll(...[...deleting].map(id => ref.collection('participants').doc(id)));
    const actions = [];
    const roomChanges = {};
    for (const person of people) {
      const plan = planRegisteredUserRemoval(session, person.id, ownerUid, deleting);
      Object.assign(session, plan.updates);
      Object.assign(roomChanges, plan.updates);
      if (plan.deleteSession) {
        actions.push(() => tx.delete(ref));
      }
      if (!person.exists && !plan.deleteSession) continue;
      if (session.status === 'lobby') roomChanges.rosterVersion = (session.rosterVersion || 0) + 1;
      if (plan.keepTeamResult) {
        const anonymous = {name: 'Deleted user', email: ''};
        if (person.get('joinedAt')) anonymous.joinedAt = person.get('joinedAt');
        actions.push(() => tx.set(person.ref, anonymous));
        continue;
      }
      const decisions = decisionRefs(person.ref);
      if (session.status === 'running' && plan.replacementCaptain) {
        const source = await tx.getAll(...decisions);
        const target = decisionRefs(ref.collection('participants').doc(plan.replacementCaptain));
        actions.push(() => source.forEach((doc, index) => {
          if (doc.exists) tx.set(target[index], doc.data());
          else tx.delete(target[index]);
        }));
      }
      actions.push(() => {
        for (const decision of decisions) tx.delete(decision);
        tx.delete(person.ref);
      });
    }
    if (Object.keys(roomChanges).length && !(session.mode === 'solo' && deleting.has(session.owner))) {
      tx.update(ref, roomChanges);
    }
    for (const action of actions) action();
  });
}

async function eachPage(collection, fields, visit) {
  const query = collection.orderBy(FieldPath.documentId()).select(...fields).limit(30);
  let cursor;
  while (true) {
    const page = await (cursor ? query.startAfter(cursor) : query).get();
    if (page.empty) return;
    await visit(page.docs);
    if (page.size < 30) return;
    cursor = page.docs.at(-1).id;
  }
}

async function cleanClassrooms(db, deleting, ownerUid) {
  await eachPage(db.collection('sessions'), ['owner', 'teamComposition', 'assignments', 'teamNames'], async rooms => {
    const members = await db.getAll(...rooms.flatMap(room =>
      [...deleting].map(uid => room.ref.collection('participants').doc(uid))), {fieldMask: ['joinedAt']});
    const joined = new Set(members.filter(member => member.exists).map(member => member.ref.parent.parent.id));
    const affected = rooms.filter(room => joined.has(room.id) || deleting.has(room.get('owner')) ||
      ['teamComposition', 'assignments', 'teamNames'].some(field => Object.keys(room.get(field) || {}).some(uid => deleting.has(uid))));
    for (let i = 0; i < affected.length; i += 5)
      await Promise.all(affected.slice(i, i + 5).map(room => cleanClassroom(db, room.ref, deleting, ownerUid)));
  });
}

async function cleanDefaultRosters(db, deleting) {
  await eachPage(db.collection('studioTeamDefaults'), ['teamComposition'], async docs => {
    const affected = docs.filter(doc => deleting.has(doc.id) || Object.keys(doc.get('teamComposition') || {}).some(uid => deleting.has(uid)));
    for (const doc of affected) {
      await db.runTransaction(async tx => {
        const snapshot = await tx.get(doc.ref);
        if (!snapshot.exists) return;
        if (deleting.has(doc.id)) { tx.delete(doc.ref); return; }
        const composition = {...snapshot.get('teamComposition')};
        for (const uid of deleting) delete composition[uid];
        tx.update(doc.ref, {teamComposition: composition});
      });
    }
  });
}

export function registeredUserService({db, auth}) {
  return async function deleteRegisteredUsers(request) {
    const caller = request.auth;
    if (!caller?.uid || caller.token?.email_verified !== true || caller.token.email !== ownerEmail)
      throw new AiError('permission-denied', 'Only the platform owner can delete registered users.');
    const uids = request.data?.uids;
    if (!validDeletionBatch(uids))
      throw new AiError('invalid-argument', 'Choose between one and ten distinct registered users.');
    const records = await auth.getUsers(uids.map(uid => ({uid})));
    const protectedUids = new Set(records.users.filter(user => protectedRegisteredUser(user, caller.uid)).map(user => user.uid));
    if (uids.includes(caller.uid)) protectedUids.add(caller.uid);
    const users = records.users.filter(user => !protectedUids.has(user.uid));
    const deleting = new Set(users.map(user => user.uid));
    if (users.length) {
      // Firestore cannot invalidate an already-issued Firebase ID token.
      // Keep this UID-only marker so old clients cannot rejoin or recreate a
      // profile while the cross-service operation is retried.
      const revoke = db.batch();
      for (const user of users) {
        revoke.set(db.collection('deletedAccounts').doc(user.uid), {revoked: true});
        if (user.email && !user.email.includes('/')) revoke.delete(db.collection('instructors').doc(user.email.toLowerCase()));
      }
      await revoke.commit();
      await cleanDefaultRosters(db, deleting);
      // New classrooms may copy their administrator's stored roster. Clean
      // those defaults before scanning classes so a concurrently created class
      // either uses a clean roster or is included in this cleanup.
      await cleanClassrooms(db, deleting, caller.uid);
      await Promise.all(users.map(async user => {
        await db.recursiveDelete(db.collection('profiles').doc(user.uid));
        const batch = db.batch();
        batch.delete(db.collection('verifiedAccounts').doc(user.uid));
        batch.delete(db.collection('privateAiSettings').doc(user.uid));
        await batch.commit();
      }));
      // Delete Auth last. A failed cleanup leaves the account in the directory
      // for retry. Already-deleted IDs make replays of a confirmed batch safe.
      const result = await auth.deleteUsers([...deleting]);
      if (result.failureCount) throw new AiError('unavailable', 'Some accounts could not be deleted. Refresh and retry the remaining users.');
    }
    return {deletedUids: uids.filter(uid => !protectedUids.has(uid)), protectedUids: [...protectedUids]};
  };
}
