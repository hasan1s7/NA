#!/usr/bin/env python3
"""Build publication figures and exact TeX values from actual evaluation JSON."""
from pathlib import Path
import hashlib
import json
import re
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs/learner-evaluation/results.json"
OUT = ROOT / "paper/figures"
OUT.mkdir(parents=True, exist_ok=True)
report = json.loads(SOURCE.read_text())
if not report["checks"]["passed"]:
    raise SystemExit("The numerical evaluation did not pass.")
plt.rcParams.update({
    "font.family": "DejaVu Sans", "font.size": 9,
    "axes.labelsize": 9, "axes.titlesize": 10,
    "axes.spines.top": False, "axes.spines.right": False,
    "pdf.fonttype": 42, "ps.fonttype": 42,
    "savefig.bbox": "tight", "savefig.pad_inches": 0.05,
})
stages = [
    ("prior", "Prior", "#819096", -0.18),
    ("arabicReadingEvidence", "Arabic: 21 / 24 correct", "#286B61", 0),
    ("opposingSpanishEvidence", "Then Spanish: 0 / 18", "#C0783C", 0.18),
]
task_labels = [
    ("ar", "Arabic contextual reading"),
    ("es", "Spanish aligned reading"),
    ("en", "English aligned reading"),
    ("vocabulary", "Untested Spanish form"),
]
fig, ax = plt.subplots(figsize=(6.65, 2.6))
for stage, label, color, offset in stages:
    rows = [report["posteriorScenarios"][stage][key] for key, _ in task_labels]
    x = np.array([row["mean"] for row in rows])
    low = np.array([row["lower"] for row in rows])
    high = np.array([row["upper"] for row in rows])
    ax.errorbar(x, np.arange(len(rows))+offset, xerr=[x-low, high-x],
                fmt="o", color=color, label=label, ms=4, capsize=2,
                elinewidth=1.1, alpha=0.95)
ax.set_yticks(np.arange(len(task_labels)), [label for _, label in task_labels])
ax.invert_yaxis()
ax.set_xlim(0, 1)
ax.set_xticks(np.linspace(0, 1, 6))
ax.set_xlabel("Conditional success probability (90% model intervals)")
ax.grid(axis="x", color="#DCE2E3", linewidth=0.6)
ax.set_axisbelow(True)
ax.legend(loc="upper center", bbox_to_anchor=(0.43, 1.24), frameon=False,
          ncol=3, fontsize=8)
fig.tight_layout()
fig.savefig(OUT / "learner_transfer.pdf")
fig.savefig(OUT / "learner_transfer.png", dpi=180)
plt.close(fig)

cases = [row for row in report["decisionCases"]
         if row["id"] in {"profitable-diagnostic", "noisy-diagnostic",
                          "informative-no-action-change",
                          "diagnostic-cost-break-even", "sequential-budget"}]
labels = {
    "profitable-diagnostic": "Accurate diagnostic",
    "noisy-diagnostic": "Noisy diagnostic",
    "informative-no-action-change": "Same best action",
    "diagnostic-cost-break-even": "Cost equals information value",
    "sequential-budget": "Follow-up exceeds budget",
}
fig, ax = plt.subplots(figsize=(6.65, 2.3))
y = np.arange(len(cases))
ax.barh(y-0.15, [c["observed"]["evsi"] for c in cases], height=.26,
        label="Information value (EVSI)", color="#6E8DA8")
ax.barh(y+0.15, [c["observed"]["netValue"] for c in cases], height=.26,
        label="Net improvement over acting now", color="#286B61")
ax.set_yticks(y, [labels[c["id"]] for c in cases])
ax.invert_yaxis()
ax.set_xlim(-0.46, .62)
ax.axvline(0, color="#435354", linewidth=.7)
ax.set_xlabel("Expected loss reduction (authored utility units)")
ax.grid(axis="x", color="#DCE2E3", linewidth=.6)
ax.set_axisbelow(True)
ax.legend(loc="upper center", bbox_to_anchor=(.48, 1.23), frameon=False,
          ncol=2, fontsize=8)
fig.tight_layout()
fig.savefig(OUT / "learner_decisions.pdf")
fig.savefig(OUT / "learner_decisions.png", dpi=180)
plt.close(fig)

def count_tests(path):
    value = path.read_text() if path.exists() else ""
    summary = {key: int(count) for key, count in re.findall(
        r"^(?:ℹ |# )?(tests|pass|fail|cancelled|skipped) (\d+)$", value, re.M)}
    if not summary or summary.get("fail") != 0 or summary.get("cancelled") != 0:
        raise SystemExit(f"Missing or failing test run: {path}")
    if summary.get("pass") != summary.get("tests") or summary.get("skipped") != 0:
        raise SystemExit(f"Incomplete test run: {path}")
    return summary["pass"]

posterior = report["posteriorScenarios"]
reference = report["numericalReference"]
verification_path = ROOT / "verification/learner-release.json"
verification = json.loads(verification_path.read_text()) if verification_path.exists() else {}
commands = {
    "LearnerTasks": report["catalogue"]["count"],
    "LearnerLanguages": len(report["catalogue"]["languages"]),
    "LearnerContrasts": 8,
    "LearnerExactCases": report["checks"]["exactDecisions"],
    "LearnerStructuralCases": report["checks"]["structural"],
    "LearnerArabicPrior": f'{posterior["prior"]["ar"]["mean"]:.3f}',
    "LearnerArabicPosterior": f'{posterior["arabicReadingEvidence"]["ar"]["mean"]:.3f}',
    "LearnerSpanishBorrowed": f'{posterior["arabicReadingEvidence"]["es"]["mean"]:.3f}',
    "LearnerSpanishCounter": f'{posterior["opposingSpanishEvidence"]["es"]["mean"]:.3f}',
    "LearnerUntestedForm": f'{posterior["arabicReadingEvidence"]["vocabulary"]["mean"]:.3f}',
    "LearnerReferenceMean": f'{reference["reference"]["mean"]:.5f}',
    "LearnerSampledMean": f'{reference["sampled"]["mean"]:.5f}',
    "LearnerReferenceError": f'{reference["absoluteErrors"]["mean"]:.5f}',
    "LearnerBrierPrior": f'{posterior["heldoutSynthetic"]["prior"]["brier"]:.4f}',
    "LearnerBrierPosterior": f'{posterior["heldoutSynthetic"]["posterior"]["brier"]:.4f}',
    "LearnerLogPrior": f'{posterior["heldoutSynthetic"]["prior"]["logLoss"]:.4f}',
    "LearnerLogPosterior": f'{posterior["heldoutSynthetic"]["posterior"]["logLoss"]:.4f}',
    "LearnerRuntime": f'{report["totalMilliseconds"]:.1f}',
}
for key, log in [("LearnerNodeTests", "learner-node-tests.log"),
                 ("LearnerDOMTests", "learner-dom-tests.log")]:
    count = count_tests(ROOT / "verification" / log)
    commands[key] = count if count is not None else "unreported"
api_log = (ROOT / "verification/learner-api-tests.log").read_text()
api_match = re.search(r"(\d+) passed", api_log)
commands["LearnerAPITests"] = int(api_match.group(1)) if api_match else "unreported"
(ROOT / "paper/learner-results.tex").write_text(
    "% Generated from docs/learner-evaluation/results.json and verification logs.\n"+
    "\n".join("\\newcommand{\\"+name+"}{"+str(value)+"}" for name, value in commands.items())+"\n"
)
manifest = {
    "source": str(SOURCE.relative_to(ROOT)),
    "source_sha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
    "modelVersion": report["modelVersion"],
    "policyVersion": report["policyVersion"], "seed": report["seed"],
    "figures": ["learner_transfer.pdf", "learner_decisions.pdf"],
    "verification": verification,
}
(OUT / "learner-manifest.json").write_text(json.dumps(manifest, indent=2)+"\n")
print("Built learner figures and exact result macros from saved numerical results.")
