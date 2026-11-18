/** Build bundled web assets; never use Capacitor server.url in a release. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {validateAPIOrigin} from '../public/nabu-links.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
process.chdir(root);
const origin=validateAPIOrigin(process.env.NABU_API_ORIGIN||'',{allowEmpty:true});
if(process.argv.includes('--release')&&!origin)throw new Error('A release build requires NABU_API_ORIGIN=https://your-fullstack-host.');
let build;try{({build}=await import('esbuild'));}catch{throw new Error('Install pinned dependencies with npm install before preparing mobile builds.');}
const generated=spawnSync(process.env.PYTHON||'python',['tools/build_standalone.py'],{stdio:'inherit'});
if(generated.status!==0)process.exit(generated.status||1);
const result=await build({entryPoints:['mobile/entry.mjs'],bundle:true,write:false,format:'iife',platform:'browser',target:['es2020'],minify:true,legalComments:'none',define:{NABU_API_ORIGIN:JSON.stringify(origin)}});
const bridge=result.outputFiles[0].text;
if(bridge.toLowerCase().includes('</script'))throw new Error('Unsafe script delimiter in mobile bridge.');
let html=await fs.readFile('public/index.html','utf8');
const hash="'sha256-"+crypto.createHash('sha256').update(bridge).digest('base64')+"'";
html=html.replace("script-src 'self' ","script-src 'self' "+hash+' ');
html=html.replace('<script id="nabu-startup-guard">','<script id="nabu-native-bridge">'+bridge+'</script>\n<script id="nabu-startup-guard">');
html=html.replace('<!--NABU_BASE-->','<base href="/">');
// Service workers never run inside the native shell. All core assets are local.
html=html.replace(/<link rel="manifest"[^>]+>/,'');
await fs.mkdir('mobile/www',{recursive:true});
await fs.writeFile('mobile/www/index.html',html);
await fs.cp('public/icons','mobile/www/icons',{recursive:true});
const staticFiles = ['nabu-icon.svg', 'nabu-repair.html', 'nabu-scribe.svg', 'about.html', 'about.css',
  'patrick.html', 'patrick.js', 'patrick-profile.json', 'capture-demo.html', 'capture-reels-demo.mp4',
  'nabu-3-walkthrough.mp4', 'nabu-3-walkthrough.vtt'];
for (const name of staticFiles) await fs.copyFile(path.join('public', name), path.join('mobile/www', name));
await fs.writeFile('mobile/build-info.json',JSON.stringify({version:JSON.parse(await fs.readFile('package.json','utf8')).version,apiOrigin:origin,offlineOnly:!origin,bundled:true},null,2)+'\n');
console.log('Bundled mobile app prepared. '+(origin?'API origin configured.':'Offline-only build: accounts require NABU_API_ORIGIN.'));
