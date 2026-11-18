import copy
import json
import subprocess
import time
import uuid
import pytest
from fastapi.testclient import TestClient
from server import create_app
from test_social import env, PASSWORD
from test_content_progress import send


def record(
    uid, action="keep", mode="practice", source=None, cid="moment:bend", at=None
):
    return dict(
        id=str(uuid.uuid4()),
        kind="moment",
        contentId=cid,
        version=1,
        at=int(time.time() * 1000) if at is None else at,
        moment=dict(
            schemaVersion=1, userId=uid, action=action, mode=mode, source=source
        ),
    )


def test_moments_use_existing_private_outbox_contract_and_survive_restart(env):
    app, new, _ = env
    a, b = new("moment_owner"), new("moment_other")
    uid = a.headers["X-Nabu-Account"]
    at = int(time.time() * 1000) - 86401000
    source = dict(
        origin="learner",
        title="At the station",
        text="The last train.",
        language="en",
        pieceId="1" * 64,
        offset=34,
        seconds=8,
    )
    k = record(uid, source=source, cid="moment:own:" + "a" * 64, at=at)
    r = record(uid, "reopen", None, cid=k["contentId"], at=at + 86400000)
    assert a.get("/api/config").json()["moments"]
    assert send(a, [k, r]).status_code == 200
    assert send(a, [k, r]).status_code == 200
    assert b.get("/api/content-progress").json()["events"] == []
    assert send(b, [k]).status_code == 403
    assert (
        send(a, [{**k, "moment": {**k["moment"], "mode": "familiar"}}]).status_code
        == 409
    )
    assert a.get("/api/library").json()["logs"] == []
    with TestClient(
        create_app(
            app.state.db_path, "http://testserver", invite="", translation_key=""
        ),
        headers={"Origin": "http://testserver"},
    ) as c:
        assert (
            c.post(
                "/api/login", json={"handle": "moment_owner", "password": PASSWORD}
            ).status_code
            == 200
        )
        assert sorted(
            c.get("/api/content-progress").json()["events"],
            key=lambda event: event["at"],
        ) == [k, r]


@pytest.mark.parametrize(
    "change",
    [
        {"action": "mastered"},
        {"mode": "wrong"},
        {"attention": True},
        {"source": {"privateMedia": "x"}},
        {"schemaVersion": True},
    ],
)
def test_moments_reject_unsupported_claims_and_payloads(env, change):
    _, new, _ = env
    a = new("moment_invalid")
    e = record(a.headers["X-Nabu-Account"])
    e["moment"].update(change)
    assert send(a, [e]).status_code == 422


def test_undo_and_invalid_auto_return_are_atomic(env):
    _, new, _ = env
    a = new("moment_undo")
    uid = a.headers["X-Nabu-Account"]
    k = record(uid)
    u = record(uid, "undo", None, at=k["at"] + 2)
    u["moment"]["undoOf"] = k["id"]
    assert send(a, [u]).status_code == 409
    assert send(a, [k, {**u, "contentId": "moment:dream"}]).status_code == 409
    assert a.get("/api/content-progress").json()["events"] == []
    assert send(a, [k, u]).status_code == 200


def test_shared_forecast_flag_and_reviewed_correction_are_validated_over_http(env):
    _, new, _ = env
    a = new("moment_replay")
    uid = a.headers["X-Nabu-Account"]
    script = """import {createSupportFixture} from './tools/support_cycle_fixtures.mjs';
const f=createSupportFixture({actor:{userId:process.argv[1],tenantId:null},at:Date.now()-5000});
const bad=f.begin('moment-task:camille:old-key');f.respond(bad,{choice:2});f.append(bad,'question-flagged');f.correct(bad);
const good=f.begin('moment-task:camille:first');f.events.find(e=>e.cycle.attemptId===good.attemptId&&e.cycle.observation==='task-presented').cycle.forecast={version:'moment-forecast-v1',ladder:0.34,model:0.6,priorResponses:0};f.respond(good,{choice:1});console.log(JSON.stringify(f.events));"""
    rows = json.loads(
        subprocess.check_output(
            ["node", "--input-type=module", "-e", script, uid], text=True
        )
    )
    assert send(a, rows).status_code == 200
    assert send(a, rows).status_code == 200
    tampered = copy.deepcopy(rows[-1])
    tampered["cycle"]["forecast"] = {
        "version": "moment-forecast-v1",
        "ladder": 1,
        "model": 1,
        "priorResponses": 0,
    }
    assert send(a, [tampered]).status_code == 422
