"""Build a self-contained, CSP-hashed index. No npm or network dependency.
Run: python tools/build_standalone.py
The three deployment files are index.html, nabu-sw.js, nabu-repair.html.
The original JS modules remain editable sources, not startup dependencies.
"""
from pathlib import Path
import base64, hashlib, json, re
ROOT=Path(__file__).resolve().parents[1]
PUBLIC=ROOT/'public'
BUILD='nabu-pages-1.17-20261116-r3'
# The integrity registry is source data, bundled locally with the structural
# bridge. Rebuilding never requires a third-party service or runtime fetch.
integrity=json.loads((ROOT/'data/graph-integrity.json').read_text(encoding='utf-8'))
(PUBLIC/'nabu-structure-data.js').write_text('/* Generated from data/graph-integrity.json; edit the JSON source. */\nexport const GRAPH_INTEGRITY = '+json.dumps(integrity,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
# The extension uses the same bounded reading rules and media helpers.
for shared_name in ('nabu-media.js','nabu-transliteration.js'):
    (ROOT/'chrome-extension'/shared_name).write_bytes((PUBLIC/shared_name).read_bytes())
def read(name): return (PUBLIC/name).read_text(encoding='utf-8')
def signature(value): return "'sha256-"+base64.b64encode(hashlib.sha256(value.encode()).digest()).decode()+"'"
def module(source, prefix=''):
    names=re.findall(r'^export (?:async )?(?:function|const) (\w+)',source,flags=re.M)
    source=re.sub(r'^import .*;\n','',source,flags=re.M)
    source=re.sub(r'^export ','',source,flags=re.M)
    return '(()=>{\n'+prefix+source+'\nreturn {'+','.join(names)+'};\n})()'
assignment_outbox=module(read('nabu-assignment-outbox.js'))
workspaces=module(read('nabu-institutions.js'),'const {createAssignmentOutbox}=AssignmentOutbox;\n')
palette=module(read('nabu-palette.js'))
scribe=module(read('nabu-scribe.js'))
core=module(read('nabu-core.js'))
store=module(read('nabu-store.js'), 'const {cardContent,newCard,identity,scheduleReview,uid,VERSION,applyReview}=C;\n')
sync=module(read('nabu-sync.js'))
account_store=module(read('nabu-account-store.js'))
speech=module(read('nabu-speech.js'))
graph=module(read('nabu-graph.js'))
links=module(read('nabu-links.js'))
feature_tree=module(read('nabu-feature-tree.js'))
spatial=module(read('nabu-spatial-graph.js'))
syntax=module(read('nabu-syntax.js'))
transliteration=module(read('nabu-transliteration.js'))
media=module(read('nabu-media.js'))
clipart=module(read('nabu-clipart.js'))
illustrations=module(read('nabu-illustrations.js'))
reading_ui=module(read('nabu-reading-ui.js'))
observations=module(read('nabu-observations.js'))
evidence_tasks=module(read('nabu-evidence-tasks.js'))
evidence_policy=module(read('nabu-evidence-policy.js'))
evidence_ui=module(read('nabu-evidence-ui.js'))
catalogue=module(read('nabu-content-catalogue.js'))
content=module(read('nabu-content.js'),'const {CATALOG}=Catalog;\n')
content_store=module(read('nabu-content-store.js'))
explore_ui=module(read('nabu-explore-ui.js'))
intent_model=module(read('nabu-intents.js'))
intent_store=module(read('nabu-intent-store.js'))
intent_ui=module(read('nabu-intent-ui.js'))
structure_data=module(read('nabu-structure-data.js'))
structure=module(read('nabu-structure.js'),'const {GRAPH_INTEGRITY}=StructureData;\n')
graph_kernel=module(read('nabu-graph-kernel.js'))
task_material_data=module(read('nabu-task-material-data.js'))
structure_query=module(read('nabu-structure-query.js'))
next_step=module(read('nabu-next-step.js'))
next_step_ui=module(read('nabu-next-step-ui.js'))
learner_tasks=module(read('nabu-learner-tasks.js'),'const {LANGUAGES,concept,normalizeWord}=G;\nconst {CONTRAST_KEYS,contrastTask}=EvidenceTasks;\nconst {classifyKnownEntry,graphIntegrityRegistry}=Structure;\n')
learner_observations=module(read('nabu-learner-observations.js'),'const {resolveEvidenceTask}=EvidenceTasks;\nconst {listLearnerTasks,resolveLearnerTask,modelTask,mappedContrastTasks,permitsMeaningSuppliedEvidence,taskExposure}=LearnerTasks;\n')
learner_model=module(read('nabu-learner-model.js'))
learner_policy=module(read('nabu-learner-policy.js'))
learner_ui=module(read('nabu-learner-ui.js'))
word_tools=module(read('nabu-word-tools.js'))
app=re.sub(r'^import .*;\n','',read('nabu-app.js'),flags=re.M)
runtime='(function(){\n"use strict";\nconst Palette='+palette+';\nconst AssignmentOutbox='+assignment_outbox+';\nconst Workspaces='+workspaces+';\nconst Scribe='+scribe+';\nconst C='+core+';\nconst Local='+store+';\nconst Sync='+sync+';\nconst DB='+account_store+';\nconst S='+speech+';\nconst G='+graph+';\nconst L='+links+';\nconst F='+feature_tree+';\nconst Spatial='+spatial+';\nconst Syntax='+syntax+';\nconst T='+transliteration+';\nconst M='+media+';\nconst Art='+clipart+';\nconst I='+illustrations+';\nconst U='+reading_ui+';\nconst W='+word_tools+';\nconst Observations='+observations+';\nconst Catalog='+catalogue+';\nconst X='+content+';\nconst P='+content_store+';\nconst EvidenceTasks='+evidence_tasks+';\nconst EvidencePolicy='+evidence_policy+';\nconst EvidenceUI='+evidence_ui+';\nconst Explore='+explore_ui+';\nconst Intent='+intent_model+';\nconst IntentStore='+intent_store+';\nconst IntentUI='+intent_ui+';\nconst StructureData='+structure_data+';\nconst Structure='+structure+';\nconst GraphKernel='+graph_kernel+';\nconst TaskMaterialData='+task_material_data+';\nconst StructureQuery='+structure_query+';\nconst NextStep='+next_step+';\nconst NextStepUI='+next_step_ui+';\nconst LearnerTasks='+learner_tasks+';\nconst LearnerObservations='+learner_observations+';\nconst LearnerModel='+learner_model+';\nconst LearnerPolicy='+learner_policy+';\nconst LearnerUI='+learner_ui+';\n'+app+'\n})();'
startup=(ROOT/'tools/startup.js').read_text(encoding='utf-8')
css=read('nabu-institutions.css')+'\n'+read('nabu.css')+'\n'+read('nabu-workspace.css')+'\n'+read('nabu-explore.css')+'\n'+read('nabu-intent.css')+'\n'+read('nabu-next-step.css')+'\n'+read('nabu-evidence.css')+'\n'+read('nabu-learner.css')+'\n'+read('nabu-scribe.css')+'\n'+read('nabu-palette.css')+'\n.startup-help{max-width:560px;margin:24px auto;text-align:center;font-size:13px;line-height:1.7}.startup-help summary{cursor:pointer;color:var(--green);font-weight:600}.startup-help a{color:var(--green);font-weight:700}.fatal .button-row{margin:24px 0}.fatal .small-print{margin-top:18px}.fatal #startup-error{overflow-wrap:anywhere}\n'
def policy(scripts,style):
    return "default-src 'self'; script-src 'self' "+' '.join(signature(x) for x in scripts)+"; script-src-attr 'none'; style-src 'self' "+signature(style)+"; img-src 'self' data:; connect-src 'self' https://api.mymemory.translated.net; media-src 'self' blob:; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; worker-src 'self'; manifest-src 'self'"
html=(ROOT/'tools/index.template.html').read_text(encoding='utf-8').replace('<html lang="en">',f'<html lang="en" data-nabu-build="{BUILD}">')
html=re.sub(r'<meta http-equiv="Content-Security-Policy"[^>]*>',lambda _: '<meta http-equiv="Content-Security-Policy" content="'+policy([startup,runtime],css)+'">',html)
# Embedded favicon and CSS: no asset fetch is required to render or start.
svg=read('nabu-icon.svg').encode()
html=html.replace('src="./nabu-icon.svg"', 'src="data:image/svg+xml;base64,'+base64.b64encode(svg).decode()+'"')
html=html.replace('href="./nabu-icon.svg"', 'href="data:image/svg+xml;base64,'+base64.b64encode(svg).decode()+'"')
# Preserve the manifest: PWA installation needs a real linked manifest.
html=html.replace('<link rel="stylesheet" href="./nabu.css">','<style>'+css+'</style>')
html=html.replace('  <link rel="stylesheet" href="./nabu-workspace.css">\n','')
html=html.replace('  <script type="module" src="./nabu-app.js"></script>\n','')
html=html.replace('<p>Opening your private library...</p>', '<p id="startup-status" role="status" aria-live="polite">Opening your private library...</p><details class="startup-help"><summary>Taking too long?</summary><p><a href="./nabu-repair.html">Repair app loading</a> without deleting your words. Do not clear browser site data.</p></details>')
assert '</script' not in runtime.lower() and '</script' not in startup.lower()
html=html.replace('</body>', '<script id="nabu-startup-guard">'+startup+'</script>\n<script id="nabu-application">'+runtime+'</script>\n</body>')
(PUBLIC/'index.html').write_text(html, encoding='utf-8')
repair=(ROOT/'tools/repair.js').read_text(encoding='utf-8')
repair_css="body{margin:0;background:#f6f8f3;color:#20322b;font:16px/1.65 system-ui,sans-serif}main{max-width:640px;margin:10vh auto;padding:32px}h1{font-size:34px;line-height:1.2;letter-spacing:-1px}a{color:#24624f;font-weight:650}p{overflow-wrap:anywhere}.eyebrow{font-size:12px;letter-spacing:3px;color:#24624f}.notice{border:1px solid #c8d8cc;border-radius:12px;padding:18px;background:white}"
repair_html='''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="__CSP__"><title>Repair Nabu loading</title><style>__CSS__</style></head><body><main><p class="eyebrow">NABU / SAFE STARTUP REPAIR</p><h1>Refresh the app.<br>Keep your words.</h1><p id="repair-status" role="status" aria-live="polite">Refreshing this Nabu site's app files...</p><p class="notice">This repair removes outdated app-file caches and the offline worker for this Nabu path. It does not reset your word database, review history, settings, or account.</p><p><a href="./nabu-repair.html">Retry repair</a> &nbsp; <a href="./">Open Nabu</a></p><noscript><p>Enable JavaScript to run the repair. Do not use Clear site data; that can erase your library.</p></noscript></main><script>__SCRIPT__</script></body></html>'''
repair_html=repair_html.replace('__CSP__',policy([repair],repair_css)).replace('__CSS__',repair_css).replace('__SCRIPT__',repair)
(PUBLIC/'nabu-repair.html').write_text(repair_html, encoding='utf-8')
# The worker must accept exactly the shell just built. Keep this synchronized
# here so a release version change cannot strand installed/offline clients.
worker, count = re.subn(r"const BUILD = '[^']+';", "const BUILD = '" + BUILD + "';", read('nabu-sw.js'), count=1)
if count != 1:
    raise RuntimeError('Service-worker build marker is missing.')
(PUBLIC/'nabu-sw.js').write_text(worker, encoding='utf-8')
print('Built',len(html.encode()),'bytes; app scripts/styles use exact SHA-256 CSP hashes.')
