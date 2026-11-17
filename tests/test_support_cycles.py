"""Real HTTP / SQLite persistence and shared JS/Python contract checks."""
import copy
import json
import sqlite3
import subprocess
import uuid

import pytest
from fastapi import HTTPException
from test_social import env, put, PASSWORD
from test_content_progress import send
from content_progress import validate_event
from support_cycles import validate_support_sequence


def fixture(user=None,correction=False):
    script="""import {createSupportFixture} from './tools/support_cycle_fixtures.mjs';
const f=createSupportFixture({actor:{userId:process.argv[1]==='guest'?null:process.argv[1],tenantId:null},at:Date.now()-10000});
const c=f.begin(process.argv[2]==='yes'?'support:fr:uncertain':'support:fr:meaning');
f.open(c,'translation');f.respond(c,{answer:\"I haven't talked to him about it.\"},{feedback:true});
if(process.argv[2]==='yes')f.correct(c);console.log(JSON.stringify(f.events));"""
    rows=json.loads(subprocess.check_output(['node','--input-type=module','-e',script,user or 'guest','yes' if correction else 'no'],text=True))
    # New recordings, not reused IDs, when tests generate a second episode.
    ids={}
    def fresh(old):
        if old is None:return None
        if old not in ids:ids[old]=str(uuid.uuid4())
        return ids[old]
    for e in rows:
        e['id']=fresh(e['id'])
        for key in ('episodeId','attemptId','parentEventId'):e['cycle'][key]=fresh(e['cycle'][key])
    return rows


def test_shared_contract_and_versioned_correction_fixture():
    rows=fixture(correction=True)
    for e in rows:assert validate_event(e)==e
    assert validate_support_sequence(rows)==rows
    assert len({e['cycle']['analysisRef']['version'] for e in rows})==2


@pytest.mark.parametrize('mutation',[
    lambda e:e.update(rawMedia='unnecessary private media'),
    lambda e:e['cycle'].update(mastered=True),
    lambda e:e['cycle'].update(schemaVersion=True),
    lambda e:e['cycle'].update(targetIds=['duplicate','duplicate']),
    lambda e:e['cycle'].update(responseModality='choice'),
    lambda e:e['cycle']['scoring'].update(score=True),
    lambda e:e['cycle']['scoring'].update(reliability=float('nan')),
    lambda e:e['cycle']['scoring'].update(outcome='incorrect'),
    lambda e:e['cycle']['supportSnapshot'][0].update(openedAt=e['at']+1),
    lambda e:e['cycle']['supportSnapshot'][0].update(useBasis='attention-tracking'),
])
def test_bounded_contract_rejects_unnecessary_content_and_invalid_fields(mutation):
    e=next(e for e in fixture() if e['cycle']['observation']=='response');mutation(e)
    with pytest.raises(HTTPException) as error:validate_event(e)
    assert error.value.status_code==422


def test_owner_private_idempotent_replay_does_not_touch_legacy_words_or_schema(env):
    app,new,_=env;a=new('support_owner');b=new('support_other');saved=put(a)
    with sqlite3.connect(app.state.db_path) as db:version=db.execute('PRAGMA user_version').fetchone()[0]
    rows=fixture(a.headers['X-Nabu-Account'],correction=True)
    assert a.get('/api/config').json()['supportCycles'] is True
    assert send(a,rows).status_code==200
    assert send(a,rows).status_code==200
    assert len(a.get('/api/content-progress').json()['events'])==len(rows)
    assert b.get('/api/content-progress').json()['events']==[]
    after=a.get('/api/library').json()['cards'];assert len(after)==1;assert after[0]['schedule']==saved['schedule']
    with sqlite3.connect(app.state.db_path) as db:assert db.execute('PRAGMA user_version').fetchone()[0]==version
    a.request('DELETE','/api/account',json={'password':PASSWORD})
    with sqlite3.connect(app.state.db_path) as db:assert db.execute('SELECT COUNT(*) FROM content_events WHERE user_id=?',(a.headers['X-Nabu-Account'],)).fetchone()[0]==0


def test_actor_csrf_and_team_authorization_reuse_existing_guards(env):
    _,new,_=env;a=new('support_owner');b=new('support_other')
    rows=fixture(b.headers['X-Nabu-Account']);assert send(a,rows).status_code==403
    rows=fixture(a.headers['X-Nabu-Account'])
    for e in rows:e['cycle']['actor']['tenantId']='not-a-member'
    assert send(a,rows).status_code==403
    rows=fixture(a.headers['X-Nabu-Account']);del a.headers['X-CSRF-Token'];assert send(a,rows).status_code==403
    assert a.get('/api/content-progress').json()['events']==[]


def test_tampered_history_and_second_response_roll_back_entire_batch(env):
    _,new,_=env;a=new('support_owner');rows=fixture(a.headers['X-Nabu-Account'])
    response=next(e for e in rows if e['cycle']['observation']=='response')
    next(s for s in response['cycle']['supportSnapshot'] if s['id']=='translation')['openedAt']=None
    assert send(a,rows).status_code==409
    assert a.get('/api/content-progress').json()['events']==[]
    rows=fixture(a.headers['X-Nabu-Account']);assert send(a,rows).status_code==200
    response=copy.deepcopy(next(e for e in rows if e['cycle']['observation']=='response'));response['id']=str(uuid.uuid4());response['at']+=100
    assert send(a,[response]).status_code==409
    conflict=copy.deepcopy(rows[0]);conflict['cycle']['condition']['contextId']='changed'
    assert send(a,[*fixture(a.headers['X-Nabu-Account']),conflict]).status_code==409
    assert len(a.get('/api/content-progress').json()['events'])==len(rows)


def test_backdated_reveals_cannot_rewrite_an_earlier_response_snapshot(env):
    _,new,_=env;a=new('support_owner');rows=fixture(a.headers['X-Nabu-Account']);assert send(a,rows).status_code==200
    available=next(e for e in rows if e['cycle']['observation']=='support-available' and e['cycle']['support']['id']=='gloss')
    reveal=copy.deepcopy(available);reveal['id']=str(uuid.uuid4());reveal['at']+=1;reveal['cycle']['observation']='support-opened';reveal['cycle']['parentEventId']=available['id']
    # This late-arriving opening claims to precede an already saved response.
    # Rechecking the complete sequence catches its incompatible frozen snapshot.
    result=send(a,[reveal]);assert result.status_code==409
