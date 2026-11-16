"""Idempotently merge the original bank with the reviewed-in-code draft expansion.

This validates structure, not linguistic accuracy. Edit data/expansion/* to update
release-authored entries, then run npm run build. Original concept IDs stay stable.
"""
from pathlib import Path
import json,re,hashlib,collections
ROOT=Path(__file__).resolve().parents[1]
BASE=ROOT/'data'; EXTRA=BASE/'expansion'; EDITION='bank-1.5.0'
def read(p): return json.loads(p.read_text(encoding='utf-8'))
def write(p,d): p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
w=read(BASE/'wordgraph-source.json'); p=read(BASE/'phrasebank-source.json'); langs=w['languages']
w['concepts']=[c for c in w['concepts'] if c.get('edition')!=EDITION]
p['concepts']=[c for c in p['concepts'] if c.get('edition')!=EDITION]
assert len(w['concepts'])==300 and len(p['concepts'])==42
manifest_path=EXTRA/'legacy-manifest.json'
if not manifest_path.exists():
    write(manifest_path,{'version':'1.4.1','ids':[c['id'] for c in w['concepts']+p['concepts']],
       'identityFields':{c['id']:{'terms':c['terms'],'sense':c['sense']} for c in w['concepts']+p['concepts']}})
# Only the authored expansion is regenerated; no learner data is read or changed.
existing_ids={c['id'] for c in w['concepts']+p['concepts']}
w['bridges']=[b for b in w['bridges'] if b[0] in existing_ids and b[1] in existing_ids]
notes={
 'relatives':'Kinship labels vary by family branch, gender and age. These are representative dictionary forms, not interchangeable forms for every relative. Italian nipote can mean nephew, niece or grandchild; use context.',
 'occupations':'Occupation names may change with gender. Arabic masculine singular and common dictionary forms are shown where applicable.',
 'calendar':'Calendar vocabulary. Month naming varies regionally in Arabic; seasons refer to the season, not other meanings of the word.',
 'movement':'Verb sense. Arabic uses a third-person masculine present form; other languages use common dictionary forms. Inflect for the speaker and tense.',
 'communication':'Verb sense. Arabic uses a third-person masculine present form. Inflect these dictionary forms for the sentence.',
 'skills':'Verb sense. Forms are dictionary forms, not complete instructions; Arabic uses third-person masculine present.',
 'descriptions':'Adjective sense. Gender, number and inflection can change in context; where relevant masculine singular is shown.',
 'connectors':'Function word or adverb. Position and grammar differ across languages; a word-by-word substitution is not always valid.',
 'technology':'Technology sense, not a physical animal or unrelated everyday sense where the word is ambiguous.',
 'anatomy':'Body-part sense; grammatical forms and figurative uses differ by context.'}
senses={
 'parent':'parent (one of a child\'s parents)', 'mouse':'computer mouse',
 'sleep':'sleep (noun; state of rest)', 'fly':'fly (insect)', 'change':'change (money returned after payment)',
 'account':'bank account', 'bill':'restaurant bill', 'square':'public square (place)',
 'capital':'capital city', 'palm':'palm of the hand', 'tongue':'tongue (body part)',
 'free':'free of charge', 'thin':'thin (small thickness)', 'spring':'spring (season)',
 'May':'May (calendar month)', 'painting':'painting (art activity)', 'heat':'heat (high temperature)',
 'light':'light (not heavy)', 'right':'right-hand direction', 'left':'left-hand direction',
 'train':'train (verb; practice a skill)', 'lie':'lie (say something untrue)', 'miss':'miss (fail to catch or attend)'}
first={}; counts=collections.Counter()
for line in (EXTRA/'words.tsv').read_text(encoding='utf-8').splitlines():
    if not line.strip():continue
    if line.startswith('# '):
        cat,label=line[2:].split('|',1);w['categories'][cat]=label;continue
    fields=line.split('|');assert len(fields)==13,line
    cat=fields[0];terms=dict(zip(langs,fields[1:]));en=terms['en'];key=re.sub(r'[^a-z0-9]+','_',en.lower()).strip('_');id=cat+'.'+key
    assert id not in existing_ids,id;existing_ids.add(id);first.setdefault(cat,id);counts[cat]+=1
    sense=senses.get(en,en)
    if cat=='movement' and en=='fly':sense='fly (verb; travel through the air)'
    if cat!='technology' and en=='mouse':sense='mouse (animal)'
    note=notes.get(cat,'Everyday dictionary sense. Regional wording and grammatical forms can vary; use context.')
    w['concepts'].append({'id':id,'category':cat,'sense':sense,'pos':'verb' if cat in ['movement','communication','skills'] else 'adjective' if cat=='descriptions' else 'word' if cat=='connectors' else 'noun','terms':terms,'aliases':{},'note':note,'edition':EDITION,'reviewStatus':'draft'})
assert len(counts)==24 and all(n==25 for n in counts.values())
# Connect every new topic to the existing connected semantic graph, not as synonyms.
anchors={'relatives':'people','occupations':'work','furnishings':'home','kitchenware':'home',
 'meals':'food','ingredients':'food','harvest':'produce','outdoors':'nature','environment':'nature',
 'wildlife':'animals','anatomy':'body','wellbeing':'health','accessories':'clothes','mobility':'travel',
 'destinations':'city','calendar':'time','business':'work','technology':'work','leisure':'work',
 'movement':'actions','communication':'essentials','skills':'daily','descriptions':'qualities','connectors':'reference'}
for cat,id in first.items():
    anchor=next(c['id'] for c in w['concepts'] if c['category']==anchors[cat]);w['bridges'].append([id,anchor,'related-topic'])
reply_map={
'your_name':'name','where_from':'from','live_here':'also','first_time':'welcome','learning_language':'practice',
'correct_me':'yes','agree':'understand','disagree':'why','take_your_time':'thanks','congratulations':'thanks',
'table_two':'follow','see_menu':'here','no_meat':'understand','contains_nuts':'check','without_sugar':'yes',
'some_water':'here','delicious':'thanks','another_one':'yes','breakfast_included':'check','takeaway':'yes',
'reservation':'name_please','check_in':'name_please','checkout_time':'eleven','leave_luggage':'yes','buy_ticket':'counter',
'seat_taken':'sit','which_platform':'platform','airport_bus':'left','missed_train':'next_train','call_taxi':'yes',
'smaller_size':'which_size','larger_size':'which_size','try_on':'yes','just_looking':'no_problem','another_color':'check',
'return_item':'check','receipt_please':'here','too_expensive':'understand','take_it':'thanks','fitting_room':'left',
'what_time':'three','how_long':'ten_minutes','walking_distance':'ten_minutes','turn_left':'thanks','go_straight':'thanks',
'open_today':'check','running_late':'no_problem','meet_here':'yes','wifi_here':'yes','wifi_password':'check_sign',
'send_link':'yes','cannot_open_file':'resend','practice_together':'yes','pronunciation':'repeat',
'give_example':'compare','formal_informal':'polite','whats_difference':'compare','forgot_word':'describe',
'try_again':'ready','makes_sense':'understood'}
expr_replies={
'break_ice':'yes','spill_beans':'keep_secret','put_foot':'not_worry','sword_wall':'help','cost_eyes':'true',
'stand_up':'help','patience_key':'thanks','hunayn_slippers':'not_worry','snake_feet':'understand','mend_pen':'yes',
'fly_elephant':'understand','noodles_ears':'careful','press_thumbs':'thanks','tomato_eyes':'not_worry',
'in_green':'help','holes_hands':'careful','dumplings_flowers':'also','monkeys_fall':'true','wide_feet':'understand',
'big_hands':'thanks','token_fell':'understood','pay_duck':'help','drops_lake':'true','flea_camel':'understand'}
replies=read(EXTRA/'replies.json');examples=read(EXTRA/'expression-examples.json')
references={
'spill_beans':['https://dictionary.cambridge.org/us/dictionary/english/spill-the-beans'],
'break_ice':['https://www.dictionary.com/browse/break-the-ice'],
'wide_feet':['https://world.kbs.co.kr/service/contents_view.htm?board_seq=369320'],
'big_hands':['https://world.kbs.co.kr/service/contents_view.htm?board_seq=369320'],
'press_thumbs':['https://dasakademie.com/de/sprache-und-kultur/redewendungen/'],
'tomato_eyes':['https://dasakademie.com/de/sprache-und-kultur/redewendungen/'],
'put_foot':['https://www.larousse.fr/dictionnaires/francais-espagnol/pied/60391'],
'sword_wall':['https://www.larousse.fr/dictionnaires/francais-espagnol/pied/60391'],
'token_fell':['https://observalinguaportuguesa.org/lista-de-expressoes-idiomaticas/']}
for filename,kind in [('phrases.json','phrase'),('expressions.json','expression')]:
    entries=read(EXTRA/filename);assert len(entries)==(60 if kind=='phrase' else 24)
    for raw in entries:
        c=dict(raw);key=c['id'].split('.',1)[1];r=replies[(reply_map if kind=='phrase' else expr_replies)[key]]
        usage=c.pop('usage');c.update({'category':'phrases' if kind=='phrase' else 'expressions','kind':kind,
          'sense':c.get('meaningTerms',c['terms'])['en'],'aliases':{},'edition':EDITION,'note':usage})
        c['details']={'usage':usage,'examples':{l:'A: '+c['terms'][l]+'\nB: '+r[l] for l in langs} if kind=='phrase' else examples[key],
          'replies':r,'reviewStatus':'draft','source':'AI-assisted original Nabu content; not independently native-reviewed.',
          'provenance':'Nabu authored meaning-aligned translation, gloss and example / unverified draft',
          'references':references.get(key,[]),'referenceScope':'Reference URLs support the source idiom sense only; translations and examples are independently authored drafts.'}
        if kind=='expression':c['details']['originScope']='Origin identifies the language of the supplied expression, not a historical-origin claim.'
        p['concepts'].append(c)
# Corrections to newly authored forms are stored separately and reproducible.
for id,fields in read(EXTRA/'corrections.json').items():
    c=next(c for c in w['concepts']+p['concepts'] if c['id']==id)
    for key,value in fields.items():
        if isinstance(value,dict):c.setdefault(key,{}).update(value)
        else:c[key]=value
w['version']=2;p['version']=2
w['provenance'].update({'kind':'AI-assisted original expanded vocabulary','humanReviewed':False,
 'scope':'900 word meanings plus 90 everyday phrases and 36 source-language expressions; not unrestricted sentence translation',
 'notice':'Sense-aligned authored draft. Automated coverage checks are not linguistic validation. No native-speaker approval is claimed.'})
p['reviewStatus']='Unverified authored draft: 90 practical phrases and 36 expressions, three supplied in each source language. English phrase glosses are wording guides, not target-language literal translations. Source-idiom literal renderings are available in all other supported languages.'
assert len(w['concepts'])==900 and len(p['concepts'])==126
write(BASE/'wordgraph-source.json',w);write(BASE/'phrasebank-source.json',p)
write(EXTRA/'manifest.json',{'edition':EDITION,'previous':{'words':300,'phrases':30,'expressions':12},
 'current':{'words':900,'phrases':90,'expressions':36},'languages':langs,'concepts':1026,'forms':12312,
 'directedSenseTranslations':135432,'nativeReviewed':False,'legacyIDsPreserved':342})
print('Expanded bank: 900 word meanings + 90 phrases + 36 expressions.')
