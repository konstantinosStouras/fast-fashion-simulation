export const ADMIN_LOGIN_ALIAS='admin@admin.com';
// A dedicated Firebase account, with recovery delivered to the platform owner's inbox.
// This is a different Firebase UID from the owner's Google account.
export const ADMIN_ACCOUNT_EMAIL='kstouras+ffo-admin@gmail.com';
export function loginEmailAddress(email){
 const address=email.trim().toLowerCase();
 return address===ADMIN_LOGIN_ALIAS?ADMIN_ACCOUNT_EMAIL:address;
}
export const accountLabel=email=>email===ADMIN_ACCOUNT_EMAIL?ADMIN_LOGIN_ALIAS:email;
export function assertAccountEmail(email){
 if([ADMIN_LOGIN_ALIAS,ADMIN_ACCOUNT_EMAIL].includes(email.trim().toLowerCase())){
  const error=new Error('This address is reserved for administrator sign-in.');
  error.code='auth/reserved-admin-alias';throw error;
 }
}
