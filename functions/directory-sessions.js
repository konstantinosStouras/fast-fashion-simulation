import {FieldPath} from 'firebase-admin/firestore';

// Auth lists accounts by UID. Reading each room's participant-ID interval
// covers the whole Auth page, including older joins with no profile link.
// The set check also handles sparse intervals and accounts since removed.
export async function readPlayedSessionCodes(db, account, pageUids) {
  let matches, orderedIds;
  const rooms = db.collection('sessions');
  const managed = account.isOwner ? rooms : rooms.where('owner', '==', account.uid);
  const pageSize = 30;
  const query = managed.orderBy(FieldPath.documentId()).limit(pageSize)
    .select('owner', 'mode', 'status', 'startedAt', 'deletedAt');
  let cursor;
  do {
    const page = await db.runTransaction(async tx => {
      const snapshot = await tx.get(cursor ? query.startAfter(cursor) : query);
      if (!matches) {
        const uids = await pageUids;
        matches = new Map(uids.map(uid => [uid, []]));
        orderedIds = [...uids].sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)));
      }
      if (!matches.size) return {rows: [], cursor: null};
      const played = snapshot.docs.filter(doc => !doc.get('deletedAt') &&
        (doc.get('status') === 'running' || doc.get('status') === 'completed' ||
          (doc.get('status') === 'closed' && doc.get('startedAt') != null)) &&
        (doc.get('mode') !== 'solo' || matches.has(doc.get('owner'))));
      const rows = await Promise.all(played.map(async room => {
        const roster = room.ref.collection('participants').orderBy(FieldPath.documentId())
          .startAt(orderedIds[0]).endAt(orderedIds.at(-1)).select();
        const members = (await tx.get(roster)).docs.filter(member =>
          matches.has(member.id) && (room.get('mode') !== 'solo' || room.get('owner') === member.id));
        return {code: room.id, uids: members.map(member => member.id)};
      }));
      return {rows, cursor: snapshot.size === pageSize ? snapshot.docs.at(-1).id : null};
    }, {readOnly: true});
    for (const {code, uids: members} of page.rows) {
      for (const uid of members) matches.get(uid).push(code);
    }
    cursor = page.cursor;
  } while (cursor);
  return matches;
}
