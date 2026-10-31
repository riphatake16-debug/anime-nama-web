import {defineConfig} from 'vite';
import {readFileSync, mkdirSync, copyFileSync, writeFileSync, readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const scanAssets=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(entry=>
  entry.isFile()?['assets/'+entry.name]:[]);

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
      const files=['index.html','data/home.json','manifest.webmanifest','favicon.svg',
        ...scanAssets(path.join(current,'dist/assets'))];
      for(const filename of ['favicon.svg','manifest.webmanifest',
        'icons/icon-192.png','icons/icon-512.png','icons/apple-touch-icon.png',
        'vazirmatn.woff2']){
        const from=path.resolve(current,'../'+filename);
        const to=path.resolve(current,'dist/'+filename);
        mkdirSync(path.dirname(to),{recursive:true});
        copyFileSync(from,to);
      }
      writeFileSync(path.join(current,'dist/assets-manifest.json'),JSON.stringify(files));
    }
  }]
});
