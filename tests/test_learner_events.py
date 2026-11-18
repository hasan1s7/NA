"""The shipped learner task's exact provenance through the existing account API."""
import copy
import json
from pathlib import Path
import subprocess

from test_social import env
from test_content_progress import send
from test_evidence_events import evidence_event, persisted, next_inputs

ROOT = Path(__file__).resolve().parents[1]


def learner_event(client, task_id="learner:ar:write:retrieval"):
    script = (
        "import {learnerTask} from './public/nabu-learner-tasks.js';"
        "console.log(JSON.stringify(learnerTask(process.argv[1])));"
    )
    run = subprocess.run(["node", "--input-type=module", "-e", script, task_id],
                         cwd=ROOT, capture_output=True, text=True, check=True)
    task = json.loads(run.stdout)
    event = evidence_event(client, "response", content_id=task["occurrence"]["contentId"])
    event["evidence"].update(
        taskRef={"id": task["id"], "version": task["version"]},
        occurrence=task["occurrence"], inputModality=task["inputModality"],
        outputModality=task["outputModality"],
        response={"answer": task["accepted"][0]},
        rubricRef=task["rubricRef"], scorerRef=task["scorerRef"],
        analysisRef=task["analysisRef"],
    )
    event["evidence"]["assistance"].update(task["requiredAssistance"])
    return event


def test_actual_learner_task_round_trips_and_replays_idempotently(env):
    _, new, _ = env
    owner = new("learner_owner")
    event = learner_event(owner)
    response = send(owner, [event])
    assert response.status_code == 200, response.text
    assert send(owner, [event]).status_code == 200
    assert persisted(owner) == [event]
    assert next_inputs(owner).json()["contentEvents"] == [event]
    assert owner.get("/api/config").json()["releaseVersion"] == "1.18.0"


def test_actual_conditioned_task_preserves_assistance_and_account_boundary(env):
    _, new, _ = env
    owner, other = new("learner_owner"), new("learner_other")
    event = learner_event(owner, "learner:ar:open:pattern")
    assert event["evidence"]["assistance"]["baseMeaningSupplied"] is True
    assert send(owner, [event]).status_code == 200
    assert next_inputs(other).json()["contentEvents"] == []
    assert send(other, [event]).status_code == 403
    assert persisted(owner) == [event]


def test_actual_learner_reference_cannot_be_replaced_by_a_conflicting_replay(env):
    _, new, _ = env
    owner = new("learner_owner")
    event = learner_event(owner)
    assert send(owner, [event]).status_code == 200
    altered = copy.deepcopy(event)
    altered["evidence"]["analysisRef"]["version"] = "changed-analysis"
    assert send(owner, [altered]).status_code == 409
    assert persisted(owner) == [event]
