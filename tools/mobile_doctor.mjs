import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {validateAPIOrigin} from '../public/nabu-links.js';
let failed=0;
function check(label,ok){console.log((ok?'PASS ':'NEEDS ')+label);if(!ok)failed++;}
check('Node >=22',Number(process.versions.node.split('.')[0])>=22);
const cfg=JSON.parse(fs.readFileSync('capacitor.config.json','utf8'));
check('Bundled webDir; no remote server.url',cfg.webDir==='mobile/www'&&!cfg.server?.url&&!cfg.server?.allowNavigation);
for(const name of ['@capacitor/cli','@capacitor/core','@capacitor/app','@capacitor/share','@capacitor/filesystem','esbuild']){
 try{import.meta.resolve(name);check('Installed '+name,true);}catch{check('Installed '+name,false);}
}
try{validateAPIOrigin(process.env.NABU_API_ORIGIN||'');check('HTTPS account backend configured',true);}catch{check('HTTPS account backend configured (optional for offline-only builds)',false);}
check('Prepared bundled mobile assets',fs.existsSync('mobile/www/index.html'));
check('Android SDK',!!(process.env.ANDROID_HOME||process.env.ANDROID_SDK_ROOT));
check('Java available',spawnSync('java',['-version'],{stdio:'ignore'}).status===0);
check('Xcode (needed only for iOS)',process.platform==='darwin'&&spawnSync('xcodebuild',['-version'],{stdio:'ignore'}).status===0);
console.log('This checks tooling and configuration, not signing, accounts, device persistence or store approval.');
process.exitCode=failed?1:0;
