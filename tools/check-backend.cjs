// Read-only deployment checks using existing Firebase CLI authorization.
const auth=require('firebase-tools/lib/auth');
(async()=>{const account=auth.getGlobalDefaultAccount();if(!account)throw Error('Firebase CLI login required');const credentials=await auth.getAccessToken(account.tokens.refresh_token,['https://www.googleapis.com/auth/cloud-platform','https://www.googleapis.com/auth/firebase']);const headers={Authorization:'Bearer '+credentials.access_token};
async function get(url){const r=await fetch(url,{headers});if(!r.ok)throw Error('Backend check failed: HTTP '+r.status);return r.json();}
const cfg=await get('https://identitytoolkit.googleapis.com/admin/v2/projects/stouras-ucd-blog/config');
const providers=await get('https://identitytoolkit.googleapis.com/admin/v2/projects/stouras-ucd-blog/defaultSupportedIdpConfigs');
const rules=await get('https://firebaserules.googleapis.com/v1/projects/stouras-ucd-blog/releases/cloud.firestore/fashion-futures');
const defaultRules=await get('https://firebaserules.googleapis.com/v1/projects/stouras-ucd-blog/releases/cloud.firestore');
console.log(JSON.stringify({authorizedProductionDomain:cfg.authorizedDomains?.includes('www.stouras.com'),emailPasswordEnabled:cfg.signIn?.email?.enabled,googleEnabled:providers.defaultSupportedIdpConfigs?.find(p=>p.name.endsWith('/google.com'))?.enabled,namedDatabaseRules:rules.name,isolatedRuleset:rules.rulesetName!==defaultRules.rulesetName},null,2));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
