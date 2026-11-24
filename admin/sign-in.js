import {friendlyAuthError,setBusy} from '../ui.js';
import {ADMIN_LOGIN_ALIAS,accountLabel} from '../auth-identity.js?v=multi-admin-1';
export function showAdminLogin(root,api,user,restoreAccount){
 root.innerHTML=`<div id="admin-main">
<section class="panel admin-card">
<h1>Admin sign-in</h1>
<p>Sign in with your authorized account.</p>
<form id="admin-login">
<button id="admin-google" class="google" type="button">
<img src="assets/google-g.png" class="google-mark" alt="" width="20" height="20">
<span>Continue with Google</span>
</button>
<p class="divider">or use your email and password</p>
<label>Email<input id="admin-email" type="email" autocomplete="username" value="admin@admin.com" required>
</label>
<label>Password<input id="admin-password" type="password" autocomplete="current-password" required>
</label>
<button id="admin-submit">Sign in to admin →</button>
<button id="admin-reset" class="secondary" type="button">Set or reset password</button>
<p class="hint">Every administrator has a separate account and their own classes. Use admin@admin.com with its password, or sign in with your own authorized email or Google account. Recovery for admin@admin.com goes to the platform owner’s Gmail inbox.</p>
</form>
<div id="admin-signed-in" hidden>
<p id="admin-identity">
</p>
<div class="button-row">
<button id="admin-refresh" class="secondary">I have verified my email</button>
<button id="admin-verify" class="secondary">Resend verification email</button>
<button id="admin-switch" class="secondary">Use another account</button>
</div>
</div>
<p id="admin-message" role="status" aria-live="polite">
</p>
</section>
</div>`;
 const $=id=>root.querySelector('#'+id);
 const status=$('admin-message');
 const message=text=>{status.textContent=text;};
 let working=false;
 async function run(fn){
  if(working)return;working=true;
  const restore=setBusy($('admin-main'),true);
  try{await fn();}catch(e){message(friendlyAuthError(e));}finally{working=false;restore();}
 }
 $('admin-login').hidden=!!user;
 $('admin-signed-in').hidden=!user;
 if(user){
  $('admin-identity').textContent='Signed in as '+accountLabel(user.email);
  $('admin-refresh').hidden=$('admin-verify').hidden=user.emailVerified;
  message(user.emailVerified?'This account does not have administrator access. Use your authorized account, or return to the student entrance.':'Verify your email before entering the admin studio.');
 }
 $('admin-google').onclick=()=>run(async()=>{message('Opening Google sign-in…');const password=$('admin-password');await api.loginGoogle();password.value='';});
 $('admin-login').onsubmit=e=>{e.preventDefault();run(async()=>{const password=$('admin-password');message('Signing in…');try{await api.loginEmail($('admin-email').value.trim(),$('admin-password').value);}finally{password.value='';}});};
 $('admin-reset').onclick=()=>run(async()=>{const email=$('admin-email');if(!email.reportValidity())return;await api.resetPassword(email.value.trim());message(email.value.trim().toLowerCase()===ADMIN_LOGIN_ALIAS?'A password link has been sent to kstouras@gmail.com. Check your inbox and spam folder. This resets only the separate admin@admin.com account. Your personal Google account is unchanged.':'If this address has an FFO account, a password link has been sent. Check your inbox and spam folder. If you have not signed in before, use Google first.');});
 $('admin-switch').onclick=()=>run(async()=>{await api.logout();});
 $('admin-refresh').onclick=()=>run(async()=>restoreAccount(await api.refreshUser()));
 $('admin-verify').onclick=()=>run(async()=>{await api.verifyEmail();message('Verification email sent. Open the link, then select “I have verified my email”.');});
}
