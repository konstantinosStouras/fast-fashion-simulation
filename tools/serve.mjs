import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.ico':'image/x-icon','.woff2':'font/woff2'};
export function createStaticServer(root=process.cwd()){
 root=path.resolve(root);
 return http.createServer(async(req,res)=>{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD'});res.end();return;}
  try{
   const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
   const file=path.resolve(root,'.'+(name.endsWith('/')?name+'index.html':name)),relative=path.relative(root,file);
   if(relative.startsWith('..')||path.isAbsolute(relative)||relative.split(path.sep).some(part=>part.startsWith('.')||part==='node_modules')){res.writeHead(403);res.end();return;}
   const body=await readFile(file);
   res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Content-Length':body.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
   res.end(req.method==='HEAD'?undefined:body);
  }catch{res.writeHead(404);res.end('Not found');}
 });
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 createStaticServer().listen(8791,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:8791'));
}
