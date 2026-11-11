import test from 'node:test';
import assert from 'node:assert/strict';
import {csvCell} from '../ui.js';

test('CSV exports preserve numeric losses and escape formulas, quotes and multiline names',()=>{
 assert.equal(csvCell(-1234.5),'"-1234.5"');
 assert.equal(csvCell(0),'"0"');
 assert.equal(csvCell('=1+1'),'"\'=1+1"');
 assert.equal(csvCell('  =1+1'),'"\'  =1+1"');
 assert.equal(csvCell('\tformula'),'"\'\tformula"');
 assert.equal(csvCell('-danger'),'"\'-danger"');
 assert.equal(csvCell('Team "A",\nLondon'),'"Team ""A"",\nLondon"');
});
