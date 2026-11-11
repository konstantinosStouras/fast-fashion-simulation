import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {DEFAULT_CONFIG} from '../model.js';

test('reset feedback and sign-in preserve the requested class over a saved game',async t=>{
 const dom=new JSDOM(readFileSync('index.html','utf8'),{url:'http://localhost:8791/?demo&session=demo-aaac&auth=login',pretendToBeVisual:true}),w=dom.window;
 for(const k of ['document','location','localStorage','sessionStorage','FormData'])globalThis[k]=w[k];globalThis.addEventListener=w.addEventListener.bind(w);
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 const $=s=>w.document.querySelector(s),click=s=>$(s).click(),submit=s=>$(s).dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
 const wait=async fn=>{for(let i=0;i<200;i++){await new Promise(r=>setTimeout(r,10));if(fn())return;}throw Error(w.document.body.textContent.slice(-1200));};
 const api=await import('../backend-demo.js');let failReset=false,failSession=false,failProfile=false,joinCalls=0;globalThis.__authTestApi={...api,getProfile:()=>failProfile?Promise.reject({code:'unavailable'}):api.getProfile(),joinSession:(...args)=>{joinCalls++;return api.joinSession(...args);},watchSession:(code,fn,error,...rest)=>{if(failSession){queueMicrotask(()=>error({code:'unavailable'}));return ()=>{};}return api.watchSession(code,fn,error,...rest);},loginEmail:(email,password)=>password==='wrong'?Promise.reject({code:'auth/invalid-credential'}):api.loginEmail(email,password),resetPassword:email=>failReset?Promise.reject({code:'auth/network-request-failed'}):api.resetPassword(email)};t.after(async()=>{await api.logout();await new Promise(r=>setTimeout(r,20));w.close();});
 await api.loginEmail('returner@example.test');const old=await api.createSession('Previous game',DEFAULT_CONFIG),target=await api.createSession('Requested class',DEFAULT_CONFIG);await api.joinSession(old,'Returner');w.localStorage.setItem('ff:session:'+api.currentUser().uid,old);await api.logout();
 let source=readFileSync('main.js','utf8').replace(/api=await import\(demo\?'\.\/backend-demo\.js':'\.\/backend\.js\?v=[^']+'\)/,"api=globalThis.__authTestApi");source=source.replace(/from '(\.\/[^']+)'/g,(_,p)=>'from '+JSON.stringify(new URL('../'+p.slice(2),import.meta.url).href));await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));await wait(()=>$('#auth').open);assert.match($('#auth-context').textContent,new RegExp(target));
 $('#email').value='returner@example.test';click('[data-auth=reset]');assert.equal($('#password').required,false);failReset=true;submit('#auth-form');await wait(()=>$('#auth-error').textContent.includes('Unable to connect'));assert.equal($('#email').value,'returner@example.test');failReset=false;submit('#auth-form');await wait(()=>$('#auth-status').textContent.includes('spam folder'));
 assert.equal($('#auth-error').textContent,'');assert.equal($('#email').value,'returner@example.test');assert.match($('#auth-context').textContent,new RegExp(target));
 click('[data-auth=login]');$('#password').value='wrong';submit('#auth-form');await wait(()=>$('#auth-error').textContent.includes('incorrect'));assert.match($('#auth-context').textContent,new RegExp(target));$('#password').value='SyntheticDemoOnly';submit('#auth-form');await wait(()=>$('#join'));
 assert.equal($('#session-code').value,target);assert.equal($('#leave'),null,'new session link must not open the previous game');
 submit('#join');await wait(()=>$('#leave'));assert.equal($('h1').textContent,'Requested class');
 w.localStorage.setItem('ff:session:'+api.currentUser().uid,old); // Another tab enters an older game; this tab keeps its own session.
 await api.logout();await wait(()=>$('#open-login'));w.history.replaceState({},'', '/?demo');failSession=true;await api.loginEmail('returner@example.test');await wait(()=>$('#retry-session'));assert.equal(w.localStorage.getItem('ff:session:'+api.currentUser().uid),target);assert.equal(joinCalls,1,'resume must not require a join write');failSession=false;click('#retry-session');await wait(()=>$('#leave'));assert.equal($('h1').textContent,'Requested class','plain login resumes the account-specific session');
 await api.logout();await wait(()=>$('#open-login'));failProfile=true;await api.loginEmail('returner@example.test');await wait(()=>$('#retry-account'));assert.equal(w.localStorage.getItem('ff:session:'+api.currentUser().uid),target);failProfile=false;w.dispatchEvent(new w.Event('online'));await wait(()=>$('#leave'));assert.equal($('h1').textContent,'Requested class');
 await api.logout();await wait(()=>$('#open-login'));w.history.replaceState({},'', '/?demo&session=bad');await api.loginEmail('returner@example.test');await wait(()=>$('#join-status')?.textContent.includes('invalid'));assert.equal($('#leave'),null);
 // A verification return refreshes server-backed state before offering entry.
 await api.logout();await wait(()=>$('#open-login'));w.history.replaceState({},'', '/?demo&session=demo-aaac&auth=verify');await api.loginEmail('returner@example.test');await wait(()=>$('#leave'));assert.equal($('h1').textContent,'Requested class','verification return resumes the already joined class in this tab');
});
