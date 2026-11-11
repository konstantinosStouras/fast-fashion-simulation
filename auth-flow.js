export function sessionCodeFromUrl(href){
 try{const code=(new URL(href).searchParams.get('session')||'').replace(/[\s-]/g,'').toUpperCase();return /^[A-Z2-9]{8}$/.test(code)?code:'';}catch{return '';}
}
// Email links can return only to this platform, carrying a validated session ID.
export function emailActionSettings(href,action,sessionCode=''){
 const url=new URL('https://www.stouras.com/fast-fashion-simulation/');
 const code=sessionCodeFromUrl(href)||(/^[A-Z2-9]{8}$/.test(sessionCode)?sessionCode:'');
 if(code)url.searchParams.set('session',code);
 else {try{const source=new URL(href);if(source.pathname.includes('/admin/')||source.searchParams.get('studio')==='1')url.searchParams.set('studio','1');}catch{}}
 url.searchParams.set('auth',action==='verify'?'verify':'login');
 return {url:url.href};
}
