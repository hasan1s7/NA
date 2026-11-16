"""1.16 capability and packaging boundaries: no generative-provider side effects."""
from pathlib import Path
from fastapi.testclient import TestClient
from server import create_app

def test_missing_council_is_truthful_and_does_not_block_other_routes(tmp_path):
    app=create_app(tmp_path/'council.sqlite3','http://testserver',invite='',translation_key='')
    with TestClient(app,headers={'Origin':'http://testserver'}) as c:
        config=c.get('/api/config').json()
        assert config['releaseVersion']=='1.17.0'
        assert config['council']['enabled'] is False
        result=c.post('/api/council',json={'text':'ماء','sourceLang':'ar','explanationLang':'en'})
        assert result.status_code==503
        assert 'conversational AI provider' in result.json()['detail']
        assert c.get('/api/health').json()['version']=='1.17.0'
        for path in ['/read','explore','library','words','settings','review','friends']:
            assert c.get('/'+path.lstrip('/')).status_code==200

def test_rebuilt_shell_contains_modes_local_art_and_all_sources_without_remote_asset_dependency():
    root=Path(__file__).resolve().parents[1]
    html=(root/'public/index.html').read_text()
    assert 'nabu-workspaces-1.17-' in html
    assert 'At a glance' in html and 'In depth' in html
    assert 'scribe-art' in html and 'scribe-stylus' in html
    assert 'Emily Dickinson' in html and 'Celso Cunha' in html
    assert (root/'public/nabu-scribe.svg').exists()
    assert 'https://fonts.googleapis.com' not in html
    assert 'Nabu 1.17 - local application' in (root/'start_local.py').read_text()
