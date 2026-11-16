/** Share an explicit user-requested backup through the device's share sheet.
 * Files stay in app-private cache during handoff; cleanup after 5 minutes or
 * next cold start. They are never written to an automatically synced folder.
 */
export function fileExporter({filesystem,share,directory,encoding,schedule=setTimeout,id=()=>crypto.randomUUID()}) {
 const prefix='nabu-export-';
 async function cleanup(){
  const listing=await filesystem.readdir({path:'',directory});
  for(const item of listing.files||[])if(item.name.startsWith(prefix))await filesystem.deleteFile({path:item.name,directory}).catch(()=>{});
 }
 async function exportFile(filename,value){
  if(!/^[a-zA-Z0-9_.-]{1,100}$/.test(filename)||filename.includes('..'))throw new Error('Invalid export filename.');
  if(typeof value!=='string'||value.length>16*1024*1024)throw new Error('The mobile export exceeds the 16 MB pilot limit.');
  const path=prefix+id()+'-'+filename;
  const result=await filesystem.writeFile({path,data:value,directory,encoding});
  if(!result.uri)throw new Error('The device did not return an export file.');
  try {await share({title:'Nabu export',files:[result.uri],dialogTitle:'Save your private Nabu export'});}
  finally{schedule(()=>{filesystem.deleteFile({path,directory}).catch(()=>{});},300000);}
 }
 return {exportFile,cleanup};
}
