import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {aiService} from '../functions/service.js';

const requireServer = createRequire(new URL('../functions/package.json',import.meta.url));
const {initializeApp,getApps} = requireServer('firebase-admin/app');
const {getFirestore} = requireServer('firebase-admin/firestore');
const {getAuth} = requireServer('firebase-admin/auth');

// Exercise the callable against the same real Auth and Firestore emulators used
// by the browser backend. Only the Functions HTTP transport is substituted.
export async function joinOnEmulator(user,data) {
  assert.equal(process.env.FIRESTORE_EMULATOR_HOST,'127.0.0.1:8180');
  assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST,'127.0.0.1:9198');
  const name='team-join-test-service';
  const app=getApps().find(entry=>entry.name===name) || initializeApp({projectId:'demo-fashion-futures'},name);
  const auth=getAuth(app);
  const token=await auth.verifyIdToken(await user.getIdToken());
  return aiService({db:getFirestore(app),auth}).joinTeamClassroom({auth:{uid:token.uid,token},data});
}

export function useLocalTeamJoin(source) {
  const localModule = JSON.stringify(import.meta.url);
  return source.replace("const joinTeam=callable('joinTeamClassroom',60000);",
    'const joinTeam=async data=>(await import('+localModule+')).joinOnEmulator(auth.currentUser,data);');
}
