import {ADMIN_EMAIL} from './firebase-config.js';

export const ADMIN_LOGIN_ALIAS='admin@admin.com';
// An input alias only: Firebase still authenticates and authorizes the original UID.
export function loginEmailAddress(email){
 const address=email.trim().toLowerCase();
 return address===ADMIN_LOGIN_ALIAS?ADMIN_EMAIL:address;
}
export function assertAccountEmail(email){
 if(email.trim().toLowerCase()===ADMIN_LOGIN_ALIAS){
  const error=new Error('This address is reserved for administrator sign-in.');
  error.code='auth/reserved-admin-alias';throw error;
 }
}
