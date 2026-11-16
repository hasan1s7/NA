"""Real database / authenticated ASGI integration tests. No provider requests."""
import copy, json, sqlite3, time, uuid
from pathlib import Path
import sys
import pytest
from fastapi.testclient import TestClient
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from server import create_app, SCHEMA
from social import schedule_review
PASSWORD='Test password secure 42!'

def card(**changes):
    at=int(time.time()*1000)
    c={'id':str(uuid.uuid4()),'front':'water','back':'agua','sourceLang':'en','targetLang':'es',
       'context':'A glass of water','note':'PRIVATE NOTE','deck':'Travel','tags':['travel'],
       'attribution':'','conceptId':'food.water','createdAt':at,'updatedAt':at,'revision':0,'archived':False,
       'schedule':{'algorithm':'nabu-srs-v1','state':'new','step':0,'due':at,'interval':0,'ease':2.5,'reps':0,'lapses':0,'lastReview':None}}
    c.update(changes);return c

@pytest.fixture
def env(tmp_path):
    app=create_app(tmp_path/'social.sqlite3','http://testserver',invite='',translation_key='')
    clients=[]
    with TestClient(app,headers={'Origin':'http://testserver'}) as root:
        def user(handle):
            c=TestClient(app,headers={'Origin':'http://testserver'})
            r=c.post('/api/register',json={'handle':handle,'password':PASSWORD});assert r.status_code==201,r.text
            c.headers['X-CSRF-Token']=r.json()['csrf'];c.headers['X-Nabu-Account']=r.json()['user']['id'];clients.append(c);return c
        yield app,user,root
    for c in clients:c.close()

def pair(env):
    app,new,_=env;return new('alice'),new('bob')
def friend(a,b):
    r=a.post('/api/friends',json={'handle':'bob'});assert r.status_code==201,r.text
    fid=r.json()['id'];r=b.patch('/api/friends/'+fid,json={'status':'accepted'});assert r.status_code==200,r.text
    return fid

def put(client,c=None):
    c=c or card();r=client.post('/api/library/translations',json={'card':c,'provider':'Word graph'});assert r.status_code==200,r.text
    return r.json()['card']
def publish(a,cid,**extra):
    payload={'title':'Travel phrases','description':'Shared test','cardIds':[cid],'recipients':['bob']};payload.update(extra)
    return a.post('/api/shared-libraries',json=payload)

@pytest.mark.parametrize('path',['/api/library','/api/friends','/api/shared-libraries'])
def test_anonymous_cannot_read(env,path):
    assert env[2].get(path).status_code==401

def test_cloud_cards_isolated_and_retained_after_new_session(env):
    app,_,_=env;a,b=pair(env);c=put(a)
    assert len(a.get('/api/library').json()['cards'])==1
    assert b.get('/api/library').json()['cards']==[]
    a.post('/api/logout',json={})
    login=a.post('/api/login',json={'handle':'alice','password':PASSWORD});assert login.status_code==200
    a.headers['X-CSRF-Token']=login.json()['csrf']
    assert a.get('/api/library').json()['cards'][0]['id']==c['id']

def test_cloud_cards_survive_server_reconstruction(env):
    app,new,_=env;a=new('alice');c=put(a)
    second=create_app(app.state.db_path,'http://testserver',invite='',translation_key='')
    with TestClient(second,headers={'Origin':'http://testserver'}) as client:
        r=client.post('/api/login',json={'handle':'alice','password':PASSWORD});assert r.status_code==200
        assert client.get('/api/library').json()['cards'][0]['id']==c['id']

def test_wrong_account_header_blocks_cross_tab_writes(env):
    a,b=pair(env);a.headers['X-Nabu-Account']=b.headers['X-Nabu-Account']
    assert a.post('/api/library/translations',json={'card':card()}).status_code==409
    assert a.get('/api/library').status_code==409

def test_duplicate_preserves_content_notes_schedule(env):
    _,new,_=env;a=new('alice');c=put(a)
    r=a.post(f"/api/library/cards/{c['id']}/review",json={'revision':0,'rating':4,'durationMs':400});assert r.status_code==200
    old=r.json()['card'];updated=put(a,card(note='Overwrite attempt'))
    assert updated['id']==c['id'] and updated['note']=='PRIVATE NOTE' and updated['schedule']==old['schedule']
    assert len(a.get('/api/library').json()['history'])==1

def test_manual_share_deduplicates_graph_word(env):
    _,new,_=env;a=new('alice');old=put(a)
    r=a.post('/api/library/cards',json={'cards':[card(conceptId='',note='incoming')]})
    assert r.status_code==200 and r.json()['duplicates']==1 and r.json()['cards'][0]['id']==old['id']

def test_legacy_card_links_to_one_sense_without_collapsing_homographs(env):
    _,new,_=env;a=new('alice');put(a,card(front='fish',back='Fisch',targetLang='de',conceptId=''))
    first=put(a,card(front='fish',back='Fisch',targetLang='de',conceptId='food.fish'))
    second=put(a,card(front='fish',back='Fisch',targetLang='de',conceptId='animals.fish'))
    assert first['conceptId']=='food.fish' and second['id']!=first['id']

def test_edit_conflict_is_rejected(env):
    _,new,_=env;a=new('alice');c=put(a)
    content={k:v for k,v in c.items() if k not in ('id','createdAt','updatedAt','revision','archived','schedule','skills')}
    content['back']='edited'
    path=f"/api/library/cards/{c['id']}"
    assert a.patch(path,json={'content':content,'revision':0}).status_code==200
    assert a.patch(path,json={'content':content,'revision':0}).status_code==409

def test_foreign_card_ids_are_inaccessible(env):
    a,b=pair(env);c=put(a);path=f"/api/library/cards/{c['id']}"
    assert b.post(path+'/review',json={'revision':0,'rating':4}).status_code==404
    assert b.post(path+'/archive',json={'revision':0,'archived':True}).status_code==404

def test_review_and_undo_are_atomic_and_monotonic(env):
    _,new,_=env;a=new('alice');c=put(a)
    r=a.post(f"/api/library/cards/{c['id']}/review",json={'revision':0,'rating':4,'durationMs':400});assert r.status_code==200
    data=r.json();assert data['card']['schedule']['reps']==1
    assert a.post('/api/library/reviews/'+data['log']['id']+'/undo',json={}).status_code==200
    snap=a.get('/api/library').json();assert snap['cards'][0]['schedule']==c['schedule']
    assert snap['cards'][0]['revision']==2 and snap['logs']==[]
    assert a.post('/api/library/reviews/'+data['log']['id']+'/undo',json={}).status_code==404

def test_archived_review_blocked_and_lookup_restores(env):
    _,new,_=env;a=new('alice');c=put(a)
    assert a.post(f"/api/library/cards/{c['id']}/archive",json={'revision':0,'archived':True}).status_code==200
    assert a.post(f"/api/library/cards/{c['id']}/review",json={'revision':1,'rating':4}).status_code==409
    assert put(a)['archived'] is False

def test_import_keeps_schedules_and_does_not_overwrite_duplicates(env):
    _,new,_=env;a=new('alice');c=card();c['schedule'].update(state='review',reps=7,interval=20)
    r=a.post('/api/library/cards',json={'cards':[c]});assert r.status_code==200
    assert r.json()['cards'][0]['schedule']['reps']==7
    c['note']='new';r=a.post('/api/library/cards',json={'cards':[c]});assert r.json()['duplicates']==1
    assert r.json()['cards'][0]['note']=='PRIVATE NOTE'

def test_friend_requires_recipient_acceptance(env):
    a,b=pair(env)
    r=a.post('/api/friends',json={'handle':'BOB'});assert r.status_code==201;fid=r.json()['id']
    assert a.patch('/api/friends/'+fid,json={'status':'accepted'}).status_code==404
    assert len(b.get('/api/friends').json()['incoming'])==1
    assert b.patch('/api/friends/'+fid,json={'status':'accepted'}).status_code==200
    assert a.get('/api/friends').json()['friends'][0]['handle']=='bob'
    assert b.get('/api/friends').json()['friends'][0]['handle']=='alice'

def test_friend_duplicate_and_reciprocal_request_do_not_auto_accept(env):
    a,b=pair(env);one=a.post('/api/friends',json={'handle':'bob'}).json()
    two=b.post('/api/friends',json={'handle':'alice'}).json()
    assert one['id']==two['id'] and two['duplicate'] and two['status']=='pending'

def test_friend_self_unknown_and_unauthorized_decision(env):
    a,b=pair(env);c=env[1]('charlie')
    assert a.post('/api/friends',json={'handle':'alice'}).status_code==400
    assert a.post('/api/friends',json={'handle':'nobody'}).status_code==404
    fid=a.post('/api/friends',json={'handle':'bob'}).json()['id']
    assert c.patch('/api/friends/'+fid,json={'status':'accepted'}).status_code==404
    assert c.request('DELETE','/api/friends/'+fid,json={}).status_code==404

def test_share_requires_accepted_friend(env):
    a,b=pair(env);c=put(a)
    assert publish(a,c['id']).status_code==403
    a.post('/api/friends',json={'handle':'bob'})
    assert publish(a,c['id']).status_code==403
    incoming=b.get('/api/friends').json()['incoming'][0]
    b.patch('/api/friends/'+incoming['id'],json={'status':'accepted'})
    assert publish(a,c['id']).status_code==201

def test_shared_snapshot_excludes_private_data(env):
    a,b=pair(env);friend(a,b);c=put(a);lid=publish(a,c['id']).json()['id']
    r=b.get('/api/shared-libraries/'+lid);assert r.status_code==200
    shared=r.json()['cards'][0]
    assert set(shared)=={'front','back','sourceLang','targetLang','context','conceptId','literal','usage','example','reply','provenance','reviewStatus'}
    assert not {'note','skills','learningMode','schedule'}.intersection(shared)
    assert 'PRIVATE NOTE' not in r.text and 'schedule' not in r.text
    assert len(b.get('/api/shared-libraries').json()['libraries'])==1

def test_uninvited_user_cannot_read_share_even_with_id(env):
    a,b=pair(env);friend(a,b);c=put(a);lid=publish(a,c['id']).json()['id'];other=env[1]('charlie')
    assert other.get('/api/shared-libraries/'+lid).status_code==404
    assert other.get('/api/shared-libraries').json()['libraries']==[]

def test_share_cannot_include_another_users_cards(env):
    a,b=pair(env);friend(a,b);c=put(b)
    assert publish(a,c['id']).status_code==404

def test_nonowner_cannot_publish_update_or_revoke_someone_else(env):
    a,b=pair(env);friend(a,b);c=put(a);lid=publish(a,c['id']).json()['id']
    assert b.patch('/api/shared-libraries/'+lid,json={'cardIds':[c['id']],'revision':1}).status_code==403
    assert b.request('DELETE','/api/shared-libraries/'+lid+'/members/alice',json={}).status_code==403

def test_snapshot_update_requires_revision_and_does_not_change_saved_copies(env):
    a,b=pair(env);friend(a,b);c=put(a);lid=publish(a,c['id']).json()['id']
    shared=b.get('/api/shared-libraries/'+lid).json()['cards'][0]
    copied=card(**shared,note='',deck='Shared',attribution='@alice')
    b.post('/api/library/cards',json={'cards':[copied]})
    second=put(a,card(front='hello',back='hola',conceptId='essentials.hello'))
    assert a.patch('/api/shared-libraries/'+lid,json={'cardIds':[second['id']],'revision':1}).status_code==200
    assert a.patch('/api/shared-libraries/'+lid,json={'cardIds':[c['id']],'revision':1}).status_code==409
    assert b.get('/api/library').json()['cards'][0]['front']=='water'
    assert b.get('/api/shared-libraries/'+lid).json()['cards'][0]['front']=='hello'

def test_revocation_preserves_recipient_saved_copy(env):
    a,b=pair(env);friend(a,b);c=put(a);lid=publish(a,c['id']).json()['id']
    shared=b.get('/api/shared-libraries/'+lid).json()['cards'][0]
    b.post('/api/library/cards',json={'cards':[card(**shared,note='')]})
    assert a.request('DELETE','/api/shared-libraries/'+lid,json={}).status_code==200
    assert b.get('/api/shared-libraries/'+lid).status_code==404
    assert len(b.get('/api/library').json()['cards'])==1

def test_member_revoke_and_leave(env):
    a,b=pair(env);friend(a,b);c=put(a);lid=publish(a,c['id']).json()['id']
    assert a.request('DELETE','/api/shared-libraries/'+lid+'/members/bob',json={}).status_code==200
    assert b.get('/api/shared-libraries/'+lid).status_code==404
    lid=publish(a,c['id']).json()['id']
    assert b.request('DELETE','/api/shared-libraries/'+lid,json={}).status_code==200
    assert a.get('/api/shared-libraries/'+lid).status_code==200
    assert b.get('/api/shared-libraries/'+lid).status_code==404

def test_unfriend_revokes_and_readding_does_not_restore_access(env):
    a,b=pair(env);fid=friend(a,b);c=put(a);lid=publish(a,c['id']).json()['id']
    assert a.request('DELETE','/api/friends/'+fid,json={}).status_code==200
    assert b.get('/api/shared-libraries/'+lid).status_code==404
    friend(a,b);assert b.get('/api/shared-libraries/'+lid).status_code==404

def test_block_deletes_friendship_and_grants(env):
    a,b=pair(env);friend(a,b);c=put(a);lid=publish(a,c['id']).json()['id']
    assert b.post('/api/blocks',json={'handle':'alice'}).status_code==200
    assert a.get('/api/friends').json()['friends']==[]
    assert b.get('/api/shared-libraries/'+lid).status_code==404
    assert a.post('/api/friends',json={'handle':'bob'}).status_code==404
    assert b.request('DELETE','/api/blocks/alice',json={}).status_code==200
    friend(a,b);assert b.get('/api/shared-libraries/'+lid).status_code==404

def test_account_deletion_cascades_server_data_but_not_other_users_library(env):
    app,_,_=env;a,b=pair(env);friend(a,b);c=put(a);put(b);publish(a,c['id'])
    assert a.request('DELETE','/api/account',json={'password':PASSWORD}).status_code==200
    assert len(b.get('/api/library').json()['cards'])==1
    assert b.get('/api/friends').json()['friends']==[]
    assert b.get('/api/shared-libraries').json()['libraries']==[]
    with sqlite3.connect(app.state.db_path) as db:
        assert db.execute('PRAGMA foreign_key_check').fetchall()==[]
        assert db.execute('SELECT count(*) FROM cloud_cards').fetchone()[0]==1

def test_csrf_and_origin_protect_social_mutations(env):
    _,new,_=env;a=new('alice');old=a.headers.pop('X-CSRF-Token')
    assert a.post('/api/library/translations',json={'card':card()}).status_code==403
    a.headers['X-CSRF-Token']=old;a.headers['Origin']='https://attacker.invalid'
    assert a.post('/api/friends',json={'handle':'bob'}).status_code==403

def test_validation_and_batch_limits(env):
    _,new,_=env;a=new('alice')
    assert a.post('/api/library/cards',json={'cards':[card(sourceLang='fake')]}).status_code==422
    assert a.post('/api/library/cards',json={'cards':[card() for _ in range(51)]}).status_code==422
    assert a.post('/api/library/cards',json={'cards':[card(front=' ')]}).status_code==422
    assert a.post('/api/library/cards',json={'cards':[card(note='x'*1001)]}).status_code==422
    assert a.post('/api/friends',json={'handle':'<script>'}).status_code==422

def test_clear_history_keeps_cards_and_clear_library_keeps_account(env):
    _,new,_=env;a=new('alice');put(a)
    assert a.request('DELETE','/api/library/history',json={}).status_code==200
    assert len(a.get('/api/library').json()['cards'])==1 and a.get('/api/library').json()['history']==[]
    assert a.request('DELETE','/api/library',json={}).status_code==200
    assert a.get('/api/library').json()['cards']==[] and a.get('/api/session').json()['user']['handle']=='alice'

def test_version_one_migration_preserves_accounts(tmp_path):
    path=tmp_path/'old.sqlite3'
    with sqlite3.connect(path) as conn:
        conn.executescript(SCHEMA)
        conn.execute('INSERT INTO users VALUES(?,?,?,?)',('old-id','old_user','not-a-password',1));conn.commit()
    app=create_app(path,'http://testserver',invite='',translation_key='')
    with TestClient(app):
        with sqlite3.connect(path) as conn:
            assert conn.execute('PRAGMA user_version').fetchone()[0]==4
            assert conn.execute('SELECT handle FROM users').fetchone()[0]=='old_user'
            assert conn.execute('SELECT count(*) FROM cloud_cards').fetchone()[0]==0

@pytest.mark.parametrize('state',['new','learning','review','relearning'])
@pytest.mark.parametrize('rating',[1,2,3,4])
def test_server_schedule_is_bounded_and_does_not_mutate_input(state,rating):
    s=card()['schedule'];s.update(state=state,interval=10,reps=4);before=copy.deepcopy(s)
    out=schedule_review(s,rating,1234567890000)
    assert s==before and out['reps']==5 and out['due']>out['lastReview']
    assert 1.3<=out['ease']<=3.5

def test_sqlite_backup_includes_wal_data(env,tmp_path):
    from tools.backup_database import backup
    app,new,_=env;client=new('alice');put(client)
    target=backup(app.state.db_path,tmp_path/'backup.sqlite3')
    with sqlite3.connect(target) as db:
        assert db.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
        assert db.execute('SELECT count(*) FROM cloud_cards').fetchone()[0]==1
    with pytest.raises(FileExistsError):backup(app.state.db_path,target)
