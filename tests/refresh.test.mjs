import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const main=readFileSync('main.js','utf8')
 .replace(/api=await import\(demo\?'\.\/backend-demo\.js':'\.\/backend\.js\?v=[^']+'\)/,'api=globalThis.refreshApi')
 .replace(/from '(\.\/[^']+)'/g,(_,path)=>'from '+JSON.stringify(new URL('../'+path.slice(2),import.meta.url).href));

for(const [file,path,ready] of [
 ['admin/index.html','admin/','#create'],
 ['index.html','?studio=ai','#studio-ai-settings'],
 ['index.html','?studio=teams','#studio-team-directory'],
 ['index.html','?view=profile#profile-security','#profile-form'],
 ['index.html','?view=join','#join']
]){
 test('refresh restores '+path+' after a delayed account check',async()=>{
  const w=new JSDOM(readFileSync(file,'utf8'),{url:'https://example.test/fast-fashion-simulation/'+path}).window;
  try{
   for(const key of ['document','location','localStorage','sessionStorage','FormData'])globalThis[key]=w[key];
   globalThis.addEventListener=w.addEventListener.bind(w);
   const api=await import('../backend-demo.js');
   await api.loginGoogle();
   w.localStorage.setItem('ff:session:'+api.currentUser().uid,'OLDROOM');
   let deliver,release,releaseProfile,roleReads=0,profileReads=0;
   const reads=[];
   const methods=['listSessions','getDefaults','getDefaultTeamComposition','listTeamUsers','getAiSettings'];
   globalThis.refreshApi={...api,observeAuth:callback=>{deliver=callback;},
    role:()=>{roleReads++;return new Promise(resolve=>{release=resolve;});},
    getProfile:()=>{profileReads++;return new Promise(resolve=>{releaseProfile=()=>resolve(api.getProfile());});},
    ...Object.fromEntries(methods.map(method=>[method,(...args)=>{reads.push(method);return api[method](...args); }]))};
   const address=w.location.href;
   const loading=()=>{for(const id of ['admin-login','enter','join','create'])assert.equal(w.document.getElementById(id),null);};
   loading();
   await import('data:text/javascript;base64,'+Buffer.from(main+'\n// '+path).toString('base64'));
   loading();
   const pending=deliver(api.currentUser());loading();
   assert.deepEqual(reads,[]);
   release('admin');await new Promise(resolve=>setImmediate(resolve));
   const expected=path==='admin/'?['listSessions','getDefaults']:path==='?studio=ai'?['getAiSettings']:
    path==='?studio=teams'?['listSessions','getDefaultTeamComposition','listTeamUsers']:[];
   assert.deepEqual([...reads].sort(),expected.toSorted(),'requested page reads overlap the pending profile read');
   loading();releaseProfile();await pending;
   assert.ok(w.document.querySelector(ready));assert.equal(w.location.href,address);
   for(const method of expected)assert.equal(reads.filter(read=>read===method).length,1);
   assert.equal(roleReads,1);assert.equal(profileReads,1);
  }finally{w.close();}
 });
}
