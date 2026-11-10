// Read-only: reports account metadata and whether an in-memory migration is possible.
const auth=require('firebase-tools/lib/auth');
(async()=>{
 const account=auth.getGlobalDefaultAccount();if(!account)throw Error('Firebase CLI login required');
 const credentials=await auth.getAccessToken(account.tokens.refresh_token,['https://www.googleapis.com/auth/cloud-platform','https://www.googleapis.com/auth/firebase']);
 const headers={Authorization:'Bearer '+credentials.access_token};
 async function get(url){const r=await fetch(url,{headers});if(!r.ok)throw Error('Read failed: HTTP '+r.status);return r.json();}
 const cfg=await get('https://identitytoolkit.googleapis.com/admin/v2/projects/stouras-ffo/config');
 const result=await get('https://identitytoolkit.googleapis.com/v1/projects/stouras-ffo/accounts:batchGet?maxResults=100');
 console.log(JSON.stringify({hashConfigAvailable:!!cfg.signIn?.hashConfig,hashConfigKeys:Object.keys(cfg.signIn?.hashConfig||{}),accounts:result.users.filter(u=>['kstouras@gmail.com','kstouras+ffo-admin@gmail.com','admin@admin.com'].includes(u.email)).map(u=>({uid:u.localId,email:u.email,verified:u.emailVerified,hasPassword:!!u.passwordHash,hasSalt:!!u.salt,providers:u.providerUserInfo?.map(p=>p.providerId)}))},null,2));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
