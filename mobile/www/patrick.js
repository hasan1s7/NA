(() => {
  'use strict';
  const KEY = 'nabu:patrick-profile-draft:v1';
  const fields = ['headline','summary','education','experience','projects','papers','languages','website','email'];
  const defaults = {schemaVersion:1,name:'Patrick Pieper',headline:'Co-founder of Nabu'};
  const form = document.querySelector('#profile-form');
  const status = document.querySelector('#draft-status');
  const editor = document.querySelector('#editor');
  let published = defaults;
  let hasDraft = false;
  let editing = false;
  const message = (text,error=false) => {status.textContent=text;status.classList.toggle('error',error);};
  function normalize(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid profile');
    const result = {...defaults};
    for (const key of fields) result[key] = typeof data[key] === 'string' ? data[key].trim().slice(0,Number(form.elements[key].maxLength)) : (defaults[key] || '');
    return result;
  }
  function safeWebsite(value) {
    try {const url=new URL(value);return ['https:','http:'].includes(url.protocol)&&!url.username&&!url.password ? url.href : '';} catch {return '';}
  }
  function collect() {return normalize(Object.fromEntries(fields.map(k=>[k,form.elements[k].value])));}
  function populate(profile) {for(const key of fields)form.elements[key].value=profile[key]||'';}
  function render(profile, draft=false) {
    document.querySelector('#profile-headline').textContent=profile.headline||'Co-founder of Nabu';
    document.querySelector('#profile-summary').textContent=profile.summary||'Patrick’s full profile is coming soon.';
    document.querySelector('#draft-banner').hidden=!draft;
    const container=document.querySelector('#profile-sections');container.replaceChildren();
    for(const [key,label] of [['education','Education'],['experience','Experience'],['projects','Projects'],['papers','Papers and writing'],['languages','Languages and interests']]) {
      if(!profile[key])continue;
      const section=document.createElement('section');section.className='profile-block';
      const title=document.createElement('h2');title.textContent=label;
      const body=document.createElement('p');body.textContent=profile[key];section.append(title,body);container.append(section);
    }
    const contact=document.querySelector('#profile-contact');contact.replaceChildren();
    const website=safeWebsite(profile.website);
    if(website){const a=document.createElement('a');a.href=website;a.textContent='Website';a.rel='noopener noreferrer';contact.append(a);}
    if(/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(profile.email||'')){
      const a=document.createElement('a');a.href='mailto:'+encodeURIComponent(profile.email);a.textContent=profile.email;contact.append(a);
    }
  }
  function save() {
    try {localStorage.setItem(KEY,JSON.stringify(collect()));hasDraft=true;message('Draft saved on this device. Your public page has not changed.');return true;}
    catch {message('This browser could not save the draft. Download your profile to keep a copy.',true);return false;}
  }
  function showEditor() {editor.hidden=false;document.querySelector('#edit-profile').setAttribute('aria-expanded','true');}
  document.querySelector('#edit-profile').addEventListener('click',()=>{showEditor();editor.scrollIntoView({behavior:'smooth'});form.elements.headline.focus({preventScroll:true});});
  form.addEventListener('input',()=>{editing=true;message('Unsaved changes. Save a draft or download your profile.');});
  form.addEventListener('submit',event=>{event.preventDefault();save();});
  document.querySelector('#preview-profile').addEventListener('click',()=>{render(collect(),true);document.querySelector('#main').focus();window.scrollTo({top:0,behavior:'smooth'});});
  document.querySelector('#show-published').addEventListener('click',()=>render(published,false));
  document.querySelector('#download-profile').addEventListener('click',()=>{
    if(!form.reportValidity())return;
    const profile=collect();
    if(profile.website&&!safeWebsite(profile.website)){message('Use a complete http:// or https:// website address.',true);form.elements.website.focus();return;}
    const saved=save();
    const url=URL.createObjectURL(new Blob([JSON.stringify(profile,null,2)+'\n'],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download='patrick-profile.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    message('Profile download started. Send patrick-profile.json to Hasan to update your public page.'+(saved?'':' Your browser could not save a local draft.'));
  });
  populate(defaults);
  try {const raw=localStorage.getItem(KEY);if(raw){populate(normalize(JSON.parse(raw)));hasDraft=true;message('Saved draft restored on this device. It is not public.');}}
  catch {message('The saved draft could not be opened. You can start a new draft below.',true);}
  if(['#edit','#editor'].includes(location.hash))showEditor();
  window.addEventListener('hashchange',()=>{if(['#edit','#editor'].includes(location.hash))showEditor();});
  fetch('./patrick-profile.json',{cache:'no-store'}).then(response=>{if(!response.ok)throw new Error('Profile unavailable');return response.json();}).then(data=>{
    published=normalize(data);render(published);if(!hasDraft&&!editing)populate(published);
  }).catch(()=>{document.querySelector('#public-status').textContent='The published profile could not be loaded. You can still prepare and download a draft.';});
})();
