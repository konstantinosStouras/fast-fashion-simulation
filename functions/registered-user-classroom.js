import {classroomClock} from './user-classrooms.js';

export const ownerEmail = 'kstouras@gmail.com';
const protectedEmails = new Set([ownerEmail, 'kstouras+ffo-admin@gmail.com']);
export function protectedRegisteredUser(user, callerUid) {
  return user.uid === callerUid || protectedEmails.has(user.email?.toLowerCase());
}

export function validDeletionBatch(uids) {
  return Array.isArray(uids) && uids.length > 0 && uids.length <= 10 && new Set(uids).size === uids.length &&
    uids.every(id => typeof id === 'string' && id.length > 0 && id.length <= 128 &&
      !['.', '..', '__proto__', 'constructor', 'prototype'].includes(id) && !id.includes('/') && !/^__.*__$/.test(id));
}

// The participant UID is also the decision owner for its team. Once play
// starts, an opponent's scores must still use that team's saved decisions.
export function planRegisteredUserRemoval(session, uid, ownerUid, deletingUids, now = Date.now()) {
  const updates = {};
  const deleteSession = session.owner === uid && session.mode === 'solo';
  if (session.owner === uid && !deleteSession) updates.owner = ownerUid;
  const planned = session.teamComposition;
  if (planned && Object.hasOwn(planned, uid)) {
    updates.teamComposition = {...planned};
    delete updates.teamComposition[uid];
  }
  const assignments = session.assignments || {};
  const isCaptain = Object.hasOwn(session.teamNames || {}, uid);
  if (Object.hasOwn(assignments, uid)) {
    updates.assignments = {...assignments};
    delete updates.assignments[uid];
  }
  let replacementCaptain = null;
  let keepTeamResult = false;
  if (isCaptain) {
    const ongoing = classroomClock(session, now).status === 'running';
    const teammates = Object.keys(assignments).filter(id =>
      assignments[id] === uid && id !== uid && !deletingUids.has(id)).sort();
    if (session.status === 'lobby' || (ongoing && teammates.length)) {
      replacementCaptain = teammates[0] || null;
      updates.teamNames = {...session.teamNames};
      delete updates.teamNames[uid];
      if (replacementCaptain) updates.teamNames[replacementCaptain] = session.teamNames[uid];
      updates.assignments ||= {...assignments};
      for (const [id, captain] of Object.entries(updates.assignments)) {
        if (captain !== uid) continue;
        if (replacementCaptain && !deletingUids.has(id)) updates.assignments[id] = replacementCaptain;
        else delete updates.assignments[id];
      }
      if (ongoing) {
        // Preserve the ordering used when the seeded customer choices were
        // originally drawn, including across successive captain transfers.
        updates.marketIdentities = {...session.marketIdentities,
          [replacementCaptain]: session.marketIdentities?.[uid] || uid};
        delete updates.marketIdentities[uid];
        if (session.teamOpponents) {
          updates.teamOpponents = {...session.teamOpponents, [replacementCaptain]: session.teamOpponents[uid]};
          delete updates.teamOpponents[uid];
          const other = updates.teamOpponents[replacementCaptain];
          if (other != null) updates.teamOpponents[other] = replacementCaptain;
        }
      }
    } else {
      // Keep the anonymous decision holder for finished games and for an
      // active team's last member, so another team's opponent still exists.
      keepTeamResult = true;
    }
  }
  return {deleteSession, updates, replacementCaptain, keepTeamResult};
}
