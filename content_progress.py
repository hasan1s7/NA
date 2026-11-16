"""Small additive, account-private content progress API. Existing auth/CSRF and
SQLite backup machinery are reused. Immutable IDs make lost-ACK retries safe.
No words, schedules, settings or legacy tables are rewritten.
"""
from pathlib import Path
import json, re, time, math
from fastapi import Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field

CATALOG=json.loads((Path(__file__).parent/'data/explore.json').read_text(encoding='utf-8'))
ITEMS={(p['id'],p['version']):p for p in CATALOG['items']}
MAX_EVENTS=8000
EVIDENCE_FIELDS={
    'schemaVersion','episodeId','attemptId','retryOfEpisodeId','actor','intentRef',
    'organizationObjectiveRef','taskRef','occurrence','inputModality',
    'outputModality','observation','assistance','presentedAt','response',
    'rubricRef','scorerRef','analysisRef','assessment','skipReason',
}
ASSISTANCE_FIELDS={
    'lookup','hint','answerShown','translationShown','replayed','feedbackShown',
    'baseMeaningSupplied','sourceVisible','other',
}
CONTEXT_FIELDS={'lexicalId','senseId','speakerId','syntaxId','contextId'}
OBSERVATIONS={'displayed','played','lookup','hint','answer-revealed','response','skipped'}
REFERENCE_STATUSES={'authored','verified','inferred','unknown','quarantined'}
TASK_OBSERVATIONS={'hint','answer-revealed','response','skipped'}
MAX_SAFE_INTEGER=2**53-1
JS_WHITESPACE='\u0009\u000a\u000b\u000c\u000d\u0020\u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000\ufeff'
SCHEMA="""CREATE TABLE IF NOT EXISTS content_events (
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          event_id TEXT NOT NULL, content_id TEXT NOT NULL, content_version INTEGER NOT NULL,
          payload TEXT NOT NULL, received_at INTEGER NOT NULL,
          PRIMARY KEY(user_id,event_id));
"""

class EventBatch(BaseModel):
    model_config=ConfigDict(extra='forbid')
    events:list[dict]=Field(min_length=1,max_length=50)


def _invalid(message):
    raise HTTPException(422,message)


def _object(value,fields,label):
    if not isinstance(value,dict) or set(value)!=fields:
        _invalid('Invalid '+label+' fields.')


def _text(value,limit,label,nullable=False):
    if value is None and nullable:return
    if (not isinstance(value,str) or not value.strip(JS_WHITESPACE) or re.search(r'[\x00-\x1f\x7f]',value)
            or len(value.encode('utf-16-le',errors='surrogatepass'))//2>limit):
        _invalid('Invalid '+label+'.')


def _identifier(value,label,nullable=False):
    if value is None and nullable:return
    if not isinstance(value,str) or not re.fullmatch(r'[a-zA-Z0-9_-]{16,80}',value):
        _invalid('Invalid '+label+'.')


def _integer(value,label,maximum=MAX_SAFE_INTEGER,minimum=0):
    if type(value) is not int or not minimum<=value<=maximum:
        _invalid('Invalid '+label+'.')


def _version(value,label):
    if type(value) is int:_integer(value,label,1_000_000,1)
    else:_text(value,80,label)


def _reference(value,label):
    if value is None:return
    _object(value,{'id','version','status','provenance'},label)
    _text(value['id'],160,label+' identifier');_version(value['version'],label+' version')
    if not isinstance(value['status'],str) or value['status'] not in REFERENCE_STATUSES:_invalid('Invalid '+label+' status.')
    if not isinstance(value['provenance'],list) or len(value['provenance'])>12:
        _invalid('Invalid '+label+' provenance.')
    for source in value['provenance']:
        _object(source,{'sourceId','locator','kind'},label+' provenance')
        for key,limit in (('sourceId',200),('locator',300),('kind',80)):
            _text(source[key],limit,label+' provenance '+key)


def validate_evidence(event):
    """Validate immutable observations, not linguistic truth or learner ability.

    Historical media, task, scorer, rubric and analysis versions are retained as
    supplied references. There is deliberately no lookup of today's catalogue
    or answer policy here, and no grading or mastery write on ingestion.
    """
    evidence=event.get('evidence')
    _object(evidence,EVIDENCE_FIELDS,'evidence')
    if type(evidence['schemaVersion']) is not int or evidence['schemaVersion']!=1:
        _invalid('Unsupported evidence schema.')
    _identifier(evidence['episodeId'],'episode identifier')
    _identifier(evidence['attemptId'],'attempt identifier',nullable=True)
    _identifier(evidence['retryOfEpisodeId'],'retry episode identifier',nullable=True)
    if evidence['retryOfEpisodeId']==evidence['episodeId']:
        _invalid('An episode cannot retry itself.')
    actor=evidence['actor'];_object(actor,{'userId','tenantId'},'evidence actor')
    _text(actor['userId'],160,'evidence user',nullable=True)
    if actor['userId']=='!locked':_invalid('A locked account cannot record evidence.')
    if actor['tenantId'] is not None and (not isinstance(actor['tenantId'],str) or not re.fullmatch(r'[a-zA-Z0-9_-]{3,64}',actor['tenantId'])):
        _invalid('Invalid evidence team.')
    if actor['tenantId'] is not None and actor['userId'] is None:
        _invalid('Team evidence requires an account.')
    for key in ('intentRef','organizationObjectiveRef'):
        ref=evidence[key]
        if ref is not None:
            _object(ref,{'id','revision'},key)
            _text(ref['id'],160,key+' identifier');_integer(ref['revision'],key+' revision',1_000_000,1)
    if actor['tenantId'] is None and evidence['organizationObjectiveRef'] is not None:
        _invalid('An organization objective requires a team.')
    task=evidence['taskRef']
    if task is not None:
        _object(task,{'id','version'},'task reference')
        _text(task['id'],160,'task identifier');_version(task['version'],'task version')
    occurrence=evidence['occurrence']
    _object(occurrence,{'contentId','version','segmentId','annotationId','readingId','context'},'occurrence')
    _text(occurrence['contentId'],160,'content identifier')
    _integer(occurrence['version'],'content version',1_000_000,1)
    if occurrence['contentId']!=event.get('contentId') or occurrence['version']!=event.get('version'):
        _invalid('Evidence must identify the event content and version.')
    for key in ('segmentId','annotationId','readingId'):
        _text(occurrence[key],160,'occurrence '+key,nullable=True)
    _object(occurrence['context'],CONTEXT_FIELDS,'occurrence context')
    for key in CONTEXT_FIELDS:_text(occurrence['context'][key],160,'context '+key,nullable=True)
    if evidence['inputModality'] not in ('text','audio','audiovisual','none'):
        _invalid('Invalid evidence input modality.')
    if evidence['outputModality'] not in ('choice','text','speech','none'):
        _invalid('Invalid evidence output modality.')
    observation=evidence['observation']
    if not isinstance(observation,str) or observation not in OBSERVATIONS:_invalid('Invalid observation.')
    _object(evidence['assistance'],ASSISTANCE_FIELDS,'assistance')
    if any(type(value) is not bool for value in evidence['assistance'].values()):
        _invalid('Assistance must be explicit boolean flags.')
    _integer(event.get('at'),'evidence event time')
    presented=evidence['presentedAt']
    if presented is not None:
        _integer(presented,'presentation time')
        if presented>event['at']:_invalid('Presentation cannot follow the observation.')
    for key in ('rubricRef','scorerRef','analysisRef'):_reference(evidence[key],key)
    if observation in TASK_OBSERVATIONS and any(evidence[key] is None for key in ('attemptId','taskRef','rubricRef','scorerRef','presentedAt')):
        _invalid('A task observation requires its attempt, task, rubric, scorer and presentation time.')
    if evidence['attemptId'] is not None and task is None:
        _invalid('An attempt identifier requires a task reference.')
    if observation=='played' and evidence['inputModality'] not in ('audio','audiovisual'):
        _invalid('Playback requires an audio input modality.')
    if evidence['skipReason'] not in (None,'not-now','too-easy','too-hard','other') or (observation!='skipped' and evidence['skipReason'] is not None):
        _invalid('Invalid explicit skip reason.')
    response=evidence['response'];assessment=evidence['assessment']
    if observation=='response':
        if not isinstance(response,dict) or set(response) not in ({'choice'},{'answer'}):
            _invalid('A response must contain one bounded choice or answer.')
        if 'choice' in response:
            _integer(response['choice'],'response choice',99)
            if evidence['outputModality']!='choice':_invalid('Choice response modality does not match.')
        else:
            answer=response['answer']
            if (not isinstance(answer,str) or not answer.strip(JS_WHITESPACE)
                    or re.search(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]',answer)
                    or len(answer.encode('utf-16-le',errors='surrogatepass'))//2>300):
                _invalid('Enter a response of at most 300 characters.')
            if evidence['outputModality'] not in ('text','speech'):_invalid('Answer response modality does not match.')
        if assessment is not None:
            _object(assessment,{'outcome','basis'},'assessment')
            if assessment['outcome'] not in ('correct','incorrect','unscored') or assessment['basis'] not in ('authored-rule','self-report'):
                _invalid('Invalid declared assessment.')
    elif response is not None or assessment is not None or evidence['outputModality']!='none':
        _invalid('Only a response observation can contain a response, assessment or output modality.')
    if event['kind']=='evidence':
        if event.get('sessionId')!=evidence['episodeId']:_invalid('Evidence session must match its episode.')
    elif event['kind']=='opened':
        if observation!='displayed':_invalid('Opening evidence must describe a display.')
    elif event['kind']=='help':
        expected='hint' if event.get('help')=='hint' else 'answer-revealed'
        if observation!=expected:_invalid('Help evidence does not match the original event.')
    elif event['kind']=='attempt':
        expected='skipped' if event.get('skipped',False) else 'response'
        if observation!=expected:_invalid('Attempt evidence does not match its skip status.')
        if observation=='response' and any(event.get(key)!=value for key,value in response.items()):
            _invalid('Evidence response does not match the original attempt.')
    return evidence


def _authorize_evidence(conn,uid,event,check_references=True):
    evidence=event.get('evidence')
    if evidence is None:return
    actor=evidence['actor'];tenant=actor['tenantId']
    if actor['userId']!=uid:raise HTTPException(403,'Evidence belongs to the authenticated learner only.')
    if tenant is not None and not conn.execute('SELECT 1 FROM decision_memberships WHERE tenant_id=? AND user_id=?',(tenant,uid)).fetchone():
        raise HTTPException(403,'You are not a member of this evidence team.')
    if not check_references:return
    for key,kind in (('intentRef','learner'),('organizationObjectiveRef','organization')):
        ref=evidence[key]
        if ref is None:continue
        row=conn.execute('SELECT owner_user_id,tenant_id,kind,revision FROM nabu_intents WHERE id=?',(ref['id'],)).fetchone()
        if row is None or row['tenant_id']!=tenant or row['kind']!=kind or (kind=='learner' and row['owner_user_id']!=uid):
            raise HTTPException(404,'Evidence intent reference was not found in this scope.')
        if ref['revision']>row['revision']:
            raise HTTPException(409,'Evidence refers to a newer intent revision. Refresh the intention before trying again.')


def _same_attempt(left,right):
    keys=('actor','episodeId','intentRef','organizationObjectiveRef','occurrence','taskRef',
          'inputModality','rubricRef','scorerRef','analysisRef','presentedAt')
    if any(left.get(key)!=right.get(key) for key in keys):return False
    outputs={value for value in (left.get('outputModality'),right.get('outputModality')) if value!='none'}
    return len(outputs)<=1


def _check_evidence_identity(event,history):
    """IDs identify deliveries, episodes and attempts independently.

    Episodes may cover several task targets. A single attempt cannot silently
    change its source or scorer, or count a second terminal response under a new
    delivery ID. New attempts/retries receive new IDs and remain separate facts.
    """
    evidence=event.get('evidence')
    if evidence is None:return
    parents={}
    for old in history:
        prior=old.get('evidence')
        if not isinstance(prior,dict):continue
        if prior.get('actor')==evidence['actor']:
            parents[prior.get('episodeId')]=prior.get('retryOfEpisodeId')
        if prior.get('episodeId')==evidence['episodeId'] and (prior.get('actor')!=evidence['actor'] or prior.get('retryOfEpisodeId')!=evidence['retryOfEpisodeId']):
            raise HTTPException(409,'An evidence episode ID was reused with a different actor or retry parent.')
        if evidence['attemptId'] is not None and prior.get('attemptId')==evidence['attemptId']:
            if not _same_attempt(prior,evidence):
                raise HTTPException(409,'An evidence attempt ID was reused with different task or source metadata.')
            if prior.get('observation') in ('response','skipped') and evidence['observation'] in ('response','skipped'):
                raise HTTPException(409,'This evidence attempt already has a terminal response. Retry delivery with its original event ID.')
    parents[evidence['episodeId']]=evidence['retryOfEpisodeId']
    cursor=evidence['episodeId'];seen=set()
    while cursor in parents:
        if cursor in seen:raise HTTPException(409,'Evidence retry lineage cannot contain a cycle.')
        seen.add(cursor);cursor=parents[cursor]

def validate_event(e):
    common={'id','contentId','version','kind','at'}
    extra={'opened':{'evidence'},'position':{'segmentId','fraction'},'finished':{'value'},'preference':{'value'},
           'help':{'activityId','sessionId','help','evidence'},'attempt':{'activityId','sessionId','answer','choice','assisted','skipped','evidence'},
           'saved':{'annotationId','cardId'},'evidence':{'sessionId','evidence'}}
    kind=e.get('kind')
    if not isinstance(kind,str) or kind not in extra or set(e)-common-extra[kind]:
        raise HTTPException(422,'Invalid progress action or fields.')
    if not isinstance(e.get('contentId'),str) or type(e.get('version')) is not int:
        raise HTTPException(422,'Invalid content version.')
    if kind=='evidence':
        if set(e)!=common|extra[kind]:_invalid('Invalid evidence event fields.')
        _identifier(e.get('id'),'evidence event identifier')
        validate_evidence(e)
        if e['at']>(time.time()+86400)*1000:_invalid('Invalid event time.')
        return e
    item=ITEMS.get((e['contentId'],e['version']))
    if item is None and 'evidence' in e:
        # An immutable historical wrapper can outlive its catalogue release.
        # Its versioned task/scorer must later resolve explicitly or stay stale;
        # today's answer policy is not a prerequisite for retaining the event.
        _identifier(e.get('id'),'evidence event identifier')
        validate_evidence(e)
        if e['at']>(time.time()+86400)*1000:_invalid('Invalid event time.')
        if kind in ('attempt','help'):
            _text(e.get('activityId'),80,'historical activity identifier')
            _identifier(e.get('sessionId'),'historical practice session')
        if kind=='attempt':
            if type(e.get('assisted')) is not bool or type(e.get('skipped',False)) is not bool:
                _invalid('Missing assistance or skip status.')
            if 'answer' in e and (not isinstance(e['answer'],str) or len(e['answer'].encode('utf-16-le',errors='surrogatepass'))//2>300):
                _invalid('Response is too long.')
            if 'choice' in e:_integer(e['choice'],'historical response choice',99)
        return e
    if not item or not isinstance(e.get('id'),str) or not re.fullmatch(r'[a-zA-Z0-9_-]{16,80}',e['id']):
        raise HTTPException(422,'Unknown content or event ID.')
    at=e.get('at')
    if type(at) not in (int,float) or not math.isfinite(at) or at<0 or at>(time.time()+86400)*1000:
        raise HTTPException(422,'Invalid event time.')
    if kind=='position':
        if e.get('segmentId') not in {s['id'] for s in item['segments']} or type(e.get('fraction')) not in (int,float) or not math.isfinite(e['fraction']) or not 0<=e['fraction']<=1:
            raise HTTPException(422,'Invalid reading position.')
    if kind in ('finished','preference') and type(e.get('value')) is not bool:
        raise HTTPException(422,'Invalid completion or preference.')
    if kind=='saved':
        if e.get('annotationId') not in {a['id'] for a in item['annotations']} or not isinstance(e.get('cardId'),str) or len(e['cardId'])>80:
            raise HTTPException(422,'Invalid saved-source reference.')
    if kind in ('help','attempt'):
        task=next((p for p in item['practice'] if p['id']==e.get('activityId')),None)
        if not task or not isinstance(e.get('sessionId'),str) or not re.fullmatch(r'[a-zA-Z0-9_-]{16,80}',e['sessionId']):
            raise HTTPException(422,'Invalid practice activity.')
        if kind=='help' and e.get('help') not in ('hint','answer'):
            raise HTTPException(422,'Invalid help event.')
        if kind=='attempt':
            if type(e.get('assisted')) is not bool or type(e.get('skipped',False)) is not bool:
                raise HTTPException(422,'Missing assistance or skip status.')
            if 'answer' in e and (not isinstance(e['answer'],str) or len(e['answer'])>300):
                raise HTTPException(422,'Response is too long.')
            if not e.get('skipped'):
                if task['mode']=='recall' and (not isinstance(e.get('answer'),str) or not e['answer'].strip()):
                    raise HTTPException(422,'Enter a short response.')
                if task['mode']!='recall' and (type(e.get('choice')) is not int or not 0<=e['choice']<len(task['options'])):
                    raise HTTPException(422,'Choose an answer.')
    if 'evidence' in e:validate_evidence(e)
    return e

def install_content_progress(app,connection,authenticated,rate):
    @app.get('/api/content-progress')
    def read_progress(session=Depends(authenticated)):
        with connection() as c:
            rows=c.execute('SELECT payload FROM content_events WHERE user_id=? ORDER BY received_at,event_id',(session['user_id'],)).fetchall()
        return {'schemaVersion':1,'events':[json.loads(r['payload']) for r in rows]}
    @app.post('/api/content-progress')
    def write_progress(batch:EventBatch,session=Depends(authenticated)):
        uid=session['user_id'];rate('content-write',uid,600,3600)
        events=[validate_event(e) for e in batch.events]
        with connection() as c:
            c.execute('BEGIN IMMEDIATE')
            try:
                count=c.execute('SELECT COUNT(*) FROM content_events WHERE user_id=?',(uid,)).fetchone()[0]
                history=[json.loads(row['payload']) for row in c.execute('SELECT payload FROM content_events WHERE user_id=?',(uid,)).fetchall()] if any('evidence' in event for event in events) else []
                for event in events:
                    encoded=json.dumps(event,ensure_ascii=False,separators=(',',':'),sort_keys=True)
                    old=c.execute('SELECT payload FROM content_events WHERE user_id=? AND event_id=?',(uid,event['id'])).fetchone()
                    # Even an exact retry must still be from the correct actor
                    # and a current team member. Deleted historical references
                    # do not prevent re-acknowledging an unchanged stored event.
                    _authorize_evidence(c,uid,event,check_references=old is None)
                    if old:
                        if old['payload']!=encoded:raise HTTPException(409,'A progress ID was reused with different data. Keep your local export and reopen the content.')
                        continue
                    if count>=MAX_EVENTS:raise HTTPException(409,'Progress history is full. Export your history; existing records are intact.')
                    _check_evidence_identity(event,history)
                    c.execute('INSERT INTO content_events VALUES(?,?,?,?,?,?)',(uid,event['id'],event['contentId'],event['version'],encoded,int(time.time()*1000)));count+=1
                    if 'evidence' in event:history.append(event)
                c.commit()
            except Exception:
                c.rollback();raise
        return {'accepted':[e['id'] for e in events]}
