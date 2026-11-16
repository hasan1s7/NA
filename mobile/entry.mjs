import {Capacitor,CapacitorHttp} from '@capacitor/core';
import {App} from '@capacitor/app';
import {Share} from '@capacitor/share';
import {Filesystem,Directory,Encoding} from '@capacitor/filesystem';
import {fileExporter} from './file-export.mjs';
import {createTransport} from './transport.mjs';
import {incomingAppURL} from '../public/nabu-links.js';

// Replaced by esbuild from a validated, nonsecret build configuration.
const apiOrigin=NABU_API_ORIGIN;
if(Capacitor.isNativePlatform()){
 const files=fileExporter({filesystem:Filesystem,share:opts=>Share.share(opts),directory:Directory.Cache,encoding:Encoding.UTF8});
 files.cleanup().catch(()=>{});
 const native={exportFile:files.exportFile,apiOrigin,launchURL:'',share:options=>Share.share(options),minimize:()=>App.minimizeApp(),
  request:apiOrigin?createTransport(apiOrigin,args=>CapacitorHttp.request(args)):async()=>{throw new Error('This build is offline-only. Build it with your HTTPS Nabu API origin to enable accounts.');}};
 Object.defineProperty(window,'NabuNative',{value:native,writable:false});
 const deliver=url=>{
  if(!apiOrigin||!incomingAppURL(url,apiOrigin))return;
  if(window.__nabuReady)window.dispatchEvent(new CustomEvent('nabu-app-url',{detail:url}));else native.launchURL=url;
 };
 // Subscribe before querying the cold-start URL; both cases are handled.
 App.addListener('appUrlOpen',event=>deliver(event.url)).catch(()=>{});
 App.getLaunchUrl().then(result=>result?.url&&deliver(result.url)).catch(()=>{});
 App.addListener('appStateChange',({isActive})=>{if(isActive&&window.__nabuReady)window.dispatchEvent(new Event('nabu-app-resume'));}).catch(()=>{});
 if(Capacitor.getPlatform()==='android')App.addListener('backButton',()=>window.dispatchEvent(new Event('nabu-app-back'))).catch(()=>{});
}
