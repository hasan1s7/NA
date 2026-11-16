import time,uuid
from test_social import env
from decision_engine import decide,replay

def test_four_modes_authenticated(env):
    _,new,anon=env
    a=new('decision_owner');b=new('decision_other')
    assert anon.get('/api/decisions').status_code==401
    assert a.get('/api/decisions').status_code==200
    assert a.get('/api/decisions',params={'mode':'individual-defined','destination':'ar'}).status_code==200
    assert a.get('/api/decisions',params={'mode':'individual-defined'}).status_code==422
    assert a.get('/api/decisions',params={'mode':'enterprise-undefined','tenantId':'team1'}).status_code==403
    assert a.post('/api/decision-tenants',json={'id':'team1','label':'Test team'}).status_code==200
    assert b.get('/api/decisions',params={'mode':'enterprise-undefined','tenantId':'team1'}).status_code==403
    assert a.get('/api/decisions',params={'mode':'enterprise-undefined','tenantId':'team1'}).status_code==200
    assert a.get('/api/decisions',params={'mode':'enterprise-defined','tenantId':'team1','destination':'es'}).status_code==200
    assert b.post('/api/decision-tenants/team1/members',json={'userId':a.headers['X-Nabu-Account']}).status_code==403
    assert a.post('/api/decision-tenants/team1/members',json={'userId':b.headers['X-Nabu-Account']}).status_code==200
    assert b.get('/api/decisions',params={'mode':'enterprise-undefined','tenantId':'team1'}).status_code==200

def test_replay_deterministic_and_no_fake_recall_grade():
    now=int(time.time()*1000)
    e={'id':str(uuid.uuid4()),'contentId':'a-little-later','version':1,'kind':'opened','at':now}
    assert replay([e,e])==replay([e])
    assert decide([e],'individual-undefined')['recommendations']==decide([e,e],'individual-undefined')['recommendations']
    assert replay([e])==replay(list(reversed([e])))

def test_no_destination_leak_and_stable_recommendations():
    x=decide([],'individual-undefined')
    assert x['recommendations']==decide([],'individual-undefined')['recommendations']
    assert x['decisionPolicy']=='deterministic-content-v1'
