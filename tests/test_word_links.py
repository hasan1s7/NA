"""Real SQLite / HTTP tests, no hosted service or personal database."""
import json
import sqlite3
import time
import uuid
from pathlib import Path
from fastapi.testclient import TestClient
import pytest
from test_server import env,register,two_users,WORD,PASSWORD
from server import create_app,SCHEMA
from social import SCHEMA as SOCIAL_SCHEMA
from upgrades import SCHEMA as UPGRADE_SCHEMA
from backup_service import run_backup,restore,validate_database
from word_links import SLUG


def create(client,**changes):
    data={'card':WORD,'expiresDays':30,'requestId':str(uuid.uuid4())};data.update(changes)
    return client.post('/api/word-links',json=data)


def test_short_link_requires_authentication(env):
    assert create(env[1]).status_code==401
    assert env[1].get('/api/word-links').status_code==401


def test_short_link_roundtrip_has_no_personal_progress(env):
    app,client=env;register(client);result=create(client)
    assert result.status_code==201,result.text
    data=result.json();assert SLUG.fullmatch(data['slug']);assert len(data['url'])<110
    assert data['url'].startswith('http://testserver/w/bonjour-fr-en-')
    anonymous=TestClient(app);response=anonymous.get('/api/word-links/'+data['slug'])
    assert response.status_code==200
    assert response.json()=={'card':WORD,'sender':'alice','verified':True,'expiresAt':data['expiresAt']}
    assert 'no-store' in response.headers['cache-control']
    assert 'no-referrer'==response.headers['referrer-policy']


def test_link_survives_restart_in_same_persistent_database(env):
    app,client=env;register(client);slug=create(client).json()['slug']
    second=create_app(app.state.db_path,'http://testserver',invite='')
    with TestClient(second) as restarted:assert restarted.get('/api/word-links/'+slug).status_code==200


def test_revoke_is_owner_only_and_idempotent(env):
    app,alice,bob=two_users(env);slug=create(alice).json()['slug']
    assert bob.request('DELETE','/api/word-links/'+slug,json={}).status_code==404
    assert bob.get('/api/word-links').json()['links']==[]
    assert alice.request('DELETE','/api/word-links/'+slug,json={}).status_code==200
    assert alice.request('DELETE','/api/word-links/'+slug,json={}).status_code==200
    assert bob.get('/api/word-links/'+slug).status_code==404
    assert alice.get('/api/word-links').json()['links']==[]


def test_expiry_revocation_and_missing_are_indistinguishable(env):
    app,client=env;register(client);slug=create(client).json()['slug']
    missing=client.get('/api/word-links/absent').json()
    with sqlite3.connect(app.state.db_path) as db:db.execute('UPDATE word_links SET expires_at=?',(int(time.time())-1,));db.commit()
    expired=client.get('/api/word-links/'+slug);assert expired.status_code==404 and expired.json()==missing


def test_retries_do_not_create_another_link_and_cannot_change_content(env):
    _,client=env;register(client);key=str(uuid.uuid4())
    first=create(client,requestId=key);retry=create(client,requestId=key)
    assert first.json()['slug']==retry.json()['slug'] and retry.json()['duplicate']
    assert create(client,requestId=key,expiresDays=7).status_code==409
    assert len(client.get('/api/word-links').json()['links'])==1


def test_retry_cannot_resurrect_a_disabled_link(env):
    _,client=env;register(client);key=str(uuid.uuid4());slug=create(client,requestId=key).json()['slug']
    client.request('DELETE','/api/word-links/'+slug,json={})
    assert create(client,requestId=key).status_code==410


@pytest.mark.parametrize('field',['note','schedule','skills','owner_id','sender','logs'])
def test_private_fields_rejected_without_echoing(env,field):
    _,client=env;register(client);response=create(client,card={**WORD,field:'PRIVATE_SECRET'})
    assert response.status_code==422 and 'PRIVATE_SECRET' not in response.text


@pytest.mark.parametrize('days',[0,91,True,2.5,'30'])
def test_invalid_expiry_is_not_coerced(env,days):
    _,client=env;register(client);assert create(client,expiresDays=days).status_code==422


def test_csrf_and_account_binding_are_enforced(env):
    _,client=env;register(client);client.headers['X-CSRF-Token']='wrong';assert create(client).status_code==403
    client.headers['X-Nabu-Account']='someone-else';assert create(client).status_code==409


def test_delete_account_removes_public_links(env):
    app,client=env;register(client);slug=create(client).json()['slug']
    assert client.request('DELETE','/api/account',json={'password':PASSWORD}).status_code==200
    assert TestClient(app).get('/api/word-links/'+slug).status_code==404


@pytest.mark.parametrize('path',['/review','/friends','/library','/read','/words','/settings','/translate','/w/bonjour-fr-en-AbCdEf0123456789'])
def test_deep_routes_serve_safe_shell_not_json_or_old_relative_assets(env,path):
    response=env[1].get(path);assert response.status_code==200
    assert '<base href="/">' in response.text
    assert 'nabu-native-bridge' not in response.text
    assert 'no-store' in response.headers['cache-control'] or 'no-cache' in response.headers['cache-control']
    assert response.headers['x-robots-tag']=='noindex, nofollow'


def test_no_open_redirect_or_catchall_file_exposure(env):
    client=env[1]
    for path in ['/w/abc','/server.py','/word_links.py','/.env','/anything-unknown']:
        assert client.get(path).status_code==404


def test_associations_empty_until_verified_ids_are_configured(env,monkeypatch):
    for key in ['NABU_APPLE_TEAM_ID','NABU_ANDROID_SHA256']:monkeypatch.delenv(key,raising=False)
    assert env[1].get('/.well-known/apple-app-site-association').json()['applinks']['details']==[]
    assert env[1].get('/.well-known/assetlinks.json').json()==[]


def test_associations_use_explicit_team_package_and_cert(env,monkeypatch):
    monkeypatch.setenv('NABU_APPLE_TEAM_ID','A1B2C3D4E5');monkeypatch.setenv('NABU_MOBILE_APP_ID','com.example.nabu');monkeypatch.setenv('NABU_ANDROID_SHA256',':'.join(['AB']*32))
    apple=env[1].get('/.well-known/apple-app-site-association').json();assert apple['applinks']['details'][0]['appID']=='A1B2C3D4E5.com.example.nabu'
    android=env[1].get('/.well-known/assetlinks.json').json();assert android[0]['target']['package_name']=='com.example.nabu'


def test_legacy_v3_database_migrates_without_losing_library(tmp_path):
    db=tmp_path/'old.sqlite3'
    with sqlite3.connect(db) as conn:
        conn.executescript(SCHEMA+SOCIAL_SCHEMA+UPGRADE_SCHEMA)
        conn.execute('INSERT INTO users VALUES(?,?,?,?)',('existing-user','retained','hash',1));conn.commit()
    app=create_app(db,'http://testserver',invite='')
    with TestClient(app) as client:
        assert client.get('/api/health').status_code==200
        with sqlite3.connect(db) as conn:
            assert conn.execute('PRAGMA user_version').fetchone()[0]==4
            assert conn.execute('SELECT handle FROM users').fetchone()[0]=='retained'
            assert conn.execute('SELECT count(*) FROM word_links').fetchone()[0]==0


def test_v4_backup_restores_shares_and_revokes_sessions_without_overwrite(env,tmp_path):
    app,client=env;register(client);slug=create(client).json()['slug']
    validate_database(app.state.db_path)
    result=run_backup(app.state.db_path,tmp_path/'backups')
    copied=restore(tmp_path/'backups'/result['file'],tmp_path/'restored.sqlite3')
    with sqlite3.connect(copied) as conn:
        assert conn.execute('SELECT slug FROM word_links').fetchone()[0]==slug
        assert conn.execute('SELECT count(*) FROM sessions').fetchone()[0]==0
        assert conn.execute('SELECT revoked_at FROM word_links').fetchone()[0] is not None
    with pytest.raises(FileExistsError):restore(copied,app.state.db_path)


def test_config_exposes_capabilities_not_secrets(env):
    result=env[1].get('/api/config').json();assert result['shortLinks'] and result['cleanRoutes']
    assert 'NABU_' not in json.dumps(result)
