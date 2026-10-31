import {defineConfig} from 'vite';
import {readFileSync, mkdirSync, copyFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const current=path.dirname(fileURLToPath(import.meta.url));
const originalSnapshot=path.resolve(current,'../data/home.json');
const previewSnapshot=path.resolve(current,'dist/data/home.json');

export default defineConfig({
  base:'/anime-nama-web/',
  build:{outDir:'dist',emptyOutDir:true,assetsDir:'assets'},
  plugins:[{
    name:'local-public-data-only',
    configureServer(server){
      server.middlewares.use((req,res,next)=>{
        const pathname=new URL(req.url,'http://localhost').pathname;
        if(pathname!=='/anime-nama-web/data/home.json')return next();
        try{
          const data=readFileSync(originalSnapshot);
          res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
          res.end(data);
        }catch{
          res.writeHead(503,{'Content-Type':'application/json'});
          res.end(JSON.stringify({error:'Public snapshot is not available'}));
        }
      });
    },
    closeBundle(){
      mkdirSync(path.dirname(previewSnapshot),{recursive:true});
      copyFileSync(originalSnapshot,previewSnapshot);
    }
  }]
});
