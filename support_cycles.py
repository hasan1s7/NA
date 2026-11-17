"""Support-cycle validation on the existing private, append-only event ledger.
No scoring or learner-state writes occur on ingestion; references stay versioned.
"""
import json
from fastapi import HTTPException

MODEL='support-conditional-grid-v1'
POLICY='support-cycle-selection-v1'
FIELDS={'schemaVersion','episodeId','attemptId','parentEventId','actor','intentRef','organizationObjectiveRef','mediaRef','analysisRef','targetIds','taskRef','taskType','inputModality','responseModality','condition','observation','support','supportSnapshot','response','scoring','correction','modelVersion','selectionPolicyVersion'}
TYPES={'translation','gloss','paraphrase','transcript','highlighting','segmentation','image','scene-context','options','replay','slower-playback','another-recording','cross-language','historical-explanation','earlier-answer','feedback'}
OBSERVATIONS={'encounter','task-presented','support-available','support-opened','support-used','response','feedback','repair','playback','analysis-correction'}
SKILLS={'recognition','meaning-recall','form-recall','contextual-production'}


def validate_support_event(event):
    from content_progress import _object, _text, _identifier, _integer, _invalid
    def enum(value,values,label):
        if not isinstance(value,str) or value not in values:_invalid('Invalid '+label+'.')
    def ref(value,label):
        _object(value,{'id','version'},label);_text(value['id'],160,label);_integer(value['version'],label+' version',1_000_000,1)
    def support(value):
        _object(value,{'id','type','visibility','role'},'support');_text(value['id'],160,'support ID')
        enum(value['type'],TYPES,'support type');enum(value['visibility'],{'hidden','visible'},'visibility');enum(value['role'],{'task','extra'},'role')
    _object(event,{'id','contentId','version','kind','at','cycle'},'support event')
    _identifier(event['id'],'event ID');_integer(event['at'],'event time')
    if event['kind']!='support-cycle':_invalid('Invalid support kind.')
    e=event['cycle'];_object(e,FIELDS,'support envelope')
    if type(e['schemaVersion']) is not int or e['schemaVersion']!=1:_invalid('Unsupported support schema.')
    _identifier(e['episodeId'],'episode');_identifier(e['attemptId'],'attempt',True);_identifier(e['parentEventId'],'parent',True)
    if e['parentEventId']==event['id']:_invalid('An event cannot parent itself.')
    actor=e['actor'];_object(actor,{'userId','tenantId'},'actor');_text(actor['userId'],160,'learner',True)
    if actor['userId']=='!locked':_invalid('Locked accounts cannot record evidence.')
    if actor['tenantId'] is not None:
        import re
        if not isinstance(actor['tenantId'],str) or not re.fullmatch(r'[A-Za-z0-9_-]{3,64}',actor['tenantId']) or actor['userId'] is None:_invalid('Invalid team actor.')
    for key in ('intentRef','organizationObjectiveRef'):
        if e[key] is not None:
            _object(e[key],{'id','revision'},key);_text(e[key]['id'],160,key);_integer(e[key]['revision'],key+' revision',1_000_000,1)
    if actor['tenantId'] is None and e['organizationObjectiveRef'] is not None:_invalid('An objective requires a team.')
    for key in ('mediaRef','analysisRef','taskRef'):ref(e[key],key)
    if event['contentId']!=e['mediaRef']['id'] or event['version']!=e['mediaRef']['version'] or type(event['version']) is not int:_invalid('Support source and wrapper differ.')
    targets=e['targetIds']
    if not isinstance(targets,list) or not 1<=len(targets)<=8:_invalid('Invalid joint targets.')
    for target in targets:_text(target,160,'target')
    if len(set(targets))!=len(targets):_invalid('Duplicate joint targets.')
    enum(e['taskType'],SKILLS,'task type');enum(e['inputModality'],{'written','auditory','audiovisual'},'input modality');enum(e['responseModality'],{'none','choice','text','speech'},'response modality')
    _object(e['condition'],{'level','scopeId','itemId','contextId','speakerId','variety'},'condition');enum(e['condition']['level'],{'item','construction'},'level')
    for key,value in e['condition'].items():
        if key!='level':_text(value,160,'condition '+key)
    enum(e['observation'],OBSERVATIONS,'observation');action=e['observation']
    if action in {'support-available','support-opened','support-used'}:support(e['support'])
    elif e['support'] is not None:_invalid('Only support actions carry a support descriptor.')
    snapshot=e['supportSnapshot']
    if not isinstance(snapshot,list) or len(snapshot)>20:_invalid('Invalid support snapshot.')
    seen=set()
    for s in snapshot:
        _object(s,{'id','type','visibility','role','availableAt','openedAt','usedAt','useBasis'},'snapshot');support({k:s[k] for k in ('id','type','visibility','role')})
        if s['id'] in seen:_invalid('Duplicate snapshot support.')
        seen.add(s['id']);_integer(s['availableAt'],'availability',event['at'])
        for key in ('openedAt','usedAt'):
            if s[key] is not None:_integer(s[key],key,event['at'],s['availableAt'])
        if s['useBasis']!=('self-report' if s['usedAt'] is not None else None):_invalid('Use requires a self-report.')
    if action=='response':
        response=e['response']
        if e['attemptId'] is None or not isinstance(response,dict) or set(response) not in ({'answer'},{'choice'}):_invalid('One bounded response is required.')
        if 'choice' in response:
            _integer(response['choice'],'choice',99)
            if e['responseModality']!='choice':_invalid('Response modality mismatch.')
        else:
            _text(response['answer'],300,'answer')
            if e['responseModality'] not in ('text','speech'):_invalid('Response modality mismatch.')
        score=e['scoring'];_object(score,{'outcome','score','reliability','reason','ruleVersion'},'scoring');enum(score['outcome'],{'correct','partial','incorrect','abstain'},'score outcome')
        if type(score['reliability']) not in (int,float) or not 0<=score['reliability']<=1:_invalid('Invalid scoring reliability.')
        if score['score'] is not None and type(score['score']) not in (int,float):_invalid('Invalid score.')
        if score['score']!={'correct':1,'partial':.5,'incorrect':0,'abstain':None}[score['outcome']]:_invalid('Score and outcome disagree.')
        _text(score['reason'],400,'scoring reason');_text(score['ruleVersion'],80,'scoring rule')
    elif e['response'] is not None or e['scoring'] is not None or e['responseModality']!='none' or snapshot:_invalid('Only responses contain answers and frozen cue snapshots.')
    if action=='analysis-correction':
        c=e['correction'];_object(c,{'replaces','uses','note'},'correction');ref(c['replaces'],'old analysis');ref(c['uses'],'new analysis');_text(c['note'],400,'correction reason')
        if c['replaces']['id']!=c['uses']['id'] or c['uses']['version']<=c['replaces']['version'] or e['analysisRef']!=c['uses']:_invalid('A correction must advance and identify its version.')
    elif e['correction'] is not None:_invalid('Unexpected correction.')
    if e['attemptId'] is None and action in {'task-presented','support-available','support-opened','support-used','response','feedback','playback'}:_invalid('A task action requires an attempt.')
    if e['modelVersion']!=MODEL or e['selectionPolicyVersion']!=POLICY:_invalid('Unsupported model or policy version.')
    return event


def validate_support_sequence(events):
    def conflict(message):raise HTTPException(409,message)
    rows=sorted((validate_support_event(e) for e in events if e.get('kind')=='support-cycle'),key=lambda e:(e['at'],e['id']))
    ids={};episodes={};attempts={};terminals=set();supports={};corrections={}
    for event in rows:
        e=event['cycle'];attempt=e['attemptId'];action=e['observation']
        if event['id'] in ids:
            if event!=ids[event['id']]:conflict('A support event ID changed.')
            continue
        if e['parentEventId'] is not None:
            parent=ids.get(e['parentEventId'])
            if parent is None or parent['at']>=event['at'] or parent['cycle']['episodeId']!=e['episodeId'] or parent['cycle']['actor']!=e['actor']:conflict('Parent must be earlier in the same learner episode.')
        identity={k:e[k] for k in ('actor','intentRef','organizationObjectiveRef')}
        if e['episodeId'] in episodes and episodes[e['episodeId']]!=identity:conflict('Episode actor or scope changed.')
        episodes[e['episodeId']]=identity
        if attempt is not None:
            signature={k:e[k] for k in ('episodeId','actor','intentRef','organizationObjectiveRef','taskRef','mediaRef','analysisRef','taskType','inputModality','condition')};signature['targetIds']=sorted(e['targetIds'])
            if attempt in attempts and attempts[attempt]!=signature:conflict('Attempt identity changed.')
            attempts[attempt]=signature
        if e['support'] is not None:
            s=e['support'];state=supports.setdefault(attempt,{})
            if action=='support-available':
                if s['id'] in state:conflict('Support availability is immutable.')
                state[s['id']]={**s,'availableAt':event['at'],'openedAt':None,'usedAt':None,'useBasis':None}
            else:
                old=state.get(s['id'])
                if old is None or {k:old[k] for k in s}!=s:conflict('Cue action requires its original availability.')
                key='openedAt' if action=='support-opened' else 'usedAt'
                if old[key] is None:old[key]=event['at']
                if action=='support-used':old['useBasis']='self-report'
        if action=='response':
            if attempt in terminals:conflict('Attempt already has a response. Retry its original event ID.')
            prior=[p['cycle']['observation'] for p in ids.values() if p['cycle']['attemptId']==attempt]
            if 'task-presented' not in prior:conflict('A response needs its earlier presentation.')
            if e['inputModality']=='auditory' and 'playback' not in prior:conflict('Auditory evidence requires recorded playback.')
            if sorted(supports.get(attempt,{}).values(),key=lambda s:s['id'])!=e['supportSnapshot']:conflict('Response cues differ from their prior timeline.')
            terminals.add(attempt)
        if action=='analysis-correction':
            c=e['correction'];key=(json.dumps(e['actor'],sort_keys=True),c['replaces']['id'],c['replaces']['version'])
            if key in corrections and corrections[key]!=c['uses']:conflict('Conflicting analysis branches require reconciliation.')
            corrections[key]=c['uses']
        ids[event['id']]=event
    return rows
