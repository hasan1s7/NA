import {createAssignmentOutbox} from './nabu-assignment-outbox.js';

/** Optional workspace controls inside the existing modal. No learner history is
 * queried or uploaded, and no third-party provider receives assignment text. */
export function createWorkspaceUI({api,getUser,getMeta,mutateMeta,showModal,closeModal,download,escapeHTML:E,uid,document:doc=globalThis.document}){
 let active=false,epoch=0,tenant=null,workspace=null,record=null,authoring=null,members=[],lastReplay=null,reporting=null;
 const owner=()=>getUser()?.id||'';
 const outbox=createAssignmentOutbox({getMeta,mutateMeta,getAccount:owner,request:api});
 const endpoint=suffix=>'workspaces/'+encodeURIComponent(tenant)+suffix;
 const button=(action,label,attrs='')=>`<button class="button secondary" type="button" data-ws-action="${action}" ${attrs}>${E(label)}</button>`;
 const input=(name,label,value='',type='text',extra='')=>`<label class="ws-field">${E(label)}<input class="input" name="${name}" type="${type}" value="${E(value)}" ${extra}></label>`;
 const area=(name,label,value='',extra='')=>`<label class="ws-field">${E(label)}<textarea class="input" name="${name}" dir="auto" ${extra}>${E(value)}</textarea></label>`;
 const select=(name,label,options)=>`<label class="ws-field">${E(label)}<select class="select" name="${name}" required>${options}</select></label>`;
 const option=(value,label)=>`<option value="${E(value)}">${E(label)}</option>`;
 const submit=(label)=>`<button type="submit" class="button primary">${E(label)}</button>`;
 const form=(kind,html)=>`<form data-ws-form="${kind}" class="ws-form">${html}</form>`;
 const notice=text=>`<p class="ws-notice">${E(text)}</p>`;
 function check(generation,user){if(!active||epoch!==generation||owner()!==user)throw Object.assign(Error('Workspace or account changed. Open the current workspace again.'),{code:'NABU_WORKSPACE_STALE'});}
 async function request(path,options){const g=epoch,u=owner();if(!u)throw Error('Sign in to use organization workspaces.');let result;try{result=await api(path,options);}catch(e){check(g,u);throw e;}check(g,u);return result;}
 function paint(html){
  if(!active)return;
  showModal('Workspaces & assignments',`<div id="nabu-workspaces" class="ws-ui"><div class="button-row">${button('home','All workspaces')}${button('pending','Pending answers')}${button('close','Return to Nabu')}</div><div id="ws-message" role="status" aria-live="polite"></div>${html}</div>`);
 }
 function error(e){if(e.code==='NABU_WORKSPACE_STALE')return;if(active){const box=doc.querySelector('#ws-message');if(box){box.className='error-banner';box.textContent=e.message||String(e);box.setAttribute('role','alert');}}}
 function success(text){const box=doc.querySelector('#ws-message');if(box){box.className='ws-notice';box.textContent=text;}}
 function invalidate(){active=false;epoch++;record=null;authoring=null;members=[];lastReplay=null;reporting=null;if(doc.querySelector('#nabu-workspaces'))closeModal();}
 async function open(){active=true;epoch++;tenant=null;record=null;await home();}
 async function home(){
  tenant=null;record=null;lastReplay=null;
  if(!owner()){paint('<h3>Sign in first</h3><p>Use Settings → Account to sign in or create an account on this Nabu server. Private reading and vocabulary remain available without a workspace.</p>');return;}
  paint('<p role="status">Loading workspaces…</p>');
  const result=await request('workspaces');
  paint('<h3>Your private workspace</h3><p>Your personal reading, notes, vocabulary and intentions are not automatically shared with organizations.</p><h3>Organization workspaces</h3>'+
   (result.workspaces.length?result.workspaces.map(w=>`<article class="ws-row"><div><strong dir="auto">${E(w.label)}</strong><p>${E(w.role)} · ${E(w.id)}</p></div>${button('workspace','Open',`data-tenant="${E(w.id)}" data-label="${E(w.label)}" data-role="${E(w.role)}"`)}</article>`).join(''):'<p>No organization memberships yet. An owner can add your account handle.</p>')+
   '<details><summary>Create an organization workspace</summary>'+form('create-workspace',input('label','Organization name','','text','required maxlength="120"')+input('id','Workspace ID (letters, numbers, hyphens)','','text','required pattern="[A-Za-z0-9_-]{3,64}" minlength="3" maxlength="64"')+submit('Create workspace'))+'</details>');
 }
 async function openWorkspace(id,meta=null){
  epoch++;tenant=id;record=null;lastReplay=null;reporting=null;
  if(meta)workspace={id,...meta};
  paint('<p role="status">Loading assignments…</p>');
  const all=await request('workspaces');workspace=all.workspaces.find(w=>w.id===id);
  if(!workspace)throw Error('You no longer have access to this workspace. Pending local answers remain available for export or deletion.');
  const result=await request(endpoint('/assignments'));
  paint(`<h3 dir="auto">${E(workspace.label)}</h3>${notice('Assignment reporting is separate from your personal learning history. External AI is unavailable in this workflow.')}`+
   `<div class="button-row">${button('reporting','Reporting choice')}${workspace.role==='owner'?button('department-support','Department support')+button('manage','Members & policy')+button('author','Sources & tasks')+button('assign','Assign a task')+button('audit','Audit log'):button('leave','Leave workspace')}</div>`+
   '<h3>Assignments</h3>'+(result.assignments.length?result.assignments.map(a=>`<article class="ws-row"><div><strong dir="auto">${E(a.objective)}</strong><p>${E(a.status)} · ${a.learnerId===owner()?'Assigned to you':'Learner '+E(a.learnerId)}</p></div>${a.status!=='revoked'&&(a.learnerId===owner()||a.status==='accepted'&&a.reviewers.some(r=>r.id===owner()))?button('record','Open record',`data-id="${E(a.id)}"`):'<small>Reporting access is limited by the assignment agreement.</small>'}</article>`).join(''):'<p>No assignments. Owners can create a source and task, then assign it to a member.</p>'));
 }
 const SUPPORT_POLICY='department-support-v1';
 const SUPPORT_CATEGORIES=['correction_pending','review_rubric','awaiting_response','assisted_evidence','task_matches'];
 const supportLabels={correction_pending:'Correction requests need review',review_rubric:'Check the answer rubric',awaiting_response:'Awaiting a first response',assisted_evidence:'Results include assistance',task_matches:'Task-specific rubric matches'};
 function choiceValue(value){
  if(!value||value.schemaVersion!==1||value.policyVersion!==SUPPORT_POLICY||!Number.isSafeInteger(value.revision)||value.revision<1||typeof value.enabled!=='boolean'||typeof value.terms!=='string')throw Error('The reporting choice could not be verified. Reload before changing it.');
  return value;
 }
 function reportingUnavailable(message){
  reporting=null;
  paint('<h3>Reporting choice unavailable</h3><p class="error-banner" role="alert">'+E(message)+'</p>'+notice('Your current saved choice has not been confirmed. Reload it before making a change. Reading and assignment access remain separate from this optional choice.')+'<div class="button-row">'+button('reporting','Reload reporting choice')+button('workspace','Back to workspace',`data-tenant="${E(tenant)}"`)+'</div>');
 }
 function paintReporting(){
  const r=reporting;
  paint('<h3>Department support reporting</h3><p>Help your department see where shared support may be useful. This is optional and separate from accepting an assignment.</p>'+notice(r.terms)+
   `<p class="ws-saved-choice" data-reporting-enabled="${r.enabled}" role="status">Saved choice: <strong>${r.enabled?'On — include my eligible results':'Off — exclude my results'}</strong></p>`+
   form('reporting-choice',`<label class="checkbox-row"><input type="checkbox" name="enabled" id="ws-reporting-enabled"${r.enabled?' checked':''}>Include my past and future accepted assignment results in departmental support summaries</label>`+
    '<p class="small-print">Private reading, vocabulary, notes, and intentions are excluded. The summary does not list learner identities or raw answers. Small groups are suppressed, but aggregate results are not a promise of anonymity.</p>'+submit('Save reporting choice'))+
   '<p class="small-print">Turn this off to exclude your results from future summaries. Previously downloaded or copied summaries cannot be recalled. Declining this choice does not block the ordinary learning flow.</p>'+button('workspace','Back to workspace',`data-tenant="${E(tenant)}"`));
 }
 async function reportingChoice(){
  reporting=null;paint('<h3>Department support reporting</h3><p role="status">Checking your saved reporting choice…</p>');
  try{reporting=choiceValue(await request(endpoint('/support-consent')));paintReporting();}
  catch(e){if(e.code==='NABU_WORKSPACE_STALE')throw e;reportingUnavailable(e.message||'Your saved reporting choice could not be loaded.');}
 }
 function supportBand(value){
  if(!value||!Number.isSafeInteger(value.lower)||value.lower<5||value.lower%5!==0||value.upper!==value.lower+4)throw Error('The support summary returned an unsupported count range.');
  return `${value.lower}–${value.upper}`;
 }
 function supportValue(value){
  if(!value||value.schemaVersion!==1||value.policyVersion!==SUPPORT_POLICY||!['available','insufficient'].includes(value.status)||value.minimumParticipants!==5||!Array.isArray(value.categories)||value.categories.length!==SUPPORT_CATEGORIES.length||!Array.isArray(value.recommendations)||value.recommendations.length>6||value.learnerModelUpdated!==false||value.conditionsVerified!==false)throw Error('The department support summary could not be verified.');
  if(value.status==='available')supportBand(value.participantBand);else if(value.participantBand!==null)throw Error('An unavailable summary returned a participant count.');
  const keys=new Set();
  for(const category of value.categories){
   if(!category||!SUPPORT_CATEGORIES.includes(category.key)||keys.has(category.key)||!['released','suppressed'].includes(category.status))throw Error('The support categories could not be verified.');
   keys.add(category.key);
   if(category.status==='released'){if(value.status!=='available')throw Error('An unavailable summary returned results.');supportBand(category.band);}
   else if(category.band!==null)throw Error('A suppressed result returned a count.');
  }
  if(value.recommendations.some(x=>!x||typeof x.action!=='string'||typeof x.reason!=='string')||typeof value.notice!=='string'||typeof value.denominator!=='string')throw Error('The support explanation could not be verified.');
  return value;
 }
 async function departmentSupport(){
  paint('<h3>Department support</h3><p role="status">Loading the permitted group summary…</p>');
  try{
   const s=supportValue(await request(endpoint('/department-support')));
   const title=s.status==='available'?'A group view of task support':'Not enough eligible participants to show a summary';
   paint(`<h3>Department support</h3><p class="ws-support-heading">${E(title)}</p>`+
    (s.status==='available'?`<p class="ws-cohort-band"><strong>${E(supportBand(s.participantBand))}</strong> eligible learners</p>`:notice('At least five current members must independently opt in and have an accepted assignment. No participant or result counts are shown below.'))+
    `<p class="small-print">${E(s.denominator)}</p><div class="ws-support-grid">`+s.categories.map(c=>`<article class="ws-support-card" data-support-category="${E(c.key)}"><h4>${E(supportLabels[c.key])}</h4><p class="ws-support-value">${c.status==='released'?E(supportBand(c.band)):'Not shown'}</p><p class="small-print">${c.status==='released'?'Learners · count range':'Suppressed · does not mean zero'}</p></article>`).join('')+'</div>'+
    '<p class="small-print">Each eligible learner appears once, in the first applicable category in the order shown. Match and assistance signals use first responses and their current assessments; a correction request may concern a retry. Small result groups and small complements are suppressed; there is no learner drilldown.</p>'+
    '<h4>Possible next steps</h4><ul class="ws-support-actions">'+s.recommendations.map(r=>`<li><p dir="auto">${E(r.reason)}</p></li>`).join('')+'</ul>'+notice('These are support suggestions, not measures of proficiency or learning gain. Assistance is partly self-reported; conditions are unverified. The personal learner model is not updated.')+notice(s.notice)+
    '<div class="button-row">'+button('department-support','Refresh group summary')+button('workspace','Back to workspace',`data-tenant="${E(tenant)}"`)+'</div>');
  }catch(e){if(e.code==='NABU_WORKSPACE_STALE')throw e;paint('<h3>Department support unavailable</h3><p class="error-banner" role="alert">'+E(e.message||'The group summary could not be loaded.')+'</p>'+notice('No previous numbers are shown as current. Check access or reconnect and try again.')+button('department-support','Retry group summary')+button('workspace','Back to workspace',`data-tenant="${E(tenant)}"`));}
 }
 async function manage(){
  members=(await request(endpoint('/members'))).members;
  paint(`<h3>Members & policy</h3>${notice('Owners administer materials and assignments. Reading a learner’s answers requires being named in an accepted reporting agreement.')}`+
   members.map(m=>`<article class="ws-row"><span>@${E(m.handle)} · ${E(m.role)}</span>${m.role==='owner'?'':button('confirm-revoke','Remove member',`data-id="${E(m.id)}" data-handle="${E(m.handle)}"`)}</article>`).join('')+
   form('add-member',input('handle','Existing account handle','','text','required pattern="[A-Za-z0-9_]{3,24}"')+submit('Add member'))+
   form('policy',`<label class="checkbox-row"><input type="checkbox" name="offline"${workspace.policy.offlineResponses?' checked':''}>Allow learners to explicitly store pending answers on their device</label><p class="small-print">Off by default. Copies already saved on a device cannot be remotely erased. Disabling this rejects new offline uploads; identical previously received submissions remain acknowledged.</p>`+submit('Save policy')));
 }
 async function author(){
  authoring=await request(endpoint('/authoring'));
  const languages=[['en','English'],['ar','Arabic'],['zh-CN','Chinese'],['fr','French'],['ru','Russian'],['es','Spanish'],['tr','Turkish'],['de','German'],['ko','Korean'],['ja','Japanese'],['it','Italian'],['pt','Portuguese']];
  const rubricFields=area('accepted','Accepted recall answers (one per line)','','maxlength="20000"')+area('options','Choice options, for recognition only (one per line)','','maxlength="8000"')+input('answerIndex','Correct choice number, for recognition only','1','number','min="1" max="8"')+select('normalization','Recall matching',[option('nfc-trim','Exact spelling; trim outside whitespace'),option('nfc-casefold-space','Ignore case and repeated whitespace; preserve accents and marks')].join(''));
  paint('<h3>Sources & tasks</h3>'+notice('Source versions and task conditions are immutable. A corrected rubric is a new version; existing results change only through explicit reassessment.')+
   '<details><summary>Add an original source or a new version</summary>'+form('source',input('title','Source title','','text','required maxlength="160"')+select('language','Source language',languages.map(([v,l])=>option(v,l)).join(''))+area('text','Original source text','','required maxlength="16000"')+input('attribution','Attribution','','text','required maxlength="1000"')+input('rights','Rights / permission to use this material','','text','required maxlength="1000"')+input('sourceId','Existing source ID for a revision (blank creates a source)','','text','maxlength="80"')+input('version','Version','1','number','required min="1"')+submit('Save immutable source version'))+'</details>'+
   (authoring.sources.length?'<details open><summary>Create a task</summary>'+form('task',input('title','Task title','','text','required maxlength="160"')+select('source','Source version',authoring.sources.map(s=>option(s.id+'|'+s.version,s.title+' · v'+s.version)).join(''))+area('prompt','Task prompt','','required maxlength="2000"')+select('mode','Task mode',option('recall','Recall · typed response')+option('recognition','Recognition · multiple choice'))+'<label class="checkbox-row"><input type="checkbox" name="visible" checked>Keep source visible (recorded as supplied assistance)</label>'+rubricFields+submit('Create task'))+'</details>':'<p>Add a source before creating a task.</p>')+
   (authoring.tasks.length?'<details><summary>Correct an answer rubric</summary>'+form('rubric',select('task','Task and current rubric',authoring.tasks.map(t=>option(t.id+'|'+t.latestRubricVersion,t.title+' · rubric v'+t.latestRubricVersion)).join(''))+area('accepted','Accepted recall answers, one per line (leave blank for recognition)')+input('answerIndex','Correct choice number, for recognition only','1','number','min="1" max="8"')+select('normalization','Recall matching',option('nfc-trim','Exact spelling')+option('nfc-casefold-space','Ignore case and repeated whitespace'))+area('reason','Reason for correction','','required minlength="3" maxlength="1500"')+submit('Publish corrected rubric'))+'</details>':'')+
   '<h4>Source versions</h4>'+authoring.sources.map(s=>`<p><strong dir="auto">${E(s.title)}</strong> · ${E(s.language)} · v${s.version}<br><code>${E(s.id)}</code></p>`).join(''));
 }
 async function assign(){
  authoring=await request(endpoint('/authoring'));members=(await request(endpoint('/members'))).members;
  if(!authoring.tasks.length){await author();success('Create a source and task first.');return;}
  paint('<h3>Offer an assignment</h3>'+form('assign',select('task','Task and initial rubric',authoring.tasks.map(t=>option(t.id+'|'+t.latestRubricVersion,t.title+' · rubric v'+t.latestRubricVersion)).join(''))+select('learner','Learner',members.map(m=>option(m.id,'@'+m.handle)).join(''))+area('objective','Organization objective for this assignment','','required maxlength="1000"')+'<fieldset><legend>Named reviewers</legend>'+members.map(m=>`<label class="checkbox-row"><input type="checkbox" name="reviewers" value="${E(m.id)}"${m.id===owner()?' checked':''}>@${E(m.handle)}</label>`).join('')+'</fieldset>'+select('sharing','Information visible to named reviewers',option('responses','Results, submitted answers and correction requests')+option('results','Results only; answers can still be inferred from some results'))+notice('The learner must accept these terms before submitting. Future changes require a new assignment.')+submit('Offer assignment')));
 }
 async function openRecord(id){record=await request(endpoint('/assignments/'+encodeURIComponent(id)));lastReplay=null;paintRecord();}
 function paintRecord(){
  // A mutation may replace the record after a replay. Never export the older snapshot.
  lastReplay=null;
  const r=record,a=r.assignment,t=r.task,isLearner=a.learnerId===owner(),latest=r.attempts.at(-1),rules=r.rubrics||[];
  let html=`<h3 dir="auto">${E(t.title)}</h3><p dir="auto">${E(a.objective)}</p>${notice(a.terms)}<p>Reviewers: ${a.reviewers.map(x=>'@'+E(x.handle)).join(', ')||'None remaining'} · Agreement: ${E(a.status)}</p>`;
  if(a.status==='offered'&&isLearner){html+='<div class="button-row">'+button('accept','Accept reporting terms')+button('decline','Decline assignment')+'</div>';paint(html);return;}
  if(a.status==='declined'){paint(html+'<p>Declined. No assessment was created.</p>');return;}
  html+=`<blockquote class="ws-source" lang="${E(r.source.language)}" dir="${r.source.language==='ar'?'rtl':'auto'}">${E(r.source.text||'Source hidden for this task condition.')}</blockquote><p class="small-print">Original source · ${E(r.source.title)} · v${r.source.version}<br>${E(r.source.attribution)} · ${E(r.source.rights)}</p><h4 dir="auto">${E(t.prompt)}</h4>`;
  if(isLearner){html+=form('attempt',t.mode==='recall'?area('response','Your response','','required maxlength="2000"'):select('choice','Your answer','<option value="">Choose…</option>'+t.options.map((o,i)=>option(String(i),o)).join('')));
   // Place the remaining fields inside the same form.
   html=html.slice(0,-7)+`<fieldset><legend>Other assistance used (self-reported)</legend>${[['sourceConsulted','Consulted the source elsewhere'],['translation','Translation'],['hint','Hint'],['other','Other help']].map(([v,l])=>`<label class="checkbox-row"><input type="checkbox" name="${v}">${l}</label>`).join('')}</fieldset><p class="small-print">${t.sourceVisible?'The visible source is automatically recorded as assistance. ':''}Conditions are not independently verified. ${latest?'This is a retry after feedback; the first response remains recorded.':''}</p>`+
    (r.policy.offlineResponses?'<label class="checkbox-row"><input type="checkbox" name="local">Store this answer on this device until acknowledged (optional; unencrypted browser storage)</label>':'<p class="small-print">This workspace requires online submission. On a connection error, keep this window open to retry the same response.</p>')+submit(latest?'Submit linked retry':'Submit first response')+'</form>';}
  html+='<h4>Assessment record</h4>'+notice(r.claim)+(r.decision?notice(r.decision.reason):'');
  html+=r.attempts.length?r.attempts.map(x=>`<article class="ws-attempt"><p><strong>${x.observation.retryOf?'Retry':'First response'}</strong> · received ${E(new Date(x.receivedAt).toLocaleString())}</p>${r.rawResponsesVisible?`<p dir="auto">Answer: ${E(x.observation.response||t.options[x.observation.choice]||'')}</p>`:''}`+x.assessments.map((s,i)=>`<div class="ws-assessment"><strong>${i?'Reassessment':'Initial assessment'} · rubric v${s.rubricVersion}</strong><p>${E(s.interpretation)}</p><small>${s.assisted?'Assistance recorded':'No assistance reported'} · conditions unverified · ${E(s.scorerVersion)}</small>${s.reason?`<p dir="auto">Reason: ${E(s.reason)}</p>`:''}<code>${E(s.id)}</code></div>`).join('')+'</article>').join(''):'<p>No response has been submitted.</p>';
  if(r.attempts.length){
   html+='<div class="button-row">'+button('export','Export permitted record')+(r.rawResponsesVisible?button('replay','Replay stored assessments'):'')+'</div>';
   if(isLearner)html+='<details><summary>Request a correction</summary>'+form('appeal',select('assessment','Assessment',r.attempts.flatMap(x=>x.assessments.map(s=>option(s.id,'Rubric v'+s.rubricVersion+' · '+s.id))).join(''))+area('reason','Why should this result be reviewed?','','required minlength="3" maxlength="1500"')+submit('Send correction request to this record'))+'</details>';
   if(r.canReview)html+='<details><summary>Reassess with a published rubric</summary>'+form('reassess',select('attempt','Response to reassess',r.attempts.map(x=>option(x.id,x.id)).join(''))+input('version','Published rubric version',String(Math.max(a.rubricVersion,...rules.map(x=>x.version))),'number','required min="1"')+area('reason','Reason for reassessment','','required minlength="3" maxlength="1500"')+submit('Append reassessment'))+'</details>';
  }
  if(r.appeals.length)html+='<h4>Correction requests</h4>'+r.appeals.map(x=>`<p dir="auto">${E(x.reason||'Request text is restricted by the reporting agreement.')}<br><small>Assessment ${E(x.assessmentId)}${x.reassessedBy?' · Reassessment recorded':''}</small></p>`).join('');
  html+=notice('These are authored task results, not proficiency certification. Exact matching can miss valid answers. No institutional records are automatically added to the personal learner model.');paint(html);
 }
 async function pending(){
  const u=owner(),generation=epoch;const items=await outbox.listAll(u);check(generation,u);
  paint('<h3>Pending answers on this device</h3>'+notice('Unacknowledged answers are retained under their original account and workspace. Revoked access blocks upload. Export or discard a pending copy here; discarded local work cannot be recovered.')+
   (items.length?items.map(x=>`<article class="ws-row"><div><strong>${E(x.tenantId)}</strong><p>Assignment ${E(x.body.assignmentId)}</p><p dir="auto">${E(x.body.response||'Choice '+(x.body.choice+1))}</p></div><div class="button-row">${button('retry-pending','Retry upload',`data-tenant="${E(x.tenantId)}" data-id="${E(x.body.id)}"`)}${button('export-pending','Export',`data-tenant="${E(x.tenantId)}" data-id="${E(x.body.id)}"`)}${button('discard-pending','Discard…',`data-tenant="${E(x.tenantId)}" data-id="${E(x.body.id)}"`)}</div></article>`).join(''):'<p>No pending answers.</p>'));
 }
 async function handle(buttonEl){
  const action=buttonEl.dataset.wsAction;
  if(['manage','author','assign','record','audit','reporting','department-support'].includes(action))epoch++;
  if(action==='close'){invalidate();return;}
  if(action==='home'){epoch++;await home();return;}
  if(action==='pending'){epoch++;await pending();return;}
  if(action==='workspace'){await openWorkspace(buttonEl.dataset.tenant);return;}
  if(action==='reporting'){await reportingChoice();return;}
  if(action==='department-support'){await departmentSupport();return;}
  if(action==='manage'){await manage();return;}
  if(action==='author'){await author();return;}
  if(action==='assign'){await assign();return;}
  if(action==='record'){await openRecord(buttonEl.dataset.id);return;}
  if(action==='accept'||action==='decline'){await request(endpoint('/assignments/'+record.assignment.id+'/acceptance'),{method:'PUT',body:{decision:action==='accept'?'accepted':'declined'}});await openRecord(record.assignment.id);return;}
  if(action==='export'){await download('Nabu-assignment-'+record.assignment.id+'.json',JSON.stringify(lastReplay||record,null,2),'application/json');return;}
  if(action==='replay'){lastReplay=await request(endpoint('/assignments/'+record.assignment.id+'/replay'),{method:'POST',body:{}});success(lastReplay.assessmentCount===0?'No assessments to replay.':lastReplay.allMatch?`${lastReplay.assessmentCount} stored assessment(s) reproduced exactly. This does not independently validate the rubric.`:'Replay found a mismatch. Export the record for investigation.');return;}
  if(action==='leave'||action==='confirm-revoke'){
   const target=action==='leave'?owner():buttonEl.dataset.id;
   paint('<h3>Revoke workspace access?</h3>'+notice('This ends server access and revokes the member’s existing assignments and reviewer grants. Rejoining will not restore old grants. Copies already downloaded cannot be remotely erased.')+button('revoke','Revoke access',`data-id="${E(target)}"`)+button('workspace','Cancel',`data-tenant="${E(tenant)}"`));return;
  }
  if(action==='revoke'){await request(endpoint('/members/'+encodeURIComponent(buttonEl.dataset.id)),{method:'DELETE',body:{}});if(buttonEl.dataset.id===owner())await home();else await manage();return;}
  if(action==='audit'){const result=await request(endpoint('/audit'));paint('<h3>Workspace audit</h3>'+notice('This page is limited to 200 events. Use the documented after cursor for subsequent pages. No raw answers or private learning history are included.')+result.events.map(x=>`<p>${E(x.action)} · ${E(new Date(x.at).toLocaleString())}<br><code>${E(x.reference)}</code></p>`).join('')+button('export-audit','Export this page'));lastReplay=result;return;}
  if(action==='export-audit'){await download('Nabu-workspace-audit.json',JSON.stringify(lastReplay,null,2),'application/json');return;}
  if(action==='retry-pending'){const g=epoch,u=owner();await outbox.retry(u,buttonEl.dataset.tenant,buttonEl.dataset.id);check(g,u);await pending();success('Server acknowledged this exact answer. Its pending copy was removed.');return;}
  if(action==='export-pending'){const item=(await outbox.list(owner(),buttonEl.dataset.tenant)).find(x=>x.body.id===buttonEl.dataset.id);if(!item)throw Error('Pending answer no longer exists.');await download('Nabu-pending-'+item.body.id+'.json',JSON.stringify(item,null,2),'application/json');return;}
  if(action==='discard-pending'){paint('<h3>Discard this pending answer?</h3>'+notice('This removes only the local pending copy. An answer already received by the server remains in its assessment record.')+button('discard-confirmed','Discard local copy',`data-tenant="${E(buttonEl.dataset.tenant)}" data-id="${E(buttonEl.dataset.id)}"`)+button('pending','Cancel'));return;}
  if(action==='discard-confirmed'){const g=epoch,u=owner();await outbox.discard(u,buttonEl.dataset.tenant,buttonEl.dataset.id);check(g,u);await pending();return;}
 }
 async function submitForm(formEl){
  const data=Object.fromEntries(new doc.defaultView.FormData(formEl)),kind=formEl.dataset.wsForm;
  const identifier=()=>formEl.dataset.requestId||(formEl.dataset.requestId=uid());
  if(kind==='reporting-choice'){
   if(!reporting)throw Error('Reload your reporting choice before saving.');
   const before=reporting;
   try{
    reporting=choiceValue(await request(endpoint('/support-consent'),{method:'PUT',body:{revision:before.revision,enabled:data.enabled==='on',policyVersion:before.policyVersion}}));
    paintReporting();success(reporting.enabled?'Reporting choice saved: your eligible results can be included in future group summaries.':'Reporting choice saved: your results are excluded from future group summaries.');
   }catch(e){if(e.code==='NABU_WORKSPACE_STALE')throw e;reportingUnavailable(e.status===409?'Your reporting choice changed elsewhere. Reload the saved choice before deciding again.':'The change was not confirmed. '+(e.message||'Reconnect and reload your saved choice.'));}
   return;
  }
  if(kind==='create-workspace'){await request('decision-tenants',{method:'POST',body:{id:data.id,label:data.label}});await openWorkspace(data.id);return;}
  if(kind==='add-member'){await request(endpoint('/members'),{method:'POST',body:{handle:data.handle.replace(/^@/,'')}});await manage();return;}
  if(kind==='policy'){workspace.policy=await request(endpoint('/policy'),{method:'PUT',body:{revision:workspace.policy.revision,offlineResponses:data.offline==='on'}});await manage();success('Policy saved.');return;}
  if(kind==='source'){await request(endpoint('/sources'),{method:'POST',body:{id:data.sourceId||identifier(),version:Number(data.version),title:data.title,text:data.text,language:data.language,attribution:data.attribution,rights:data.rights}});await author();success('Source version saved.');return;}
  const lines=value=>(value||'').split('\n').map(x=>x.trim()).filter(Boolean);
  if(kind==='task'){
   const [sourceId,version]=data.source.split('|');
   await request(endpoint('/tasks'),{method:'POST',body:{id:identifier(),title:data.title,sourceId,sourceVersion:Number(version),prompt:data.prompt,mode:data.mode,sourceVisible:data.visible==='on',options:data.mode==='recognition'?lines(data.options):[],rubric:{normalization:data.normalization,...(data.mode==='recognition'?{answerIndex:Number(data.answerIndex)-1}:{acceptedAnswers:lines(data.accepted)})}}});await author();success('Task and initial rubric saved.');return;
  }
  if(kind==='rubric'){
   const [taskId,version]=data.task.split('|'),t=authoring.tasks.find(x=>x.id===taskId);
   const result=await request(endpoint('/tasks/'+taskId+'/rubrics'),{method:'POST',body:{expectedVersion:Number(version),reason:data.reason,rubric:{normalization:data.normalization,...(t.mode==='recognition'?{answerIndex:Number(data.answerIndex)-1}:{acceptedAnswers:lines(data.accepted)})}}});await author();success('Published rubric v'+result.version+'. A named reviewer must explicitly reassess existing records.');return;
  }
  if(kind==='assign'){
   const [taskId,version]=data.task.split('|');await request(endpoint('/assignments'),{method:'POST',body:{id:identifier(),learnerId:data.learner,taskId,rubricVersion:Number(version),reviewerIds:new doc.defaultView.FormData(formEl).getAll('reviewers'),sharing:data.sharing,objective:data.objective}});await openWorkspace(tenant);success('Assignment offered. The learner must accept the reporting terms.');return;
  }
  if(kind==='attempt'){
   const r=record,u=owner(),scope=tenant,g=epoch;
   if(!formEl.frozenAnswer){formEl.frozenAnswer={id:identifier(),assignmentId:r.assignment.id,response:r.task.mode==='recall'?data.response:'',choice:r.task.mode==='recognition'?Number(data.choice):null,occurredAt:Date.now(),retryOf:r.attempts.at(-1)?.id||null,assistance:Object.fromEntries(['sourceConsulted','translation','hint','other'].map(k=>[k,data[k]==='on'])),offline:data.local==='on'};
    for(const el of formEl.querySelectorAll('input,textarea,select'))el.disabled=true;
   }
   const body=formEl.frozenAnswer;
   try{
    let result;
    if(body.offline){await outbox.enqueue(u,scope,body,{workspaceAllows:r.policy.offlineResponses,learnerAllows:true});result=await outbox.retry(u,scope,body.id);}
    else result=await request(endpoint('/attempts'),{method:'POST',body});
    check(g,u);if(result.acknowledgedId!==body.id)throw Error('Submission not acknowledged. Retry this same answer.');record=result.record;paintRecord();success('Response received. The original response is preserved.');
   }catch(e){if(e.code==='NABU_WORKSPACE_STALE')throw e;throw Error(e.message+(body.offline?' If local storage succeeded, the answer is in Pending answers. Retry uses the same ID.':' The answer is frozen in this window. Retry submission, or reopen the record to check whether the server received it.'));}return;
  }
  if(kind==='appeal'){record=await request(endpoint('/assignments/'+record.assignment.id+'/appeals'),{method:'POST',body:{id:identifier(),assessmentId:data.assessment,reason:data.reason}});paintRecord();success('Correction request saved on the assignment record.');return;}
  if(kind==='reassess'){const attempt=record.attempts.find(x=>x.id===data.attempt);record=await request(endpoint('/attempts/'+attempt.id+'/reassess'),{method:'POST',body:{id:identifier(),expectedAssessmentId:attempt.assessments.at(-1).id,rubricVersion:Number(data.version),reason:data.reason}});paintRecord();success('Reassessment appended. The previous result remains visible.');return;}
 }
 doc.addEventListener('click',async event=>{const b=event.target.closest?.('[data-ws-action]');if(!b||b.disabled)return;event.preventDefault();b.disabled=true;try{await handle(b);}catch(e){error(e);}finally{b.disabled=false;}});
 doc.defaultView?.addEventListener('nabu-account-change',invalidate);
 doc.querySelector('#modal')?.addEventListener('close',()=>{active=false;epoch++;});
 return {open,submit:submitForm,invalidate,outbox};
}
