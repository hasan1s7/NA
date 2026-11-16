import {requestServer,sourceURL} from './common.js';
// Tokens are never available to injected page code, synced to Google, or put in URLs.
chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'}).catch(console.error);
chrome.storage.session.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'}).catch(console.error);
function selectedExcerpt(){
 const selection=window.getSelection();
 const editable=node=>{const el=node?.nodeType===1?node:node?.parentElement;return !!el?.closest('input,textarea,[contenteditable="true"],[role="textbox"]');};
 if(!selection?.rangeCount||!selection.toString().trim())return {error:'Highlight a word or short passage on the page first.'};
 if(editable(selection.anchorNode)||editable(selection.focusNode)||editable(document.activeElement))return {error:'Nabu does not capture text from editable fields. Paste a permitted excerpt yourself.'};
 const text=selection.toString().trim();if(text.length>2000)return {error:'Select 2,000 characters or fewer.'};
 const range=selection.getRangeAt(0),node=range.commonAncestorContainer;
 const el=node.nodeType===1?node:node.parentElement;
 const parent=el?.closest('p,li,blockquote,figcaption,td,h1,h2,h3')||el;
 const full=parent?.textContent||text;const offset=Math.max(0,full.indexOf(text));
 const context=full.slice(Math.max(0,offset-400),Math.max(0,offset-400)+1500).trim();
 const u=new URL(location.href);if(!['http:','https:'].includes(u.protocol))return {error:'Capture a normal HTTP(S) page, not a browser settings page.'};
 const playing=[...document.querySelectorAll('video,audio')].find(x=>!x.paused&&Number.isFinite(x.currentTime));
 return {text,context,sourceUrl:u.href,sourceTitle:document.title.slice(0,300),offsetSeconds:playing?Math.round(playing.currentTime):null};
}
async function captureTab(tabId,replace=false){
 if(!Number.isInteger(tabId))throw new Error('Choose a browser tab first.');
 const old=(await chrome.storage.session.get('draft')).draft||{};
 if(!replace&&!old.acknowledged&&(old.text||old.meaning||old.note))throw new Error('You have an unsaved capture. Save it first, or use Capture highlighted text in the panel to replace it deliberately.');
 const owner=(await chrome.storage.local.get('connection')).connection;const ownerKey=owner?owner.origin+'|'+owner.accountId:'';
 let result;try{[result]=await chrome.scripting.executeScript({target:{tabId},func:selectedExcerpt});}catch{throw new Error('This page cannot be captured, or access expired. Click the Nabu extension icon on the page again, or paste the excerpt.');}
 if(!result?.result||result.result.error)throw new Error(result?.result?.error||'No selection was returned.');
 result.result.sourceUrl=sourceURL(result.result.sourceUrl);
 const currentOwner=(await chrome.storage.local.get('connection')).connection;if((currentOwner?currentOwner.origin+'|'+currentOwner.accountId:'')!==ownerKey)throw new Error('The account connection changed. Capture the selection again.');
 const draft={...old,...result.result,meaning:'',conceptId:'',provider:'',note:'',acknowledged:false,pendingSave:null};
 await chrome.storage.session.set({draft});return draft;
}
chrome.runtime.onInstalled.addListener(()=>{
 chrome.contextMenus.removeAll(()=>chrome.contextMenus.create({id:'nabu-capture',title:'Capture selection in Nabu',contexts:['selection']}));
});
chrome.action.onClicked.addListener(tab=>{chrome.sidePanel.open({tabId:tab.id}).catch(console.error);});
chrome.contextMenus.onClicked.addListener((info,tab)=>{
 if(info.menuItemId!=='nabu-capture')return;
 chrome.sidePanel.open({tabId:tab.id}).catch(console.error);
 captureTab(tab.id).then(()=>chrome.runtime.sendMessage({type:'draft-updated'}).catch(()=>{})).catch(error=>chrome.storage.session.set({captureError:error.message}));
});
chrome.runtime.onMessage.addListener((message,sender,reply)=>{
 if(sender.id!==chrome.runtime.id||!sender.url?.startsWith(chrome.runtime.getURL('')))return false;
 if(!['capture-selection','server-request'].includes(message?.type))return false;
 (async()=>{
  if(message.type==='capture-selection'){const [tab]=await chrome.tabs.query({active:true,lastFocusedWindow:true});return captureTab(tab?.id,message.replace===true);}
  const {connection}=await chrome.storage.local.get('connection');
  return requestServer(connection,message.path,{method:message.method||'GET',body:message.body});
 })().then(data=>reply({ok:true,data})).catch(error=>reply({ok:false,error:error.message||'The action failed.'}));
 return true;
});
