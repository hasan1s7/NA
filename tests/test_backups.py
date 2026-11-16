import sqlite3,os,json
from pathlib import Path
import pytest
from cryptography.fernet import Fernet,InvalidToken
from backup_service import run_backup,restore,validate_database
from tools.verify_offsite_backup import verify_offsite
from server import SCHEMA
from social import SCHEMA as SOCIAL_SCHEMA
from upgrades import SCHEMA as UPGRADE_SCHEMA

def database(tmp_path):
 p=tmp_path/'live.sqlite3'
 with sqlite3.connect(p) as conn:
  conn.executescript(SCHEMA+SOCIAL_SCHEMA+UPGRADE_SCHEMA)
  conn.execute('INSERT INTO users VALUES(?,?,?,?)',('u','alice','hash',1))
  conn.execute('INSERT INTO sessions VALUES(?,?,?,?,?)',('session','u','csrf',1,9999999999));conn.commit()
 return p
class FakeStorage:
 def __init__(self):self.objects={};self.metadata={}
 def upload_file(self,path,bucket,key,ExtraArgs=None):
  self.objects[(bucket,key)]=Path(path).read_bytes();self.metadata[(bucket,key)]=(ExtraArgs or {}).get('Metadata',{})
 def head_object(self,Bucket,Key):return {'ContentLength':len(self.objects[(Bucket,Key)]),'Metadata':self.metadata[(Bucket,Key)]}
 def download_file(self,bucket,key,path):Path(path).write_bytes(self.objects[(bucket,key)])

def test_encrypted_offsite_roundtrip_and_session_invalidation(tmp_path):
 p=database(tmp_path);key=Fernet.generate_key().decode();storage=FakeStorage();folder=tmp_path/'backups'
 report=run_backup(p,folder,'private-test',key,client=storage);assert report['offsite']
 encrypted=next(folder.glob('*.fernet'));assert b'alice' not in encrypted.read_bytes()
 restored=restore(encrypted,tmp_path/'restored.sqlite3',key)
 with sqlite3.connect(restored) as conn:
  assert conn.execute('SELECT handle FROM users').fetchone()[0]=='alice'
  assert conn.execute('SELECT count(*) FROM sessions').fetchone()[0]==0
 assert restored.stat().st_mode&0o777==0o600

def test_backup_plaintext_never_uploaded(tmp_path):
 p=database(tmp_path);storage=FakeStorage()
 with pytest.raises(ValueError,match='no plaintext'):run_backup(p,tmp_path/'backups','bucket','',client=storage)
 assert not storage.objects

def test_backup_local_rotation(tmp_path):
 p=database(tmp_path);folder=tmp_path/'backups'
 for _ in range(4):run_backup(p,folder,keep=2)
 assert len(list(folder.glob('*.sqlite3')))==2
 assert json.loads((folder/'status.json').read_text())['offsite'] is False

def test_restore_never_overwrites_existing_database(tmp_path):
 p=database(tmp_path)
 with pytest.raises(FileExistsError):restore(p,p)
 validate_database(p.resolve())

def test_wrong_key_and_corruption_fail_without_restore_file(tmp_path):
 p=database(tmp_path);key=Fernet.generate_key().decode();folder=tmp_path/'backups';run_backup(p,folder,'b',key,client=FakeStorage())
 encrypted=next(folder.glob('*.fernet'));out=tmp_path/'failed.sqlite3'
 with pytest.raises(InvalidToken):restore(encrypted,out,Fernet.generate_key().decode())
 assert not out.exists()
 bad=tmp_path/'bad';bad.write_bytes(b'not a database')
 with pytest.raises(sqlite3.DatabaseError):restore(bad,out)
 assert not out.exists()

def test_failed_upload_keeps_local_snapshot_and_success_status_unchanged(tmp_path):
 p=database(tmp_path);folder=tmp_path/'backups';first=run_backup(p,folder)
 class Failing(FakeStorage):
  def upload_file(self,*args,**kwargs):raise OSError('network down')
 with pytest.raises(OSError):run_backup(p,folder,'b',Fernet.generate_key().decode(),client=Failing())
 assert len(list(folder.glob('*.sqlite3')))==2
 assert json.loads((folder/'status.json').read_text())==first


def test_full_remote_download_restore_drill(tmp_path):
 p=database(tmp_path);key=Fernet.generate_key().decode();remote=FakeStorage();folder=tmp_path/'backups'
 report=run_backup(p,folder,'private',key,client=remote)
 assert report['remoteKey'].startswith('nabu/') and len(report['cipherSHA256'])==64
 evidence=verify_offsite(folder,'private',key,client=remote)
 assert evidence['ok'] and evidence['users']==1 and evidence['cards']==0
 assert not list(tmp_path.glob('nabu-restore-drill-*'))
 with sqlite3.connect(p) as db:assert db.execute('SELECT count(*) FROM sessions').fetchone()[0]==1

def test_remote_restore_rejects_same_size_corruption_and_wrong_key(tmp_path):
 p=database(tmp_path);key=Fernet.generate_key().decode();remote=FakeStorage();folder=tmp_path/'backups'
 report=run_backup(p,folder,'private',key,client=remote);k=('private',report['remoteKey'])
 with pytest.raises(InvalidToken):verify_offsite(folder,'private',Fernet.generate_key().decode(),client=remote)
 original=remote.objects[k];remote.objects[k]=b'A'+original[1:]
 with pytest.raises(ValueError,match='digest mismatch'):verify_offsite(folder,'private',key,client=remote)
 assert not list(folder.glob('restore-drill.json'))

def test_offsite_drill_cannot_pass_using_local_only_snapshots(tmp_path):
 p=database(tmp_path);folder=tmp_path/'backups';run_backup(p,folder)
 with pytest.raises(ValueError,match='No eligible'):verify_offsite(folder,'private','dummy',client=FakeStorage())
