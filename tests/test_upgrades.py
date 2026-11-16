"""New endpoints exercised against real temporary SQLite databases."""
import copy,json,hashlib,sqlite3,time,uuid
import pytest
from fastapi.testclient import TestClient
from test_social import env,pair,friend,put,publish,card,PASSWORD
from social import Content
from server import create_app

def operation(kind,payload,at=None):return {'id':str(uuid.uuid4()),'kind':kind,'payload':payload,'at':at or int(time.time()*1000)}
def send(c,op):return c.post('/api/sync',json=op)

def test_registration_recovery_only_hash_stored(env):
    app,_,root=env
    r=root.post('/api/register',json={'handle':'recoverable','password':PASSWORD});assert r.status_code==201
    code=r.json()['recoveryCode'];assert len(code)>40
    with sqlite3.connect(app.state.db_path) as conn:
        digest=conn.execute('SELECT digest FROM recovery_codes').fetchone()[0]
        assert code!=digest and digest==hashlib.sha256(code.encode()).hexdigest()
    assert 'recoveryCode' not in root.get('/api/session').text

def test_recovery_resets_password_revokes_sessions_rotates_code(env):
    app,_,root=env
    r=root.post('/api/register',json={'handle':'alice','password':PASSWORD}).json();code=r['recoveryCode']
    root.headers['X-CSRF-Token']=r['csrf'];root.headers['X-Nabu-Account']=r['user']['id']
    second=TestClient(app,headers={'Origin':'http://testserver'});second.post('/api/login',json={'handle':'alice','password':PASSWORD})
    assert second.get('/api/session').json()['user']
    reset=second.post('/api/recover',json={'handle':'alice','code':code,'password':'Brand new password 123!'});assert reset.status_code==200
    assert root.get('/api/session').json()['user'] is None
    assert second.post('/api/recover',json={'handle':'alice','code':code,'password':PASSWORD}).status_code==400
    assert second.post('/api/login',json={'handle':'alice','password':PASSWORD}).status_code==401
    assert second.post('/api/login',json={'handle':'alice','password':'Brand new password 123!'}).status_code==200
    assert reset.json()['recoveryCode']!=code

@pytest.mark.parametrize('handle',['unknown','alice'])
def test_recovery_errors_do_not_enumerate_handles(env,handle):
    _,new,root=env;new('alice')
    r=root.post('/api/recover',json={'handle':handle,'code':'badcode'*8,'password':PASSWORD})
    assert r.status_code==400 and r.json()['detail']=='The handle or recovery code is incorrect, expired or already used.'

def test_rotate_recovery_requires_current_password_and_csrf(env):
    _,new,_=env;c=new('alice')
    assert c.post('/api/account/recovery',json={'password':'incorrect'}).status_code==403
    assert c.post('/api/account/recovery',json={'password':PASSWORD}).status_code==200
    c.headers['X-CSRF-Token']='wrong'
    assert c.post('/api/account/recovery',json={'password':PASSWORD}).status_code==403

def test_sync_add_retry_is_exactly_once(env):
    _,new,_=env;c=new('alice');op=operation('add',{'cards':[card()]})
    a=send(c,op);b=send(c,op);assert a.status_code==b.status_code==200
    assert a.json()['result']==b.json()['result'];assert b.json()['replayed']
    assert len(c.get('/api/library').json()['cards'])==1

def test_sync_changed_payload_same_id_rejected(env):
    _,new,_=env;c=new('alice');op=operation('add',{'cards':[card()]});assert send(c,op).status_code==200
    op['payload']['cards'][0]['back']='changed';assert send(c,op).status_code==409

def test_sync_translation_duplicate_maps_id_preserves_notes_schedule(env):
    _,new,_=env;c=new('alice');first=put(c);newcard=card(note='should not overwrite',learningMode='reference')
    r=send(c,operation('translation',{'card':newcard,'provider':'Word graph'}));assert r.status_code==200
    result=r.json()['result'];assert not result['added'];assert result['idMap'][newcard['id']]==first['id']
    assert result['card']['note']=='PRIVATE NOTE';assert len(r.json()['snapshot']['history'])==1

@pytest.mark.parametrize('mode',['recognition','production','listening','cloze'])
def test_sync_skills_independent_and_retry_no_double_grade(env,mode):
    _,new,_=env;c=new('alice');original=put(c)
    op=operation('review',{'cardId':original['id'],'rating':4,'revision':0,'durationMs':1250,'practiceMode':mode})
    a=send(c,op);b=send(c,op);assert a.status_code==b.status_code==200,a.text
    updated=a.json()['result']['card'];assert updated['skills'][mode]['reps']==1
    assert updated['schedule']['reps']==(1 if mode=='recognition' else 0)
    assert len(b.json()['snapshot']['logs'])==1
    log=b.json()['snapshot']['logs'][0];assert log['practiceMode']==mode and log['durationMs']==1250

def test_sync_conflict_does_not_overwrite_server(env):
    _,new,_=env;c=new('alice');original=put(c)
    body=Content.model_validate({k:v for k,v in original.items() if k in Content.model_fields}).model_dump();body['back']='server changed'
    r=c.patch('/api/library/cards/'+original['id'],json={'content':body,'revision':0});assert r.status_code==200
    stale=operation('review',{'cardId':original['id'],'rating':4,'revision':0})
    assert send(c,stale).status_code==409
    view=c.get('/api/library').json();assert view['cards'][0]['back']=='server changed' and view['logs']==[]

def test_sync_account_isolation_and_account_guard(env):
    a,b=pair(env);original=put(a)
    assert send(b,operation('review',{'cardId':original['id'],'rating':4,'revision':0})).status_code==404
    b.headers['X-Nabu-Account']=a.headers['X-Nabu-Account']
    assert send(b,operation('add',{'cards':[card()]})).status_code==409

def test_sync_reference_not_reviewable_until_promoted(env):
    _,new,_=env;c=new('alice');original=put(c,card(learningMode='reference'))
    assert send(c,operation('review',{'cardId':original['id'],'rating':4,'revision':0})).status_code==409
    content={k:v for k,v in original.items() if k in Content.model_fields};content['learningMode']='learning'
    assert send(c,operation('edit',{'cardId':original['id'],'revision':0,'content':content})).status_code==200
    assert send(c,operation('review',{'cardId':original['id'],'rating':4,'revision':1})).status_code==200

def test_sync_undo_preserves_other_skill_history(env):
    _,new,_=env;c=new('alice');original=put(c)
    first=send(c,operation('review',{'cardId':original['id'],'rating':4,'revision':0,'practiceMode':'production'})).json()['result']
    r=send(c,operation('undo',{'logId':first['log']['id']}));assert r.status_code==200
    assert r.json()['snapshot']['logs']==[];assert r.json()['snapshot']['cards'][0]['revision']==2
    assert r.json()['snapshot']['cards'][0]['skills']=={}

def test_sync_future_clock_rejected(env):
    _,new,_=env;c=new('alice');assert send(c,operation('add',{'cards':[card()]},int(time.time()*1000)+600000)).status_code==422

@pytest.mark.parametrize('payload',[{}, {'cards':[]},{'cards':[card(front='')]},{'cards':[card(sourceLang='xx')]}])
def test_sync_invalid_operations_are_atomic(env,payload):
    _,new,_=env;c=new('alice');assert send(c,operation('add',payload)).status_code==422
    assert c.get('/api/library').json()['cards']==[]

def collab_setup(env):
    a,b=pair(env);fid=friend(a,b);original=put(a);lid=publish(a,original['id']).json()['id'];return a,b,lid,original,fid

def proposal(c,lid,revision=1,entryId=None,back='Thank you'):
    return c.post(f'/api/shared-libraries/{lid}/proposals',json={'revision':revision,'entryId':entryId,'entry':{'front':'gracias','back':back,'sourceLang':'es','targetLang':'en','usage':'Use to thank someone.'}})

def test_viewer_cannot_publish_or_change_roles(env):
    a,b,lid,_,_=collab_setup(env)
    assert b.get(f'/api/shared-libraries/{lid}/collaboration').json()['role']=='viewer'
    assert proposal(b,lid).status_code==403
    assert b.put(f'/api/shared-libraries/{lid}/members',json={'handle':'bob','role':'contributor'}).status_code==403

def test_contributor_proposes_owner_approves_and_history_visible(env):
    a,b,lid,_,_=collab_setup(env)
    assert a.put(f'/api/shared-libraries/{lid}/members',json={'handle':'bob','role':'contributor'}).status_code==200
    r=proposal(b,lid);assert r.status_code==201,r.text;pid=r.json()['id']
    assert len(a.get('/api/shared-libraries/'+lid).json()['cards'])==1
    assert b.patch(f'/api/shared-libraries/{lid}/proposals/{pid}',json={'status':'accepted','revision':1}).status_code==403
    accepted=a.patch(f'/api/shared-libraries/{lid}/proposals/{pid}',json={'status':'accepted','revision':1});assert accepted.status_code==200,accepted.text
    view=b.get(f'/api/shared-libraries/{lid}/collaboration').json();assert len(view['entries'])==2 and view['revision']==2
    assert view['proposals'][0]['status']=='accepted';assert view['events'][0]['changes']['after']['back']=='Thank you'
    assert 'PRIVATE NOTE' not in json.dumps(view)

def test_correction_preserves_private_owner_card(env):
    a,b,lid,original,_=collab_setup(env)
    a.put(f'/api/shared-libraries/{lid}/members',json={'handle':'bob','role':'contributor'})
    entry=b.get(f'/api/shared-libraries/{lid}/collaboration').json()['entries'][0]
    r=proposal(b,lid,entryId=entry['entryId']);pid=r.json()['id']
    assert a.patch(f'/api/shared-libraries/{lid}/proposals/{pid}',json={'status':'accepted','revision':1}).status_code==200
    assert a.get('/api/library').json()['cards'][0]['back']==original['back']
    events=a.get(f'/api/shared-libraries/{lid}/collaboration').json()['events'];assert events[0]['changes']['before']['back']=='agua'

def test_stale_proposal_requires_resubmission(env):
    a,b,lid,_,_=collab_setup(env);a.put(f'/api/shared-libraries/{lid}/members',json={'handle':'bob','role':'contributor'})
    first=proposal(b,lid).json()['id'];second=proposal(b,lid,back='Thanks').json()['id']
    assert a.patch(f'/api/shared-libraries/{lid}/proposals/{first}',json={'status':'accepted','revision':1}).status_code==200
    assert a.patch(f'/api/shared-libraries/{lid}/proposals/{second}',json={'status':'accepted','revision':2}).status_code==409
    assert a.patch(f'/api/shared-libraries/{lid}/proposals/{second}',json={'status':'declined','revision':2}).status_code==200

def test_unfriend_revokes_collaboration_and_proposal_acceptance(env):
    a,b,lid,_,fid=collab_setup(env);a.put(f'/api/shared-libraries/{lid}/members',json={'handle':'bob','role':'contributor'})
    pid=proposal(b,lid).json()['id'];a.delete('/api/friends/'+fid,json={}) if False else a.request('DELETE','/api/friends/'+fid,json={})
    assert b.get(f'/api/shared-libraries/{lid}/collaboration').status_code==404
    assert a.patch(f'/api/shared-libraries/{lid}/proposals/{pid}',json={'status':'accepted','revision':1}).status_code==403

def test_proposal_rejects_private_fields(env):
    a,b,lid,_,_=collab_setup(env);a.put(f'/api/shared-libraries/{lid}/members',json={'handle':'bob','role':'contributor'})
    body={'revision':1,'entry':{'front':'x','back':'y','sourceLang':'en','targetLang':'es','note':'private'}}
    assert b.post(f'/api/shared-libraries/{lid}/proposals',json=body).status_code==422

def test_replayed_operation_survives_server_restart(env):
    app,new,_=env;a=new('alice');op=operation('add',{'cards':[card()]});assert send(a,op).status_code==200
    other=create_app(app.state.db_path,'http://testserver',invite='',translation_key='')
    with TestClient(other,headers={'Origin':'http://testserver'}) as c:
        auth=c.post('/api/login',json={'handle':'alice','password':PASSWORD}).json();c.headers['X-CSRF-Token']=auth['csrf'];c.headers['X-Nabu-Account']=auth['user']['id']
        response=send(c,op);assert response.status_code==200 and response.json()['replayed'];assert len(response.json()['snapshot']['cards'])==1

def test_invalid_collaboration_languages_are_validation_error_not_server_crash(env):
    a,b=pair(env);friend(a,b);c=put(a);lid=publish(a,c['id']).json()['id']
    r=a.post(f'/api/shared-libraries/{lid}/proposals',json={'revision':1,'entry':{'front':'x','back':'y','sourceLang':'invented','targetLang':'en'}})
    assert r.status_code==422

def test_clear_library_scrubs_receipt_content_but_does_not_replay_deleted_words(env):
    app,new,_=env;c=new('alice');value=card();value['note']='a private note that should go away';op=operation('add',{'cards':[value]})
    assert send(c,op).status_code==200;assert c.request('DELETE','/api/library',json={}).status_code==200
    with sqlite3.connect(app.state.db_path) as conn:
        receipt=conn.execute('SELECT result FROM sync_receipts').fetchone()[0]
        assert 'private note' not in receipt
    retry=send(c,op);assert retry.status_code==200 and retry.json()['replayed']
    assert retry.json()['snapshot']['cards']==[]
