"""Actual FastAPI + SQLite tests for additive, owner-bound content events."""
import time,uuid,json,sqlite3
from pathlib import Path
import pytest
from test_social import env,put,card,PASSWORD
from server import create_app
from fastapi.testclient import TestClient

def event(kind='opened',**kw):
    return dict(id=str(uuid.uuid4()),contentId='a-little-later',version=1,kind=kind,at=int(time.time()*1000),**kw)
def send(c,events):return c.post('/api/content-progress',json={'events':events})

def test_anonymous_and_missing_csrf_rejected(env):
    _,new,anon=env
    assert anon.get('/api/content-progress').status_code==401
    a=new('progress_owner');del a.headers['X-CSRF-Token']
    assert send(a,[event()]).status_code==403

def test_events_private_idempotent_and_survive_server_restart(env):
    app,new,_=env;a=new('progress_owner');b=new('other_owner')
    e=event('position',segmentId='s5',fraction=.37)
    assert send(a,[e]).status_code==200
    assert send(a,[e]).status_code==200
    assert len(a.get('/api/content-progress').json()['events'])==1
    assert b.get('/api/content-progress').json()['events']==[]
    second=create_app(app.state.db_path,'http://testserver',invite='',translation_key='')
    with TestClient(second,headers={'Origin':'http://testserver'}) as c:
        assert c.post('/api/login',json={'handle':'progress_owner','password':PASSWORD}).status_code==200
        assert c.get('/api/content-progress').json()['events']==[e]

def test_id_collision_is_conflict_and_batch_atomic(env):
    _,new,_=env;a=new('progress_owner');e=event();assert send(a,[e]).status_code==200
    assert send(a,[event(),{**e,'kind':'finished','value':True}]).status_code==409
    assert len(a.get('/api/content-progress').json()['events'])==1

@pytest.mark.parametrize('edit',[{'version':2},{'contentId':'unknown'},{'kind':'mastered'},{'at':-1},{'unexpected':'private data'},{'id':'x'}])
def test_invalid_event_contract_rejected(env,edit):
    _,new,_=env;a=new('progress_owner');assert send(a,[{**event(),**edit}]).status_code==422

def test_invalid_position_and_practice_rejected(env):
    _,new,_=env;a=new('progress_owner')
    assert send(a,[event('position',segmentId='missing',fraction=0)]).status_code==422
    assert send(a,[event('position',segmentId='s1',fraction=2)]).status_code==422
    assert send(a,[event('attempt',activityId='p1',sessionId=str(uuid.uuid4()),choice=99,assisted=False)]).status_code==422
    assert send(a,[event('attempt',activityId='p2',sessionId=str(uuid.uuid4()),answer='',assisted=False)]).status_code==422

def test_practice_preserves_existing_card_schedule_and_no_hidden_cards(env):
    _,new,_=env;a=new('progress_owner');saved=put(a,card(note='Do not change'))
    rows=[event('help',activityId='p2',sessionId=str(uuid.uuid4()),help='hint'),
          event('attempt',activityId='p2',sessionId=str(uuid.uuid4()),answer='a response',assisted=True,skipped=False),
          event('attempt',activityId='p1',sessionId=str(uuid.uuid4()),assisted=False,skipped=True,answer='')]
    assert send(a,rows).status_code==200
    after=a.get('/api/library').json()['cards'];assert len(after)==1
    assert after[0]['schedule']==saved['schedule'] and after[0]['note']=='Do not change'

def test_cross_tab_account_header_blocks_and_account_deletion_cascades(env):
    app,new,_=env;a=new('progress_owner');b=new('other_owner');uid=a.headers['X-Nabu-Account']
    assert send(a,[event()]).status_code==200
    a.headers['X-Nabu-Account']=b.headers['X-Nabu-Account'];assert send(a,[event()]).status_code==409
    a.headers['X-Nabu-Account']=uid;assert a.request('DELETE','/api/account',json={'password':PASSWORD}).status_code==200
    with sqlite3.connect(app.state.db_path) as c:assert c.execute('SELECT COUNT(*) FROM content_events WHERE user_id=?',(uid,)).fetchone()[0]==0

def test_upgrade_retains_existing_tables_user_version_and_words(env):
    app,new,_=env;a=new('progress_owner');old=put(a)
    with sqlite3.connect(app.state.db_path) as c:
        version=c.execute('PRAGMA user_version').fetchone()[0];c.execute('DROP TABLE content_events')
    with TestClient(create_app(app.state.db_path,'http://testserver',invite='',translation_key=''),headers={'Origin':'http://testserver'}) as c:
        c.post('/api/login',json={'handle':'progress_owner','password':PASSWORD})
        assert c.get('/api/content-progress').json()['events']==[]
        assert c.get('/api/library').json()['cards'][0]['id']==old['id']
    with sqlite3.connect(app.state.db_path) as c:assert c.execute('PRAGMA user_version').fetchone()[0]==version

def test_explore_route_is_real_application_and_no_paid_setup(env):
    _,_,c=env;r=c.get('/explore');assert r.status_code==200
    assert 'Stay with what moves you' in r.text
    assert c.get('/api/config').json()['contentProgress'] is True
