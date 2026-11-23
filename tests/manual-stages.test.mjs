import test from 'node:test';
import assert from 'node:assert/strict';
import {legacyPhaseOffset, sessionProgress} from '../functions/session-progress.js';
import {snapshotLegacyRooms} from '../tools/migrate-manual-stages.mjs';

test('the rollout preserves every playable stage and all completed seasons', () => {
  const start = Date.parse('2026-11-23T10:00:00Z');
  for (const [elapsed, expected] of [[0,0],[89,0],[90,90],[179,90],[180,180],[419,180],[420,420],
    [539,420],[540,540],[659,540],[660,660],[809,660],[810,810],[959,810],[960,960],[1500,960]]) {
    assert.equal(legacyPhaseOffset(start, start+elapsed*1000), expected);
  }
  assert.equal(sessionProgress({status:'running',startedAt:start}), -1);
  assert.equal(sessionProgress({status:'running',startedAt:start,phaseOffset:540}), 540);
  assert.equal(sessionProgress({status:'closed',startedAt:start,closedAt:start+500000}), 500);
});

test('migration retries a concurrent update, changes only the missing stage, and is idempotent', async () => {
  const startedAt = {timestampValue:'2026-11-23T10:00:00Z'}, status = {stringValue:'running'};
  const rooms = ['old','new'].map(name => ({name:'db/sessions/'+name,updateTime:'first',
    fields:{status,startedAt,...(name==='new'?{phaseOffset:{integerValue:'180'}}:{})}}));
  let writes = 0;
  const api = async (path,method,body) => {
    if (path==='db:runQuery') return rooms.map(document=>({document:structuredClone(document)}));
    if (path==='db:commit') {
      const [write] = body.writes;
      assert.equal(write.update.fields.phaseOffset.integerValue,'540');
      assert.deepEqual(write.updateMask.fieldPaths,['phaseOffset']);
      if (writes++===0) {
        rooms[0].updateTime='second';
        throw Object.assign(Error('concurrent update'),{code:'FAILED_PRECONDITION'});
      }
      assert.equal(write.currentDocument.updateTime,'second');
      Object.assign(rooms[0].fields,write.update.fields);
      return rooms[0];
    }
    return structuredClone(rooms[0]);
  };
  const snapshot = apply=>snapshotLegacyRooms(api,'db','2026-11-23T10:09:30Z',apply);
  assert.equal(await snapshot(false),1);
  assert.equal(writes,0);
  assert.equal(await snapshot(true),1);
  assert.equal(await snapshot(true),0);
  assert.equal(rooms[1].fields.phaseOffset.integerValue,'180');
});

test('an earlier verified freeze preserves the scores of rooms closed later', async () => {
  const docs = ['10:05','10:15'].map(time=>({document:{name:'db/sessions/'+time,updateTime:'initial',fields:{
    status:{stringValue:'closed'},startedAt:{timestampValue:'2026-11-23T10:00:00Z'},
    closedAt:{timestampValue:'2026-11-23T'+time+':00Z'}}}}));
  const writes = [];
  const api = async (path,method,body) => {
    if (path==='db:runQuery') return docs;
    writes.push(body.writes[0]);
  };
  const result = await snapshotLegacyRooms(api,'db','2026-11-23T10:09:30Z',true,true);
  assert.equal(result,1);
  assert.equal(writes[0].update.name,'db/sessions/10:15');
  assert.equal(writes[0].update.fields.phaseOffset.integerValue,'540');
});
