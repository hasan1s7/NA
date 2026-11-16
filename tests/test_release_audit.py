"""Release-audit regressions. Temporary databases only; no paid providers or real buckets."""
import json
import sys
import time
import pytest
from test_social import env, pair, friend, put, publish, card
from tools import backup_status
from tools import verify_offsite_backup


@pytest.mark.parametrize('path,payload,secret', [
    ('/api/register', {'handle':'alice','password':'private_password_'*10}, 'private_password_'),
    ('/api/login', {'handle':'alice','password':'private_password_'*10}, 'private_password_'),
    ('/api/recover', {'handle':'alice','password':'new password valid 123!','code':'secret-code'}, 'secret-code'),
])
def test_validation_errors_do_not_reflect_secrets(env,path,payload,secret):
    response=env[2].post(path,json=payload)
    assert response.status_code==422
    assert secret not in response.text
    assert isinstance(response.json()['detail'],str)
    assert response.headers['cache-control']=='no-store'


def test_correction_cannot_duplicate_another_shared_entry(env):
    alice,bob=pair(env);friend(alice,bob)
    water=put(alice)
    coffee=put(alice,card(front='coffee',back='cafe',conceptId='drink.coffee'))
    lid=publish(alice,water['id'],cardIds=[water['id'],coffee['id']]).json()['id']
    before=alice.get('/api/library').json()
    assert alice.put(f'/api/shared-libraries/{lid}/members',json={'handle':'bob','role':'contributor'}).status_code==200
    view=bob.get(f'/api/shared-libraries/{lid}/collaboration').json()
    water_entry=next(x for x in view['entries'] if x['front']=='water')
    payload={'revision':1,'entryId':water_entry['entryId'],'entry':{
        'front':'coffee','back':'cafe','sourceLang':'en','targetLang':'es','conceptId':'drink.coffee'}}
    proposed=bob.post(f'/api/shared-libraries/{lid}/proposals',json=payload)
    assert proposed.status_code==201
    pid=proposed.json()['id']
    response=alice.patch(f'/api/shared-libraries/{lid}/proposals/{pid}',json={'status':'accepted','revision':1})
    assert response.status_code==409
    after=bob.get(f'/api/shared-libraries/{lid}/collaboration').json()
    assert after['revision']==1 and len(after['entries'])==2
    assert next(x for x in after['proposals'] if x['id']==pid)['status']=='pending'
    assert alice.get('/api/library').json()==before


def test_failed_restore_attempt_invalidates_previous_success(tmp_path,monkeypatch,capsys):
    now=int(time.time())
    (tmp_path/'status.json').write_text(json.dumps({'lastSuccess':now,'offsite':True}))
    (tmp_path/'restore-drill.json').write_text(json.dumps({'ok':True,'checkedAt':now}))
    def fail(*args,**kwargs):raise ValueError('private_bucket_and_secret_must_not_be_logged')
    monkeypatch.setattr(verify_offsite_backup,'verify_offsite',fail)
    monkeypatch.setattr(sys,'argv',['verify_offsite_backup','--directory',str(tmp_path)])
    assert verify_offsite_backup.main()==1
    captured=capsys.readouterr()
    assert 'private_bucket' not in captured.err
    receipt=json.loads((tmp_path/'restore-drill.json').read_text())
    assert receipt['ok'] is False and receipt['errorType']=='ValueError'
    assert (tmp_path/'restore-drill.json').stat().st_mode&0o777==0o600
    monkeypatch.setattr(sys,'argv',['backup_status','--directory',str(tmp_path),'--require-offsite','--require-restore-drill'])
    assert backup_status.main()==1


@pytest.mark.parametrize('receipt', [[], None, {'lastSuccess':True,'offsite':True},
    {'lastSuccess':float('nan'),'offsite':True}, {'lastSuccess':int(time.time()),'offsite':'false'}])
def test_monitor_fails_closed_for_invalid_backup_receipts(tmp_path,monkeypatch,receipt):
    (tmp_path/'status.json').write_text(json.dumps(receipt))
    monkeypatch.setattr(sys,'argv',['backup_status','--directory',str(tmp_path),'--require-offsite'])
    assert backup_status.main()==1


@pytest.mark.parametrize('limit',['nan','inf','0','-1'])
def test_monitor_rejects_invalid_age_limits(tmp_path,monkeypatch,limit):
    (tmp_path/'status.json').write_text(json.dumps({'lastSuccess':int(time.time()),'offsite':True}))
    monkeypatch.setattr(sys,'argv',['backup_status','--directory',str(tmp_path),'--max-age-hours',limit])
    assert backup_status.main()==1
