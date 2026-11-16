"""Real FastAPI/SQLite contract tests. No translation or image providers."""
import pytest
from fastapi.testclient import TestClient
from test_social import env, card, put, PASSWORD
from server import create_app


def editable(value):
    return {k:v for k,v in value.items() if k not in ('id','createdAt','updatedAt','revision','archived','schedule','skills')}


def test_reading_and_flag_survive_new_app_and_signin(env):
    app,new,_=env
    a=new('meaning_owner')
    c=put(a,card(imageId='water',reading='My checked water reading',readingMethod='User reading aid'))
    patch={**editable(c),'imageId':'','imageDismissed':['water'],'reading':'My corrected reading'}
    response=a.patch('/api/library/cards/'+c['id'],json={'revision':c['revision'],'content':patch})
    assert response.status_code==200,response.text
    rebuilt=create_app(app.state.db_path,'http://testserver',invite='',translation_key='')
    with TestClient(rebuilt,headers={'Origin':'http://testserver'}) as fresh:
        assert fresh.post('/api/login',json={'handle':'meaning_owner','password':PASSWORD}).status_code==200
        current=fresh.get('/api/library').json()['cards'][0]
        assert current['reading']=='My corrected reading'
        assert current['imageDismissed']==['water'] and current['imageId']==''
        assert current['context']==c['context'] and current['schedule']==c['schedule']


def test_duplicate_capture_does_not_overwrite_user_correction_or_flag(env):
    _,new,_=env;a=new('meaning_owner')
    saved=put(a,card(reading='Corrected',readingMethod='User reading aid',imageDismissed=['water']))
    repeated=put(a,card(reading='Automatic draft',readingMethod='Russian letter transliteration',imageDismissed=[]))
    assert repeated['id']==saved['id']
    assert repeated['reading']=='Corrected' and repeated['imageDismissed']==['water']


def test_explicit_hidden_reading_is_preserved_and_can_be_replaced(env):
    _,new,_=env;a=new('meaning_owner')
    c=put(a,card(reading='',readingMethod='User reading aid (hidden)'))
    assert a.get('/api/library').json()['cards'][0]['readingMethod']=='User reading aid (hidden)'
    response=a.patch('/api/library/cards/'+c['id'],json={'revision':c['revision'],'content':{**editable(c),'reading':'A deliberate new reading','readingMethod':'User reading aid'}})
    assert response.status_code==200,response.text
    assert a.get('/api/library').json()['cards'][0]['reading']=='A deliberate new reading'


def test_image_and_reading_metadata_are_account_private(env):
    _,new,_=env;a=new('meaning_owner');b=new('other_owner')
    c=put(a,card(imageDismissed=['water'],reading='Private correction'))
    assert b.get('/api/library').json()['cards']==[]
    assert b.patch('/api/library/cards/'+c['id'],json={'revision':0,'content':editable(c)}).status_code==404


@pytest.mark.parametrize('value', [['../private'],['<script>'],['x'*41],['water']*25,[None]])
def test_invalid_feedback_identifiers_rejected(env,value):
    _,new,_=env;a=new('meaning_owner')
    response=a.post('/api/library/translations',json={'card':card(imageDismissed=value)})
    assert response.status_code==422,response.text
    assert a.get('/api/library').json()['cards']==[]


def test_legacy_card_missing_new_fields_still_saves(env):
    _,new,_=env;a=new('meaning_owner');c=put(a)
    assert c['imageDismissed']==[] and c['reading']==''


def test_same_spelling_distinct_manual_meanings_remain_separate(env):
    _,new,_=env;a=new('meaning_owner')
    finance=put(a,card(front='bank',back='financial institution',conceptId='city.bank',imageId='bank',context='I deposited money at the bank.'))
    river=put(a,card(front='bank',back='land alongside a river',conceptId='',imageId='',context='We sat on the bank of the river.'))
    assert finance['id']!=river['id']
    assert len(a.get('/api/library').json()['cards'])==2
    assert river['imageId']=='' and river['context']=='We sat on the bank of the river.'


def test_same_concept_across_languages_references_one_asset(env):
    _,new,_=env;a=new('meaning_owner')
    c=put(a,card(imageId='water'))
    ar=put(a,card(front='\u0645\u0627\u0621',back='water',sourceLang='ar',targetLang='en',imageId='water'))
    assert c['id']!=ar['id'] and c['conceptId']==ar['conceptId'] and c['imageId']==ar['imageId']=='water'
