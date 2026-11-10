import test from 'node:test';
import assert from 'node:assert/strict';
import {partitionSessions,sessionState} from '../studio.js';
test('studio groups waiting and running sessions above completed and closed sessions',()=>{
 const sessions=[{code:'waiting',status:'lobby'},{code:'running',status:'running',startedAt:{toMillis:()=>1000}},{code:'finished',status:'running',startedAt:{toMillis:()=>0}},{code:'closed',status:'closed'}];
 const {active,past}=partitionSessions(sessions,1080000);
 assert.deepEqual(active.map(s=>s.code),['waiting','running']);assert.deepEqual(past.map(s=>s.code),['finished','closed']);
 assert.equal(sessionState(sessions[2],1079999),'Running');assert.equal(sessionState(sessions[2],1080000),'Completed');
});
