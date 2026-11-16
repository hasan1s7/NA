import {spawnSync} from 'node:child_process';
const r=spawnSync(process.env.PYTHON||'python',['tools/configure_native.py',...process.argv.slice(2)],{stdio:'inherit'});
process.exit(r.status|| (r.error?1:0));
