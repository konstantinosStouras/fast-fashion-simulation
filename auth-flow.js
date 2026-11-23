import {normalizeSessionCode,isValidSessionCode} from './session-code.js';

export function sessionCodeFromUrl(href){
 try{
  const params=new URL(href).searchParams;
  const code=normalizeSessionCode(params.get('sessionCode')??params.get('session')??'');
  return isValidSessionCode(code)?code:'';
 }catch{return '';}
}
// Email links can return only to this platform, carrying a validated session code.
export function emailActionSettings(href,action,sessionCode=''){
 const url=new URL('https://www.stouras.com/fast-fashion-simulation/');
 const code=sessionCodeFromUrl(href)||normalizeSessionCode(sessionCode);
 if(isValidSessionCode(code))url.searchParams.set('sessionCode',code);
 else {try{const source=new URL(href);if(source.pathname.includes('/admin/')||source.searchParams.get('studio')==='1')url.searchParams.set('studio','1');}catch{}}
 url.searchParams.set('auth',action==='verify'?'verify':'login');
 return {url:url.href};
}
