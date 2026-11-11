import test from 'node:test';
import assert from 'node:assert/strict';
import {partitionSessions,sessionState,decisionSummary} from '../studio.js';
test('studio groups waiting and running sessions above completed and closed sessions',()=>{
 const sessions=[{code:'waiting',status:'lobby'},{code:'running',status:'running',startedAt:{toMillis:()=>1000}},{code:'finished',status:'running',startedAt:{toMillis:()=>0}},{code:'closed',status:'closed'}];
 const {active,past}=partitionSessions(sessions,1080000);
 assert.deepEqual(active.map(s=>s.code),['waiting','running']);assert.deepEqual(past.map(s=>s.code),['finished','closed']);
 assert.equal(sessionState(sessions[2],1079999),'Running');assert.equal(sessionState(sessions[2],1080000),'Completed');
});
test('completed and closed sessions report saved scored decisions without inventing a current round',()=>{
 const order={variety:4,quantity:80,cap:0},orders={0:order,1:order,2:order,3:order};
 assert.equal(decisionSummary({status:'running'},{index:4},orders,[1,2,3]),'3/3 scored decisions saved');
 assert.equal(decisionSummary({status:'closed'},{index:2},{0:order,1:order},[1]),'1/1 scored decisions saved');
 assert.equal(decisionSummary({status:'running'},{index:4},{0:order,1:order},[1,2,3]),'1/3 scored decisions saved · 2 used defaults');
 assert.equal(decisionSummary({status:'closed'},{index:0},{},[]),'No scored seasons completed');
 assert.equal(decisionSummary({status:'lobby'},{index:-1},{},[]),'Waiting to start');
 assert.equal(decisionSummary({status:'running'},{index:2},{},[1]),'No saved decision for this round');
 assert.equal(decisionSummary({status:'running'},{index:2},orders,[1]),'4 styles · 80 initial · cap 0');
});
