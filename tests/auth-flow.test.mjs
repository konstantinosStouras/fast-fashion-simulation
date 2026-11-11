import test from 'node:test';
import assert from 'node:assert/strict';
import {sessionCodeFromUrl,emailActionSettings} from '../auth-flow.js';

test('email return URLs keep a valid session and never accept an external redirect',()=>{
 const source='https://www.stouras.com/fast-fashion-simulation/?session=abcd-efgh&redirect=https://other.example';
 assert.equal(sessionCodeFromUrl(source),'ABCDEFGH');
 assert.equal(emailActionSettings(source,'verify').url,'https://www.stouras.com/fast-fashion-simulation/?session=ABCDEFGH&auth=verify');
 assert.equal(emailActionSettings(source,'login').url,'https://www.stouras.com/fast-fashion-simulation/?session=ABCDEFGH&auth=login');
 assert.equal(sessionCodeFromUrl('https://example.test/?session=12345678'),'');
 assert.equal(emailActionSettings('https://other.example/?session=bad','login','BCDEFGHJ').url,'https://www.stouras.com/fast-fashion-simulation/?session=BCDEFGHJ&auth=login');
 assert.equal(emailActionSettings('https://www.stouras.com/fast-fashion-simulation/admin/','login').url,'https://www.stouras.com/fast-fashion-simulation/?studio=1&auth=login');
});
