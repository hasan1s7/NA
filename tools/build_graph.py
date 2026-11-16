"""Bundle 900 word meanings, 90 phrases and 36 expressions; validate every direction.
Also attaches approximate transliterations for non-Latin-script forms.
"""
from pathlib import Path
import hashlib, json, math, re
from unidecode import unidecode

ROOT=Path(__file__).resolve().parents[1]
data=json.loads((ROOT/'data/wordgraph-source.json').read_text(encoding='utf-8'))
phrases=json.loads((ROOT/'data/phrasebank-source.json').read_text(encoding='utf-8'))
bridge_origins=[{'sourcePath':'data/wordgraph-source.json','locator':f'bridges[{index}]',
                 'kind':'generated-category-anchor' if row[2]=='related-topic' else 'authored-catalogue'}
                for index,row in enumerate(data['bridges'])]
assert len(data['concepts'])==900 and len(data['languages'])==12
assert sum(c.get('kind')=='phrase' for c in phrases['concepts'])==90
assert sum(c.get('kind')=='expression' for c in phrases['concepts'])==36
assert phrases['languages']==data['languages']
data['concepts']+=phrases['concepts']
data['bridges'] += [['phrases.i_need_help','essentials.help','asks-for'],['expressions.cats_paw','phrases.i_need_help','expresses']]
bridge_origins += [{'sourcePath':'tools/build_graph.py','locator':'bundled-bridge:'+key,'kind':'authored-catalogue'}
                   for key in ('asks-for-help','expression-asks-for-help')]
data['categories'].update({'phrases':'Everyday phrases','expressions':'Idioms & expressions'})
data['phraseReviewStatus']=phrases['reviewStatus']
ids={c['id'] for c in data['concepts']}
assert len(ids)==len(data['concepts'])

LATINISH={'en','es','fr','de','it','pt','tr'}
SPACE_RE=re.compile(r'\s+')
PUNCT_EDGE_RE=re.compile(r"^[\s'\"`.,;:!?()\[\]{}<>/-]+|[\s'\"`.,;:!?()\[\]{}<>/-]+$")

def needs_transliteration(text,lang):
    if not text or lang in LATINISH:
        return False
    return any(ord(ch)>127 for ch in text)

def romanize(text,lang):
    if not needs_transliteration(text,lang):
        return ''
    value=SPACE_RE.sub(' ', unidecode(text).replace('\n',' ').strip())
    value=PUNCT_EDGE_RE.sub('', value).strip()
    if not value:
        return ''
    folded=value.lower().replace(' ','')
    source=re.sub(r'\W+','',text.lower(),flags=re.UNICODE)
    if folded and folded==source:
        return ''
    return value

for c in data['concepts']:
    assert set(c['terms'])==set(data['languages']),c['id']
    assert all(isinstance(s,str) and s.strip() for s in c['terms'].values()),c['id']
    assert c['category'] in data['categories']
    c['transliterations']={lang:romanize(term,lang) for lang,term in c['terms'].items()}
    if c.get('kind')=='expression':
        assert set(c['literalTerms'])==set(c['meaningTerms'])==set(data['languages'])
        c['meaningTransliterations']={lang:romanize(term,lang) for lang,term in c['meaningTerms'].items()}
        c['literalTransliterations']={lang:romanize(term,lang) for lang,term in c['literalTerms'].items()}
    if c.get('kind')=='phrase':
        assert set(c['literalGlosses'])==set(data['languages'])
    if c.get('kind') in ('phrase','expression'):
        assert set(c['details']['examples'])==set(data['languages']),c['id']
        assert set(c['details']['replies'])==set(data['languages']),c['id']
        assert c['details']['reviewStatus']=='draft',c['id']
for a,b,_ in data['bridges']:
    assert a in ids and b in ids

# Task associations remain a small, inspectable overlay over existing IDs. The
# utility values preserve the current next-step policy; they are not graph scores.
task_path=ROOT/'data/task-material-relations.json'
task_material=json.loads(task_path.read_text(encoding='utf-8'))
assert set(task_material)=={'schemaVersion','version','status','notice','profiles'}
assert task_material['schemaVersion']==1 and task_material['status']=='authored-unreviewed'
assert isinstance(task_material['version'],str) and task_material['version']
assert isinstance(task_material['notice'],str) and task_material['notice']
assert isinstance(task_material['profiles'],list) and len(task_material['profiles'])<=100
profile_ids=set()
for profile in task_material['profiles']:
    assert set(profile)=={'id','purposeFamily','label','materials'}
    assert all(isinstance(profile[key],str) and profile[key] for key in ('id','purposeFamily','label'))
    assert profile['id'] not in profile_ids
    profile_ids.add(profile['id'])
    assert isinstance(profile['materials'],list) and len(profile['materials'])<=100
    material_keys=set()
    for material in profile['materials']:
        assert set(material)=={'conceptId','role','title','taskUtility'}
        assert material['conceptId'] in ids
        assert all(isinstance(material[key],str) and material[key] for key in ('role','title'))
        assert type(material['taskUtility']) in (int,float) and math.isfinite(material['taskUtility'])
        key=(material['conceptId'],material['role'])
        assert key not in material_keys
        material_keys.add(key)
task_content='/* Generated from data/task-material-relations.json; edit the JSON source. */\nexport const TASK_MATERIAL_RELATIONS = '+json.dumps(task_material,ensure_ascii=False,separators=(',',':'))+';\n'
assert '</script' not in task_content.lower()
(ROOT/'public/nabu-task-material-data.js').write_text(task_content,encoding='utf-8')

# A source fingerprint identifies the structural snapshot without relabelling
# legacy concept IDs or changing their persisted identities.
source_paths=('data/wordgraph-source.json','data/phrasebank-source.json',
              'data/explore.json','data/graph-integrity.json',
              'data/task-material-relations.json','tools/graph-engine.js','tools/build_graph.py',
              'public/nabu-graph-kernel.js','public/nabu-structure-query.js',
              'public/nabu-structure.js','public/nabu-content.js',
              'tools/build_media_catalogue.py')
source_hashes=[{'path':path,'sha256':hashlib.sha256((ROOT/path).read_bytes()).hexdigest()} for path in source_paths]
data['structureSourceManifest']={
    'schemaVersion':1,
    'sha256':hashlib.sha256(json.dumps(source_hashes,sort_keys=True,separators=(',',':')).encode()).hexdigest(),
    'sources':source_hashes,
    'bridgeOrigins':bridge_origins,
}

content='// Generated by tools/build_graph.py. Edit data/wordgraph-source.json and data/phrasebank-source.json.\nexport const DATA = '+json.dumps(data,ensure_ascii=False,separators=(',',':'))+';\n'+(ROOT/'tools/graph-engine.js').read_text(encoding='utf-8')
assert '</script' not in content.lower()
(ROOT/'public/nabu-graph.js').write_text(content,encoding='utf-8')
print(f"Graph: {len(ids)} meanings, {len(ids)*12} forms, {len(ids)*132} directed translation links.")
