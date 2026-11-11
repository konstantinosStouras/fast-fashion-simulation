// Apply before styles paint, then keep the visible control and saved preference in sync.
(()=>{
 const key='ff:theme',root=document.documentElement;
 const media=globalThis.matchMedia?.('(prefers-color-scheme: dark)');
 let preference;
 try{preference=localStorage.getItem(key);}catch{}
 const valid=value=>value==='light'||value==='dark';
 function apply(theme){
  root.dataset.theme=theme;
  const button=document.getElementById('theme-toggle');
  if(button){
   const next=theme==='dark'?'light':'dark';
   button.textContent=document.getElementById('account')?(theme==='dark'?'☀':'☾'):(theme==='dark'?'☀ Light theme':'☾ Dark theme');
   button.setAttribute('aria-label','Switch to '+next+' theme');
   button.title='Switch to '+next+' theme';
  }
 }
 apply(valid(preference)?preference:media?.matches?'dark':'light');
 document.addEventListener('DOMContentLoaded',()=>{
  apply(root.dataset.theme);
  document.getElementById('theme-toggle')?.addEventListener('click',()=>{
   preference=root.dataset.theme==='dark'?'light':'dark';
   try{localStorage.setItem(key,preference);}catch{}
   apply(preference);
  });
 });
 media?.addEventListener?.('change',()=>{if(!valid(preference))apply(media.matches?'dark':'light');});
 globalThis.addEventListener('storage',event=>{
  if(event.key===key){preference=event.newValue;apply(valid(preference)?preference:media?.matches?'dark':'light');}
 });
})();
