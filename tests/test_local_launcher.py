"""Local launcher config safety. These tests never install packages or open a browser."""
import os
from pathlib import Path
import pytest
import start_local as L


def test_env_is_literal_and_rejects_shell_commands(tmp_path):
    p = tmp_path / '.env.local'
    p.write_text("# test\nDEEPL_API_KEY='$(echo secret)'\nELEVENLABS_VOICES_JSON='{}'\nPORT=8000\n")
    assert L.load_local_env(p)['DEEPL_API_KEY'] == '$(echo secret)'
    assert L.load_local_env(p)['ELEVENLABS_VOICES_JSON'] == '{}'
    p.write_text('PATH=/wrong\n')
    with pytest.raises(ValueError): L.load_local_env(p)


def test_errors_never_echo_values(tmp_path):
    p=tmp_path/'.env.local';p.write_text("DEEPL_API_KEY='THIS_IS_PRIVATE\n")
    with pytest.raises(ValueError) as e:L.load_local_env(p)
    assert 'THIS_IS_PRIVATE' not in str(e.value)


def test_first_setup_is_private_local_and_existing_config_is_not_replaced(tmp_path,monkeypatch):
    monkeypatch.setattr(L,'ROOT',tmp_path)
    (tmp_path/'.env.local.example').write_text('PORT=8000\nNABU_DB=.data/words.sqlite3\nDEEPL_API_KEY=\n')
    for key in ['PORT','NABU_DB','DEEPL_API_KEY']:
        monkeypatch.delenv(key, raising=False)
    monkeypatch.setenv('NABU_HOST','0.0.0.0')
    monkeypatch.setenv('NABU_ORIGIN','https://old.example')
    port,origin,db=L.prepare_environment()
    assert port==8000 and origin=='http://127.0.0.1:8000'
    assert os.environ['NABU_HOST']=='127.0.0.1'
    assert db==tmp_path/'.data/words.sqlite3'
    assert not db.exists()
    path=tmp_path/'.env.local';path.write_text('DEEPL_API_KEY=preserved\n')
    L.prepare_environment(8123)
    assert path.read_text()=='DEEPL_API_KEY=preserved\n'
    assert os.environ['NABU_ORIGIN']=='http://127.0.0.1:8123'


def test_local_secret_file_is_excluded_from_git_and_docker():
    root=Path(__file__).resolve().parents[1]
    assert '.env.local' in (root/'.gitignore').read_text()
    assert '.env.local' in (root/'.dockerignore').read_text()
    assert 'translation_memory.py' in (root/'Dockerfile').read_text()
