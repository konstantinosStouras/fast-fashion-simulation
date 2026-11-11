// Small interaction helpers shared across browsers and exercised independently.
export function csvCell(value){
 let text=String(value??'');
 // Guard user-supplied text, while retaining real negative numbers as numbers.
 if(typeof value==='string'&&(/^[\s]*[=+@\-]/.test(text)||/^[\t\r\n]/.test(text)))text="'"+text;
 return '"'+text.replace(/"/g,'""')+'"';
}
export function friendlyAuthError(error){
 const messages={
  'auth/requires-recent-login':'For this account change, log out and sign in again, then retry.',
  'auth/operation-not-allowed':'This sign-in or account change method is not enabled. Try Google sign-in or contact your instructor.',
  'profile/invalid':'Please complete your first name, last name and university ID.',
  'auth/popup-blocked':'Your browser blocked Google sign-in. Allow pop-ups for this site, then try again, or use email and password.',
  'auth/popup-closed-by-user':'Google sign-in was cancelled. You can try again or use email and password.',
  'auth/cancelled-popup-request':'A sign-in window is already open. Complete it or close it before trying again.',
  'auth/invalid-credential':'The email or password is incorrect. Try again or reset your password.',
  'auth/wrong-password':'The email or password is incorrect. Try again or reset your password.',
  'auth/user-not-found':'The email or password is incorrect. Try again or create an account.',
  'auth/email-already-in-use':'An account already uses this email. Log in or reset its password.',
  'auth/account-exists-with-different-credential':'This email uses another sign-in method. Log in with the method you used to register.',
  'auth/network-request-failed':'Unable to connect. Check your connection and try again.',
  'auth/too-many-requests':'Too many attempts. Please wait a moment before trying again.',
  'auth/weak-password':'Choose a password with at least 8 characters.',
  'auth/reserved-admin-alias':'admin@admin.com is reserved for administrator sign-in. Use your own email to create or update an account.',
  'auth/invalid-email':'Enter a valid email address.'
 };
 return messages[error?.code]||'Unable to complete sign-in. Please try again.';
}
export function safeStorage(storage){
 return {getItem:key=>{try{return storage().getItem(key);}catch{return null;}},setItem:(key,value)=>{try{storage().setItem(key,value);}catch{}},removeItem:key=>{try{storage().removeItem(key);}catch{}}};
}
export function setBusy(root,busy){
 if(!root)return ()=>{};
 const buttons=Array.from(root.querySelectorAll('button'));
 const states=buttons.map(button=>[button,button.disabled]);
 if(busy){root.setAttribute('aria-busy','true');buttons.forEach(b=>b.disabled=true);}
 return ()=>{root.removeAttribute('aria-busy');states.forEach(([button,disabled])=>{if(button.isConnected)button.disabled=disabled;});};
}
export function revealInvalidField(event){
 const input=event.target;if(!input?.closest)return;
 let details=input.closest('details');while(details){details.open=true;details=details.parentElement?.closest('details');}
}
