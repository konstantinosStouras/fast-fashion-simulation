// GitHub Pages serves the checked-in browser files directly from main.
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
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
const backend=await bundle('backend.js','api-bundle.js');
const main=await bundle('main.js','app-bundle.js',backend);
for(const page of ['index.html','admin/index.html']){
 const source=await readFile(path.join(root,page),'utf8');
 await publish(page,source.replace(/(?:main|app-bundle)\.js\?v=[\w-]+/g,main)
  .replace(/(?:backend|api-bundle)\.js\?v=[\w-]+/g,backend));
}
