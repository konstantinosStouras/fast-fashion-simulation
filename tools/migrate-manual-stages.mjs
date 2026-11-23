import {pathToFileURL} from 'node:url';
import {legacyPhaseOffset} from '../functions/session-progress.js';

const project = 'stouras-ffo';
const rulesApi = 'https://firebaserules.googleapis.com/v1/';
const firestoreApi = 'https://firestore.googleapis.com/v1/';
const db = `projects/${project}/databases/(default)/documents`;

async function request(token, url, method = 'GET', body) {
  const response = await fetch(url, {
    method, headers: {Authorization: 'Bearer ' + token, 'Content-Type': 'application/json'},
    body: body == null ? undefined : JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok) throw Object.assign(Error(data.error?.message || 'Firestore request failed'), {
    code: data.error?.status, status: response.status
  });
  return data;
}

const markerValue = doc => ({cutover: doc.fields.cutover.timestampValue, priorFreeze: doc.fields.priorFreeze?.booleanValue === true});

async function deploymentCutover(token, apply, previousCutover) {
  const markerName = db + '/settings/manualStageCutover';
  try {
    return markerValue(await request(token, firestoreApi + markerName));
  } catch (error) {
    if (error.status !== 404) throw error;
  }
  const release = await request(token, rulesApi + `projects/${project}/releases/cloud.firestore`);
  const ruleset = await request(token, rulesApi + release.rulesetName);
  const manualRules = ruleset.source.files.some(file => file.content.includes("progress(resource.data)<960") &&
    file.content.includes('next.phaseOffset==180'));
  // An earlier manual release anchored unmarked rooms to a date in its rules.
  // Use its cutoff only when the active release actually contains that policy.
  const oldRules = ruleset.source.files.find(file => file.content.includes('s.closedAt<cutoff?s.closedAt:cutoff'));
  const oldDate = oldRules?.content.match(/let cutoff=timestamp\.date\((\d+),(\d+),(\d+)\)\+duration\.value\((\d+),'s'\)/);
  if (!manualRules && !oldDate) throw Error('Run against the deployed manual Firestore rules.');
  const verifiedCutover = oldDate ? new Date(Date.UTC(+oldDate[1], +oldDate[2]-1, +oldDate[3], 0, 0, +oldDate[4])).toISOString() : previousCutover;
  const priorFreeze = !!verifiedCutover;
  const cutover = verifiedCutover || release.updateTime;
  if (!Number.isFinite(Date.parse(cutover))) throw Error('A valid prior cutover timestamp is required.');
  if (!apply) return {cutover, priorFreeze};
  try {
    // Creating the marker (rather than replacing it) gives concurrent runs and
    // later retries the exact same server-confirmed rollout timestamp.
    await request(token, firestoreApi + db + '/settings?documentId=manualStageCutover', 'POST', {
      fields: {cutover: {timestampValue: cutover}, priorFreeze: {booleanValue: priorFreeze}, ruleset: {stringValue: release.rulesetName}}
    });
    return {cutover, priorFreeze};
  } catch (error) {
    if (error.code !== 'ALREADY_EXISTS') throw error;
    return markerValue(await request(token, firestoreApi + markerName));
  }
}

export async function snapshotLegacyRooms(api, documents, cutover, apply, priorFreeze = false) {
  const cutoffMs = Date.parse(cutover);
  if (!Number.isFinite(cutoffMs)) throw Error('The cutover timestamp is invalid.');
  const results = await api(documents + ':runQuery', 'POST', {structuredQuery: {
    from: [{collectionId: 'sessions'}],
    select: {fields: ['status','startedAt','closedAt','phaseOffset'].map(fieldPath => ({fieldPath}))},
    where: {fieldFilter: {field: {fieldPath: 'status'}, op: 'IN', value: {arrayValue: {
      values: (priorFreeze ? ['running','closed'] : ['running']).map(stringValue => ({stringValue}))
    }}}}
  }});
  let affected = 0;
  for (const result of results) {
    let doc = result.document;
    let retries = 0;
    while (doc && doc.fields.phaseOffset == null) {
      const status = doc.fields.status?.stringValue;
      // Archived rooms closing before the cutoff retain the original closedAt
      // accounting. Rooms closed after the earlier freeze must keep their snapshot.
      if (status !== 'running' && !(priorFreeze && status==='closed' && Date.parse(doc.fields.closedAt?.timestampValue)>cutoffMs && doc.fields.startedAt?.timestampValue)) break;
      const started = Date.parse(doc.fields.startedAt?.timestampValue);
      if (!Number.isFinite(started)) throw Error('A running classroom has an invalid start timestamp.');
      if (apply) {
        try {
          await api(documents + ':commit', 'POST', {writes: [{
            update: {name: doc.name, fields: {phaseOffset: {integerValue: String(legacyPhaseOffset(started, cutoffMs))}}},
            updateMask: {fieldPaths:['phaseOffset']}, currentDocument: {updateTime:doc.updateTime}
          }]});
        } catch (error) {
          if (error.code === 'NOT_FOUND') break;
          if (error.code !== 'FAILED_PRECONDITION' && error.code !== 'ABORTED') throw error;
          if (++retries > 5) throw Error('The classroom changed repeatedly. Rerun the migration to finish.');
          try {
            doc = await api(doc.name + '?mask.fieldPaths=status&mask.fieldPaths=startedAt&mask.fieldPaths=closedAt&mask.fieldPaths=phaseOffset');
          } catch (refreshError) {
            if (refreshError.code === 'NOT_FOUND') break;
            throw refreshError;
          }
          continue;
        }
      }
      affected++;
      break;
    }
  }
  return affected;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const apply = process.argv.includes('--apply');
    const {default: firebaseAuth} = await import('firebase-tools/lib/auth.js');
    const account = firebaseAuth.getGlobalDefaultAccount();
    if (!account) throw Error('Firebase CLI login required.');
    const token = (await firebaseAuth.getAccessToken(account.tokens.refresh_token, [
      'https://www.googleapis.com/auth/cloud-platform','https://www.googleapis.com/auth/firebase'
    ])).access_token;
    const previousCutover = process.argv.find(arg => arg.startsWith('--previous-cutover='))?.slice('--previous-cutover='.length);
    const {cutover, priorFreeze} = await deploymentCutover(token, apply, previousCutover);
    const api = (path, method, body) => request(token, firestoreApi + path, method, body);
    const rooms = await snapshotLegacyRooms(api, db, cutover, apply, priorFreeze);
    console.log(JSON.stringify({project, cutover, priorFreeze, mode: apply ? 'applied' : 'preview', rooms}));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
