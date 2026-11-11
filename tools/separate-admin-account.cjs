// One-time, project-scoped migration. Secrets stay in memory and are never logged or written.
// Default is a read-only plan. --apply preserves the dedicated account UID and gives it
// the platform password most recently set while admin@admin.com was the owner's alias.
const auth=require('firebase-tools/lib/auth');
const PROJECT='stouras-ffo',OWNER='kstouras@gmail.com',RECOVERY='kstouras+ffo-admin@gmail.com';
const OWNER_UID='0FtCFaCCi1ShwFcOZo8DhtUiE5t2',ADMIN_UID='yZga6bu2k0XN0ysNP6G9KQQLvuy2';
(async()=>{
 const account=auth.getGlobalDefaultAccount();if(!account)throw Error('Firebase CLI login required');
 const credentials=await auth.getAccessToken(account.tokens.refresh_token,['https://www.googleapis.com/auth/cloud-platform','https://www.googleapis.com/auth/firebase']);
 const headers={Authorization:'Bearer '+credentials.access_token,'Content-Type':'application/json'};
 async function request(url,method='GET',body){const r=await fetch(url,{method,headers,body:body?JSON.stringify(body):undefined});if(!r.ok)throw Error('Firebase request failed: HTTP '+r.status);return r.json();}
 const base=`https://identitytoolkit.googleapis.com/v1/projects/${PROJECT}`;
 const cfg=await request(`https://identitytoolkit.googleapis.com/admin/v2/projects/${PROJECT}/config`);
 const all=await request(base+'/accounts:batchGet?maxResults=100');
 if(all.nextPageToken)throw Error('Unexpected account count; inspect before migration');
 const owner=all.users.find(u=>u.localId===OWNER_UID),dedicated=all.users.find(u=>u.localId===ADMIN_UID);
 if(owner?.email!==OWNER||!owner.emailVerified||!owner.passwordHash||!owner.salt)throw Error('Expected verified owner with a password is missing');
 if(!dedicated||!['admin@admin.com',RECOVERY].includes(dedicated.email))throw Error('Expected dedicated account is missing or changed');
 if(dedicated.mfaInfo?.length||dedicated.providerUserInfo?.some(p=>p.providerId!=='password'))throw Error('Dedicated account has additional credentials; inspect before migration');
 if(all.users.some(u=>u.email===RECOVERY&&u.localId!==ADMIN_UID))throw Error('Recovery address is already in use');
 const plan={project:PROJECT,ownerUid:OWNER_UID,independentAdminUid:ADMIN_UID,login:'admin@admin.com',recovery:RECOVERY,preserveExistingSessions:true,copyRecentlySetPlatformPassword:dedicated.email!==RECOVERY};
 if(!process.argv.includes('--apply')){console.log(JSON.stringify(plan,null,2));return;}
 if(dedicated.email!==RECOVERY){
  const hash=cfg.signIn?.hashConfig;if(hash?.algorithm!=='SCRYPT'||!hash.signerKey)throw Error('Firebase scrypt migration configuration unavailable');
  const user={localId:ADMIN_UID,email:RECOVERY,emailVerified:true,displayName:'Administrator',passwordHash:owner.passwordHash,salt:owner.salt,createdAt:dedicated.createdAt,disabled:!!dedicated.disabled};
  for(const key of ['validSince','lastLoginAt','phoneNumber','photoUrl'])if(dedicated[key])user[key]=dedicated[key];
  if(dedicated.customAttributes)user.customAttributes=dedicated.customAttributes;
  const imported=await request(base+'/accounts:batchCreate','POST',{users:[user],hashAlgorithm:'SCRYPT',signerKey:hash.signerKey,saltSeparator:hash.saltSeparator,rounds:hash.rounds,memoryCost:hash.memoryCost,sanityCheck:true,allowOverwrite:true});
  if(imported.error?.length)throw Error('Account import rejected; no successful migration was confirmed');
 }
 await request(`https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/instructors/${encodeURIComponent(RECOVERY)}`,'PATCH',{fields:{createdAt:{timestampValue:new Date().toISOString()}}});
 const verified=await request(base+'/accounts:lookup','POST',{localId:[OWNER_UID,ADMIN_UID]});
 const original=verified.users.find(u=>u.localId===OWNER_UID),separate=verified.users.find(u=>u.localId===ADMIN_UID);
 if(original?.email!==OWNER||separate?.email!==RECOVERY||!separate.emailVerified)throw Error('Post-migration account verification failed');
 console.log(JSON.stringify({...plan,applied:true,ownerGoogleProvider:original.providerUserInfo?.some(p=>p.providerId==='google.com'),separatePasswordProvider:separate.providerUserInfo?.some(p=>p.providerId==='password')},null,2));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
