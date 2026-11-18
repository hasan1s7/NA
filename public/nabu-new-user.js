import * as Moments from './nabu-moments.js';

/** A small first-use surface over the existing private event history.
 * Progress describes actions taken, never inferred proficiency. */
export function installNewUser(h) {
  const {state, store, actions, E, C, $, render, navigate} = h;
  let selection = null, pending = false, error = '', generation = 0;
  let draft = {text:'', title:'', language:'es'};
  const writes = new Map();
  const owner = () => state.user?.id || (state.accountHint ? '!locked' : 'guest');
  const enabled = () => owner() !== '!locked' && store.getState().owner === owner()
    && !['loading','locked','error'].includes(store.getState().status)
    && (!state.user || state.backend?.moments && state.backend?.supportCycles);
  const saved = () => enabled() ? Moments.projectMoments(store.getEvents(), state.user?.id || null) : [];
  function chosen() {
    if (!selection) {
      const recent = saved().find(m => Moments.sceneByKey(m.id.replace('moment:','')));
      selection = recent?.id.replace('moment:','') || Moments.MOMENT_SCENES.find(s => s.language === state.settings.targetLang)?.key || 'dream';
      draft.language = state.settings.targetLang || 'es';
    }
    return Moments.sceneByKey(selection);
  }
  function progress(scene) {
    const events = enabled() ? store.getEvents().filter(e => e.kind === 'support-cycle'
      && e.cycle.actor.userId === (state.user?.id || null)
      && e.cycle.taskRef?.id?.startsWith('moment-task:'+scene.key+':')) : [];
    const item = saved().find(m => m.id === 'moment:'+scene.key);
    return {item, encountered:events.some(e => e.cycle.observation === 'encounter'),
      attempted:events.some(e => e.cycle.observation === 'response'),
      returned:!!item?.visits.some(v => v.action === 'reopen' && item.practiceSince != null && v.at - item.practiceSince >= Moments.MOMENT_DAY)};
  }
  const button = (action, text, cls='primary', extra='') => `<button type="button" class="button ${cls}" data-action="${action}" ${extra}>${E(text)}</button>`;
  function phrase(scene) {
    const at = scene.source.indexOf(scene.phrase);
    if (at < 0) return E(scene.source);
    return E(scene.source.slice(0,at)) + `<button type="button" class="nu-highlight" data-action="nu-help" aria-label="Understand ${E(scene.phrase)}"${!enabled()?' disabled':''}>${E(scene.phrase)}</button>` + E(scene.source.slice(at+scene.phrase.length));
  }
  function returnCopy(item) {
    if (!item) return 'Keep a phrase here and find it again in your Library.';
    if (item.mode === 'reference') return 'Saved as a reference. Open it whenever you want; practice is optional.';
    if (item.mode === 'familiar') return 'Already marked familiar. Prompts stay paused until you change that choice.';
    if (item.dueAt === null) return 'You have revisited this passage. It stays in your Library.';
    if (item.dueAt <= Date.now()) return 'This phrase is ready for another visit in Review.';
    return 'Find this phrase in Review from ' + new Date(item.dueAt).toLocaleString(undefined,{weekday:'short',hour:'numeric',minute:'2-digit'}) + '. You can open it sooner.';
  }
  function steps(p) {
    const done = [p.encountered,!!p.item,p.attempted,p.returned];
    const labels = [['Explore a phrase','Open as much help as you need.'],['Keep what matters','Save it with its original context.'],['Try a small check','See the phrase in another scene.'],['Come back later','Find it again in Library or Review.']];
    const current = done.findIndex(v => !v);
    return `<aside class="nu-guide" aria-labelledby="nu-guide-title"><p class="eyebrow">YOUR FIRST LOOP</p><h2 id="nu-guide-title">A little now.<br>More next time.</h2><ol class="nu-steps">${labels.map(([title,description],i)=>`<li class="${done[i]?'is-done':current===i?'is-current':''}"><span class="nu-step-number" aria-hidden="true">${done[i]?'✓':String(i+1).padStart(2,'0')}</span><div><strong>${title}${done[i]?'<span class="sr-only"> · done</span>':''}</strong><p>${description}</p></div></li>`).join('')}</ol><p class="nu-guide-note">Go at your pace. You can read, save, or leave practice for another time.</p></aside>`;
  }
  function intake() {
    return `<section class="nu-piece nu-intake" aria-labelledby="nu-piece-title"><div class="nu-piece-label"><span>YOUR OWN MATERIAL</span><span>Text · messages · lyrics</span></div><h2 id="nu-piece-title">What would you like to understand?</h2><p>A few lines are a good place to start.</p><div class="nu-input-row"><div><label for="nu-language">Language of this text</label><select class="select" id="nu-language">${C.LANGUAGES.map(([code,name])=>`<option value="${code}"${code===draft.language?' selected':''}>${E(name)}</option>`).join('')}</select></div><div><label for="nu-title">Title <span class="muted">(optional)</span></label><input class="input" id="nu-title" maxlength="100" value="${E(draft.title)}" placeholder="A song, a message, a passage"></div></div><label for="nu-text">Your text</label><textarea id="nu-text" class="input" rows="6" maxlength="15000" dir="auto" placeholder="Paste something you want to read…">${E(draft.text)}</textarea><div class="nu-own-actions">${button('nu-open','Open my text')}<span>You can add local audio in the reader.</span></div><p class="nu-small">Your text stays in this browser for this profile. A lookup may use your configured translation service. Practice is offered only where a matching exercise is available.</p></section>`;
  }
  function page() {
    const scene = chosen(), p = scene ? progress(scene) : {item:null,encountered:false,attempted:false,returned:false};
    const ready = enabled(), blocked = !ready ? (owner()==='!locked'?'Sign in again, or choose your guest library, to save your first phrase.':state.user && (!state.backend?.moments || !state.backend?.supportCycles)?'This server needs the current learning features before examples can be saved or practised. You can still open your own text.':store.getState().status==='error'?'Your progress could not open. Retry from Explore before saving.':'Opening your private progress…') : '';
    let action = !p.encountered ? button('nu-help','Understand this phrase')
      : !p.item ? button('nu-keep','Keep this phrase')
      : !p.attempted && p.item.mode === 'practice' && !h.support().practiceExcluded() ? button('nu-practice','Try a new scene')
      : button('nu-library','Open my saved phrases');
    if (!ready) action = '<button class="button primary" disabled>Waiting for your library</button>';
    const date = p.item ? `<div class="nu-saved-note" role="status"><span aria-hidden="true">✓</span><div><strong>${p.item.mode==='practice'?'Kept for another visit':'Already in your Library'}</strong><p>${E(returnCopy(p.item))}</p></div></div>` : '';
    const piece = scene ? `<section class="nu-piece" aria-labelledby="nu-piece-title"><div class="nu-piece-label"><span>${E(scene.variety.toUpperCase())}</span><span>Original Nabu example</span></div><h2 id="nu-piece-title">${E(scene.title)}</h2><p class="nu-context">${E(scene.context)}</p><blockquote class="nu-source" lang="${scene.language}" dir="auto">${phrase(scene)}</blockquote><p class="nu-tap-note">The highlighted phrase is a good place to start.</p><div class="nu-piece-actions">${action}${p.encountered?button('nu-help','Open the help again','text-button'):''}</div>${date}${p.item?`<div class="nu-secondary-actions">${!h.support().practiceExcluded() && (p.attempted || p.item.mode !== 'practice' || !p.encountered)?button('nu-practice',p.attempted?'Try another check':'Practice now','text-button'):''}${button('nu-preference','Change how this is kept','text-button')}</div>`:''}</section>` : intake();
    return `<div id="new-user-experience" data-generation="${generation}" class="nu-page"><header class="nu-heading"><p class="eyebrow">WELCOME TO NABU</p><h1>Start with something<br>that matters <em>to you.</em></h1><p>Understand a little. Keep what clicks. Find it again.</p></header><div class="nu-choices" role="group" aria-label="Choose your starting point">${[['dream','Spanish'],['camille','French'],['bend','Arabic'],['own','Your own text']].map(([key,label])=>`<button type="button" data-action="nu-select" data-key="${key}" aria-pressed="${selection===key}">${key==='own'?'<span aria-hidden="true">＋</span> ':''}${label}</button>`).join('')}</div>${blocked?`<p class="nu-status" role="status">${E(blocked)}</p>`:''}<p id="nu-error" class="support-error" role="alert"${error?'':' hidden'}>${E(error)}</p><div class="nu-layout">${piece}${steps(p)}</div><footer class="nu-bottom"><span>No placement test. No need to learn the whole app.</span><button type="button" class="text-button" data-action="go" data-view="explore">Explore the rest of Nabu <span aria-hidden="true">↗</span></button></footer></div>`;
  }
  function capture() {
    if ($('#new-user-experience')?.dataset.generation !== String(generation)) return;
    if ($('#nu-text')) draft = {text:$('#nu-text').value,title:$('#nu-title').value,language:$('#nu-language').value};
  }
  function refresh() {
    if (state.view !== 'new-user' || $('#modal')?.open || pending) return;
    capture();
    render();
  }
  actions['nu-select'] = b => {
    if (!['own',...Moments.MOMENT_SCENES.map(s=>s.key)].includes(b.dataset.key) || pending) return;
    capture();selection=b.dataset.key;error='';render();
    (selection==='own'?$('#nu-text'):$('#nu-piece-title'))?.focus?.({preventScroll:true});
  };
  actions['nu-help'] = () => {
    const scene=chosen();if(!scene)return;
    return h.support().startCheck('moment-task:'+scene.key+':first',{readOnly:true,presentation:'first-use'});
  };
  actions['nu-practice'] = () => {
    const scene=chosen();if(!scene)return;
    return h.support().startCheck('moment-task:'+scene.key+':next',{presentation:'first-use'});
  };
  actions['nu-keep'] = async () => {
    if(pending)return;
    if(!enabled())throw Error('Wait for your private library before saving.');
    const scene=chosen();if(!scene)return;
    if(progress(scene).item){render();return;}
    const who=owner(), token=generation, id='moment:'+scene.key;
    const mode=h.support().practiceExcluded()?'reference':'practice';
    const key=who+':'+id+':'+mode;
    if(!writes.has(key))writes.set(key,C.uid());
    pending=true;error='';
    const b=$('[data-action="nu-keep"]');if(b){b.disabled=true;b.textContent='Keeping…';}
    try {
      await store.append({id,version:1},'moment',{moment:{schemaVersion:1,userId:state.user?.id||null,action:'keep',mode,source:null}},writes.get(key));
      if(who!==owner() || token!==generation)return;
      store.sync().catch(()=>{});
    } catch(e) {if(who===owner()&&token===generation)error=e.message||'Could not save. Try again.';}
    finally {if(token===generation){pending=false;refresh();}}
  };
  actions['nu-preference'] = () => {const scene=chosen();if(scene)return actions['moment-choose']({dataset:{id:'moment:'+scene.key}});};
  actions['nu-library'] = () => navigate('library');
  actions['nu-open'] = () => {
    capture();error='';
    if(!draft.text.trim()){error='Paste a few words or lines to begin.';render();$('#nu-text')?.focus();return;}
    if(draft.text.length>15000 || !C.isLanguage(draft.language)){error='Choose a supported language and up to 15,000 characters.';render();return;}
    h.openReader({text:draft.text,title:draft.title.trim()||'My first piece',language:draft.language,seconds:null});
  };
  document.addEventListener('input',event=>{if(['nu-text','nu-title'].includes(event.target.id))capture();});
  document.addEventListener('change',event=>{if(event.target.id==='nu-language')capture();});
  $('#modal')?.addEventListener('close',()=>{if(!$('#modal')?.open)queueMicrotask(refresh);});
  window.addEventListener('nabu-account-change',()=>{generation++;selection=null;pending=false;error='';draft={text:'',title:'',language:'es'};writes.clear();if(state.view==='new-user')render();});
  return {render:page,refresh};
}
