import {initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';
import {defineSecret} from 'firebase-functions/params';
import {HttpsError, onCall} from 'firebase-functions/v2/https';
import {AiError} from './providers.js';
import {registeredUserService} from './registered-users.js';
import {aiService} from './service.js';

initializeApp();
const encryptionKey = defineSecret('FFO_AI_KEY_ENCRYPTION');
const api = aiService({db: getFirestore(), auth: getAuth(), encryptionSecret: () => encryptionKey.value()});

function callable(handler, options = {}) {
  return onCall({region: 'us-central1', ...options}, async request => {
    try { return await handler(request); }
    catch (error) {
      if (error instanceof AiError) throw new HttpsError(error.code, error.message);
      // Never log raw provider, Auth, or Firestore errors that could contain user inputs.
      throw new HttpsError('internal', 'The server could not complete this request. Please retry.');
    }
  });
}

export const readStudioPanel = callable(api.readStudioPanel, {region: 'europe-west1', timeoutSeconds: 120});
export const getAiSettings = callable(api.getAiSettings);
export const deleteRegisteredUsers = callable(registeredUserService({db: getFirestore(), auth: getAuth()}), {timeoutSeconds: 540});
export const saveAiSettings = callable(api.saveAiSettings, {secrets: [encryptionKey]});
export const prepareAiOpponent = callable(api.prepareAiOpponent, {secrets: [encryptionKey], timeoutSeconds: 150});
export const startAiSession = callable(api.startAiSession, {timeoutSeconds: 120});
export const joinTeamClassroom = callable(api.joinTeamClassroom);
export const listTeamUsers = callable(api.listTeamUsers, {timeoutSeconds: 120});
export const getUserClassrooms = callable(api.getUserClassrooms);
export const saveTeamComposition = callable(api.saveTeamComposition);
export const saveDefaultTeamComposition = callable(api.saveDefaultTeamComposition);
