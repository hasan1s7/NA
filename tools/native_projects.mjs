/** Initialize official Capacitor projects. Run on a machine with its SDK. */
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
const selected=process.argv[2]||'android';
if(!['ios','android'].includes(selected))throw new Error('Use npm run mobile:init -- ios or android.');
if(selected==='ios'&&process.platform!=='darwin')throw new Error('Generate and build the iOS project on macOS with Xcode.');
function run(command,args){const r=spawnSync(command,args,{stdio:'inherit',shell:process.platform==='win32'});if(r.status!==0)process.exit(r.status||1);}
run('node',['tools/prepare_mobile.mjs']);
if(!fs.existsSync(selected))run('npx',['--no-install','cap','add',selected]);
run('npx',['--no-install','cap','sync',selected]);
run('node',['tools/configure_native.mjs',selected]);
console.log('Native project prepared. Open '+selected+' in its IDE, configure signing and test on a device.');
