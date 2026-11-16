"""Nabu 1.14: deterministic, replayable content decisions over immutable events.

Enterprise is intentionally membership-gated; there is no implicit cross-user access.
This engine does not mutate cards, review schedules, or Structure Lens evidence.
"""
import json
import math
from collections import defaultdict
from fastapi import Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field
from content_progress import CATALOG, ITEMS

SCHEMA = """
CREATE TABLE IF NOT EXISTS decision_tenants (
 id TEXT PRIMARY KEY, label TEXT NOT NULL, owner_user_id TEXT NOT NULL
 REFERENCES users(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS decision_memberships (
 tenant_id TEXT NOT NULL REFERENCES decision_tenants(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 role TEXT NOT NULL CHECK(role IN ('owner','member')),
 PRIMARY KEY(tenant_id,user_id));
"""

class TenantCreate(BaseModel):
    model_config = ConfigDict(extra='forbid')
    id: str = Field(pattern=r'^[a-zA-Z0-9_-]{3,64}$')
    label: str = Field(min_length=1,max_length=120)

class TenantJoin(BaseModel):
    model_config = ConfigDict(extra='forbid')
    userId: str = Field(min_length=1,max_length=128)

def replay(events):
    """Pure fold: event time then ID, independent of arrival order."""
    state = defaultdict(lambda: {'opened':0,'finished':False,'position':None,
                                  'preferences':0,'attempts':0,'correct':0,
                                  'assisted':0,'skipped':0,'lastAt':0})
    seen = set()
    for e in sorted(events,key=lambda x:(x['at'],x['id'])):
        # The additive audit stream has its own observation projector. It must
        # not become legacy reading progress or inflate legacy decision counts.
        if e.get('kind')=='evidence':continue
        if e['id'] in seen: continue
        seen.add(e['id'])
        key=(e['contentId'],e['version'])
        if key not in ITEMS: continue
        s=state[key];k=e['kind'];s['lastAt']=max(s['lastAt'],e['at'])
        if k=='opened':s['opened']+=1
        elif k=='finished':s['finished']=e['value']
        elif k=='position':s['position']={'segmentId':e['segmentId'],'fraction':e['fraction']}
        elif k=='preference':s['preferences']+=1 if e['value'] else -1
        elif k=='attempt':
            s['attempts']+=1
            if e.get('skipped'):s['skipped']+=1;continue
            if e.get('assisted'):s['assisted']+=1
            task=next((p for p in ITEMS[key]['practice'] if p['id']==e['activityId']),None)
            if task and task['mode']!='recall' and e.get('choice')==task['answer']:
                s['correct']+=1
            # Free-form recall is not auto-graded. Never manufacture correctness.
    return state

def decide(events, mode, destination=None, tenant_id=None):
    # Old progress has no tenant attribution and keeps its account-level
    # contract. Newly enveloped progress must match the requested scope before
    # either the legacy fold or its public event count can use it.
    events=[event for event in events if event.get('kind')!='evidence' and (
        'evidence' not in event or (
            isinstance(event['evidence'],dict)
            and isinstance(event['evidence'].get('actor'),dict)
            and 'tenantId' in event['evidence']['actor']
            and event['evidence']['actor']['tenantId']==tenant_id
        )
    )]
    if mode not in {'individual-defined','individual-undefined','enterprise-defined','enterprise-undefined'}:
        raise HTTPException(422,'Unknown decision mode.')
    defined=mode.endswith('-defined') and not mode.endswith('-undefined')
    if defined and not destination:raise HTTPException(422,'A destination is required in defined mode.')
    if not defined and destination:raise HTTPException(422,'Undefined mode must not supply a destination.')
    state=replay(events)
    eligible=[]
    for item in CATALOG['items']:
        key=(item['id'],item['version']);s=state.get(key)
        if destination and destination.lower() not in (item['id'].lower(),item['title'].lower(),item['language'].lower(),item.get('interest','').lower()):
            continue
        if s and s['finished']:continue
        # Transparent heuristic, not a calibrated mastery posterior.
        novelty=1/(1+(s['opened'] if s else 0))
        progress=0.15 if s and s['position'] else 0
        preference=max(-0.2,min(0.2,(s['preferences'] if s else 0)*0.1))
        score=round(novelty+progress+preference,4)
        eligible.append({'contentId':item['id'],'version':item['version'],
                         'title':item['title'],'language':item['language'],
                         'score':score,'reason':{'novelty':round(novelty,4),
                         'resume':progress,'preference':preference},
                         'nextAction':'resume' if progress else 'open'})
    eligible.sort(key=lambda x:(-x['score'],x['contentId']))
    return {'schemaVersion':1,'mode':mode,'destination':destination,
            'tenantId':tenant_id,'evidenceEvents':len(events),
            'state':{'contentItems':len(state),'completed':sum(bool(s['finished']) for s in state.values())},
            'recommendations':eligible[:5], 'decisionPolicy':'deterministic-content-v1',
            'caveats':['Scores are heuristic priorities, not calibrated probabilities.',
                       'Free-form recall is not auto-graded.',
                       'Structure Lens evidence and spaced-repetition schedules are untouched.']}

def install_decision_engine(app, connection, authenticated):
    @app.post('/api/decision-tenants')
    def create_tenant(body:TenantCreate,session=Depends(authenticated)):
        uid=session['user_id']
        with connection() as c:
            c.execute('BEGIN IMMEDIATE')
            try:
                c.execute('INSERT INTO decision_tenants VALUES(?,?,?)',(body.id,body.label,uid))
                c.execute('INSERT INTO decision_memberships VALUES(?,?,?)',(body.id,uid,'owner'))
                c.commit()
            except Exception:
                c.rollback();raise HTTPException(409,'Tenant identifier is unavailable.')
        return {'id':body.id,'label':body.label,'role':'owner'}

    @app.post('/api/decision-tenants/{tenant_id}/members')
    def add_member(tenant_id:str,body:TenantJoin,session=Depends(authenticated)):
        uid=session['user_id']
        with connection() as c:
            owner=c.execute('SELECT 1 FROM decision_memberships WHERE tenant_id=? AND user_id=? AND role=?',(tenant_id,uid,'owner')).fetchone()
            if not owner:raise HTTPException(403,'Only tenant owners may add members.')
            if not c.execute('SELECT 1 FROM users WHERE id=?',(body.userId,)).fetchone():raise HTTPException(404,'User not found.')
            c.execute('INSERT OR IGNORE INTO decision_memberships VALUES(?,?,?)',(tenant_id,body.userId,'member'))
            c.commit()
        return {'tenantId':tenant_id,'userId':body.userId,'role':'member'}

    @app.get('/api/decisions')
    def get_decisions(mode:str=Query(default='individual-undefined'),
                      destination:str|None=None,tenantId:str|None=None,
                      session=Depends(authenticated)):
        uid=session['user_id']
        enterprise=mode.startswith('enterprise-')
        if enterprise and not tenantId:raise HTTPException(422,'Enterprise mode requires tenantId.')
        if not enterprise and tenantId:raise HTTPException(422,'Individual mode cannot use tenantId.')
        with connection() as c:
            if enterprise:
                membership=c.execute('SELECT 1 FROM decision_memberships WHERE tenant_id=? AND user_id=?',(tenantId,uid)).fetchone()
                if not membership:raise HTTPException(403,'Not a tenant member.')
                # Per-user recommendations remain private even inside a tenant.
            rows=c.execute('SELECT payload FROM content_events WHERE user_id=?',(uid,)).fetchall()
        return decide([json.loads(r['payload']) for r in rows],mode,destination,tenantId)
