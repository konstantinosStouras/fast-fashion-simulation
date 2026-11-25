// GitHub Pages serves the checked-in browser files directly from main.
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';

const root=fileURLToPath(new URL('../',import.meta.url));
const check=process.argv.includes('--check');
async function publish(name,text){
 const file=path.join(root,name);
 const previous=await readFile(file,'utf8').catch(()=>null);
 if(previous?.replaceAll('\r\n','\n')===text.replaceAll('\r\n','\n'))return;
 if(check)throw Error(name+' needs rebuilding. Run npm run build.');
 await writeFile(file,text);
}
async function bundle(entry,output,backendUrl){
 const result=await build({absWorkingDir:root,entryPoints:[entry],bundle:true,format:'esm',tsconfigRaw:{},
  target:'es2022',minify:true,write:false,external:['https://*'],
  plugins:[{name:'browser-imports',setup(builder){
   builder.onResolve({filter:/^\.\.?\//},args=>{
    const [name]=args.path.split('?');
    // Keep the early startup and snapshot modules shared with the HTML.
    if(['./studio-network.js','./studio-memory.js','./backend-demo.js'].includes(name))
     return {path:args.path,external:true};
    if(backendUrl&&name==='./backend.js')return {path:'./'+backendUrl,external:true};
    return {path:path.resolve(args.resolveDir,name)};
   });
  }}]});
 const text=result.outputFiles[0].text;
 await publish(output,text);
 return output+'?v='+createHash('sha256').update(text).digest('hex').slice(0,16);
}
// Build the Firebase clients together so the lightweight startup and full
// backend use the same Firebase app, authentication state and SDK modules.
const outdir='assets/studio';
const sdk=await build({absWorkingDir:root,entryPoints:['studio-auth.js','studio-network.js','backend.js'],outdir,
 entryNames:'[name]-[hash]',chunkNames:'shared-[hash]',bundle:true,splitting:true,format:'esm',platform:'browser',
 preserveSymlinks:true,target:'es2022',tsconfigRaw:{},minify:true,legalComments:'eof',write:false,metafile:true,
 plugins:[{name:'locked-firebase-sdk',setup(b){
  b.onResolve({filter:/^https:\/\/www\.gstatic\.com\/firebasejs\/12\.5\.0\/firebase-/},args=>{
   const name=args.path.split('/').at(-1).slice('firebase-'.length,-3).replace('firestore-lite','firestore/lite');
   return b.resolve('firebase/'+name,{kind:args.kind,resolveDir:root});
  });
  b.onResolve({filter:/^\.\.?\/.*\?v=/},args=>({path:path.resolve(args.resolveDir,args.path.split('?')[0])}));
 }}]});
if(!check)await mkdir(path.join(root,outdir),{recursive:true});
for(const file of sdk.outputFiles)await publish(path.relative(root,file.path),file.text);
const outputs=Object.entries(sdk.metafile.outputs);
const asset=entry=>outputs.find(([,output])=>output.entryPoint===entry)[0];
const backend=asset('backend.js'),auth=asset('studio-auth.js'),network=asset('studio-network.js');
// Tabs open during the rollout can still import the old backend entry.
await publish('api-bundle.js',`export * from './${backend}';\n`);
const main=await bundle('main.js','app-bundle.js',backend);
for(const page of ['index.html','admin/index.html']){
 const source=await readFile(path.join(root,page),'utf8');
 const preload=`/* studio-preloads */\n   for(const href of ${JSON.stringify(outputs.filter(([,o])=>!o.entryPoint).map(([name])=>name))}){const link=document.createElement('link');link.rel='modulepreload';link.fetchPriority='high';link.href=href;document.head.append(link);}\n   /* end-studio-preloads */`;
 await publish(page,source.replace(/(?:main|app-bundle)\.js\?v=[\w-]+/g,main)
  .replace(/(?:backend|api-bundle)\.js\?v=[\w-]+|assets\/studio\/backend-[\w-]+\.js/g,backend)
  .replace(/studio-auth\.js|assets\/studio\/studio-auth-[\w-]+\.js/g,auth)
  .replace(/studio-network\.js\?v=[\w-]+|assets\/studio\/studio-network-[\w-]+\.js/g,network)
  .replace(/\/\* studio-preloads \*\/(?:[\s\S]*?\/\* end-studio-preloads \*\/)?/,preload));
}
