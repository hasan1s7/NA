"""Operator tooling tests. FSRS library execution is optional, not mocked as proof."""
import json,subprocess,sys,time
from pathlib import Path
import pytest
from tools.evaluate_fsrs import load_reviews
ROOT=Path(__file__).resolve().parents[1]
def test_dockerfile_copies_new_server_dependencies():
 text=(ROOT/'Dockerfile').read_text()
 for name in ('upgrades.py','backup_service.py','tools/backup_database.py','tools/restore_database.py','tools/backup_status.py','tools/verify_offsite_backup.py'):
  assert name in text and (ROOT/name).exists()

def test_backup_monitor_requires_recent_offsite_confirmation(tmp_path):
 status=tmp_path/'status.json';cmd=[sys.executable,str(ROOT/'tools/backup_status.py'),'--directory',str(tmp_path),'--require-offsite']
 assert subprocess.run(cmd,capture_output=True).returncode==1
 status.write_text(json.dumps({'lastSuccess':int(time.time()),'offsite':False}))
 assert subprocess.run(cmd,capture_output=True).returncode==1
 status.write_text(json.dumps({'lastSuccess':int(time.time()),'offsite':True}))
 assert subprocess.run(cmd,capture_output=True).returncode==0
 status.write_text(json.dumps({'lastSuccess':1,'offsite':True}))
 assert subprocess.run(cmd,capture_output=True).returncode==1

def test_read_only_fsrs_input_parser_sorts_and_preserves_modes(tmp_path):
 p=tmp_path/'backup.json';raw={'app':'nabu','logs':[{'cardId':'a','at':1793870002000,'rating':4,'practiceMode':'production'},{'cardId':'a','at':1793870001000,'rating':1}]};p.write_text(json.dumps(raw));before=p.read_bytes();reviews=load_reviews(p)
 assert [r['mode'] for r in reviews]==['recognition','production'];assert p.read_bytes()==before

@pytest.mark.parametrize('log',[{'cardId':'a','at':1,'rating':0},{'cardId':'a','at':1,'rating':True},{'cardId':'a','at':1,'rating':4,'practiceMode':'unknown'},{}])
def test_fsrs_input_parser_rejects_invalid_review_rows(tmp_path,log):
 p=tmp_path/'backup.json';p.write_text(json.dumps({'app':'nabu','logs':[log]}))
 with pytest.raises(ValueError):load_reviews(p)


def test_backup_monitor_requires_fresh_restore_drill_when_enabled(tmp_path):
 cmd=[sys.executable,str(ROOT/'tools/backup_status.py'),'--directory',str(tmp_path),'--require-offsite','--require-restore-drill']
 status=tmp_path/'status.json';status.write_text(json.dumps({'lastSuccess':int(time.time()),'offsite':True}))
 assert subprocess.run(cmd,capture_output=True).returncode==1
 (tmp_path/'restore-drill.json').write_text(json.dumps({'ok':True,'checkedAt':int(time.time())}))
 assert subprocess.run(cmd,capture_output=True).returncode==0
 (tmp_path/'restore-drill.json').write_text(json.dumps({'ok':True,'checkedAt':1}))
 assert subprocess.run(cmd,capture_output=True).returncode==1
