// Read-only production checks. Never print or persist authorization credentials.
const assert=require('node:assert/strict');
const {readFileSync,writeFileSync,mkdirSync}=require('node:fs');
const {createHash}=require('node:crypto');
const auth=require('firebase-tools/lib/auth');
const normalize=s=>s.replace(/\r\n/g,'\n').trim();
(async()=>{
 const account=auth.getGlobalDefaultAccount();if(!account)throw Error('Firebase CLI login required');
 const credentials=await auth.getAccessToken(account.tokens.refresh_token,['https://www.googleapis.com/auth/cloud-platform','https://www.googleapis.com/auth/firebase']);
 const headers={Authorization:'Bearer '+credentials.access_token};
 async function get(url){const r=await fetch(url,{headers});if(!r.ok)throw Error('Configuration check failed: HTTP '+r.status);return r.json();}
 const release=await get('https://firebaserules.googleapis.com/v1/projects/stouras-ffo/releases/cloud.firestore');
 const ruleset=await get('https://firebaserules.googleapis.com/v1/'+release.rulesetName);
 const source=ruleset.source.files.find(f=>f.name==='firestore.rules')?.content;
 assert.ok(source,'Published Firestore source exists');
 if(process.argv.includes('--capture')){
  mkdirSync('test-results',{recursive:true});writeFileSync('test-results/predeploy-firestore.json',JSON.stringify({release,ruleset},null,2));
  console.log(JSON.stringify({rollbackCaptured:true,ruleset:release.rulesetName}));return;
 }
 assert.equal(normalize(source),normalize(readFileSync('firestore.rules','utf8')),'Published rules must match local release');
 const files=['index.html','main.js','backend.js','competition.js','profile.js','ui.js','admin/index.html','admin/login.js','auth-identity.js','model.js','market.js','studio.js','design.css','ui.css','preview.css','firebase-config.js','assets/google-g.png'];
 const checks=await Promise.all(files.map(async file=>{
  const url='https://www.stouras.com/fast-fashion-simulation/'+file+'?release=qa-20261111';
  const r=await fetch(url,{cache:'no-store'});assert.equal(r.status,200,file);
  const body=Buffer.from(await r.arrayBuffer()),local=readFileSync(file);
  if(file.endsWith('.png'))assert.deepEqual(body,local,file);else assert.equal(normalize(body.toString()),normalize(local.toString()),file);
  return {file,status:r.status,sha256:createHash('sha256').update(body).digest('hex')};
 }));
 for(const suffix of ['','admin/']){const r=await fetch('https://www.stouras.com/fast-fashion-simulation/'+suffix,{cache:'no-store'});assert.equal(r.status,200);assert.match(await r.text(),/v=qa-20261111/);}
 const result={verifiedAt:new Date().toISOString(),ruleset:release.rulesetName,matchingAssets:checks.length,checks};
 writeFileSync('test-results/live-release.json',JSON.stringify(result,null,2));console.log(JSON.stringify({verifiedAt:result.verifiedAt,ruleset:result.ruleset,matchingAssets:checks.length,routes:2}));
})().catch(e=>{console.error(e.message.slice(0,500));process.exitCode=1;});
