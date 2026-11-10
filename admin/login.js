import {friendlyAuthError,setBusy} from '../ui.js';
import {ADMIN_LOGIN_ALIAS,accountLabel} from '../auth-identity.js';
const $=id=>document.getElementById(id);
const demo=/^(localhost|127\.0\.0\.1)$/.test(location.hostname)&&new URLSearchParams(location.search).has('demo');
let api,working=false,authVersion=0;
const message=text=>{$('admin-message').textContent=text;};
const studio=()=>{location.href='../?studio=1'+(demo?'&demo':'');};
async function run(fn){
 if(working||!api)return;working=true;
 const restore=setBusy($('admin-main'),true);
 try{await fn();}catch(e){message(friendlyAuthError(e));}finally{working=false;restore();}
}
async function checkAccess(user,redirect=true){
 const version=++authVersion;
 $('admin-login').hidden=!!user;$('admin-signed-in').hidden=!user;
 $('admin-enter').hidden=true;$('admin-refresh').hidden=true;$('admin-verify').hidden=true;
 if(!user){message('');return;}
 $('admin-identity').textContent='Signed in as '+accountLabel(user.email);
 if(!user.emailVerified){message('Verify your email before entering the admin studio.');$('admin-refresh').hidden=false;$('admin-verify').hidden=false;return;}
 message('Checking administrator access…');
 try{
  const role=await api.role();if(version!==authVersion)return;
  if(role==='admin'||role==='instructor'){
   $('admin-enter').hidden=false;message('Access confirmed. Opening your admin studio…');if(redirect)studio();
  }else message('This account does not have administrator access. Use your authorized account, or return to the student entrance.');
 }catch{if(version===authVersion)message('Could not check access. Use another account to sign in again and retry.');}
}
$('admin-google').onclick=()=>run(async()=>{message('Opening Google sign-in…');await api.loginGoogle();$('admin-password').value='';});
$('admin-login').onsubmit=e=>{e.preventDefault();run(async()=>{message('Signing in…');try{await api.loginEmail($('admin-email').value.trim(),$('admin-password').value);}finally{$('admin-password').value='';}});};
$('admin-reset').onclick=()=>run(async()=>{const email=$('admin-email');if(!email.reportValidity())return;await api.resetPassword(email.value.trim());message(email.value.trim().toLowerCase()===ADMIN_LOGIN_ALIAS?'A password link has been sent to kstouras@gmail.com. Check your inbox and spam folder. This resets only the separate admin@admin.com account. Your personal Google account is unchanged.':'If this address has an FFO account, a password link has been sent. Check your inbox and spam folder. If you have not signed in before, use Google first.');});
$('admin-switch').onclick=()=>run(async()=>{await api.logout();$('admin-password').value='';});
$('admin-refresh').onclick=()=>run(async()=>checkAccess(await api.refreshUser()));
$('admin-verify').onclick=()=>run(async()=>{await api.verifyEmail();message('Verification email sent. Open the link, then select “I have verified my email”.');});
$('admin-enter').onclick=()=>run(async()=>checkAccess(api.currentUser()));
try{
 const restore=setBusy($('admin-main'),true);
 try{api=await import(demo?'../backend-demo.js':'../backend.js?v=multi-admin-1');api.observeAuth(u=>{void checkAccess(u);});}finally{restore();}
}catch{message('Secure sign-in could not load. Check your connection and reload this page.');}
