"""Build vector graph-contract figures from saved measured results.

Run: python tools/build_graph_paper_figures.py
No fitting, API calls, learner data, or changes to the older evidence figures.
"""
from pathlib import Path
import hashlib
import json
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs/graph-evaluation/results.json"
OUT = ROOT / "paper/figures"
OUT.mkdir(parents=True, exist_ok=True)
data = json.loads(SOURCE.read_text())
assert data["protocol"] == "typed-incidence-v1"
assert not data["learnerModelUsed"] and not data["productionGraphMutated"]
assert all(check["pass"] for check in data["checks"])

plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 8,
    "axes.labelsize": 8, "axes.titlesize": 8.5, "legend.fontsize": 7,
    "xtick.labelsize": 7, "ytick.labelsize": 7, "pdf.fonttype": 42,
    "ps.fonttype": 42, "axes.spines.top": False, "axes.spines.right": False,
    "axes.linewidth": .65, "grid.linewidth": .4})
BLUE, ORANGE, GREEN = "#235789", "#B35B26", "#35734B"


def save(fig, name):
    fig.savefig(OUT / (name + ".pdf"), bbox_inches="tight", pad_inches=.035,
                metadata={"Title": name, "Subject": "Nabu structural contract evaluation",
                          "Creator": "tools/build_graph_paper_figures.py",
                          "CreationDate": None, "ModDate": None})
    plt.close(fig)


fig, axes = plt.subplots(1, 2, figsize=(6.7, 2.35), sharex=True, sharey=True)
for ax, metric, title in zip(axes,
        ["falseAvailabilityRate", "falseAmongAvailable"],
        ["(a) False positives / all input subsets",
         "(b) False positives / claimed available"]):
    for model, color, marker, label in [
            ("pairwise", ORANGE, "o", "Flattened-edge reachability"),
            ("incidence", BLUE, "s", "Complete-application gate")]:
        rows = sorted([r for r in data["conjunction"]["summary"]
                       if r["model"] == model], key=lambda r: r["arity"])
        ax.errorbar([r["arity"] for r in rows],
                    [r["metrics"][metric]["mean"] for r in rows],
                    yerr=[r["metrics"][metric]["sd"] for r in rows],
                    color=color, marker=marker, ms=4, capsize=2, lw=1.1, label=label)
    ax.set_title(title)
    ax.set_xscale("log", base=2)
    ax.set_xticks([1, 2, 4, 8, 16], [1, 2, 4, 8, 16])
    ax.set_xlabel("Required inputs (synthetic conjunction)")
    ax.set_ylim(-.04, 1.06)
    ax.grid(alpha=.2)
axes[0].set_ylabel("Rate")
fig.legend(*axes[0].get_legend_handles_labels(), ncol=2, loc="upper center",
           bbox_to_anchor=(.5, 1.05), frameon=False)
fig.subplots_adjust(left=.09, right=.99, bottom=.22, top=.81, wspace=.18)
save(fig, "graph_conjunction")

fig, axes = plt.subplots(1, 2, figsize=(6.7, 2.45))
rows = sorted([r for r in data["scale"]["rows"] if r["factorCount"] == 10000],
              key=lambda r: r["arity"])
x = [r["arity"] for r in rows]
axes[0].plot(x, [r["membershipIncidences"] for r in rows], color=BLUE,
             marker="s", ms=4, lw=1.1, label="Role-bearing incidences")
axes[0].plot(x, [r["directedEdges"] for r in rows], color=ORANGE,
             marker="o", ms=4, lw=1.1, label="Directed projected edges")
axes[0].set_title("(a) 10,000 declared association factors")
axes[0].set_ylabel("Stored membership / edge records")
axes[0].set_yscale("log")
axes[0].legend(frameon=False, loc="upper left")
axes[1].plot(x, [r["snapshotJSONBytes"] / 1e6 for r in rows], color=BLUE,
             marker="s", ms=4, lw=1.1, label="Typed snapshot + metadata")
axes[1].plot(x, [r["serializedEdgeArrayBytes"] / 1e6 for r in rows], color=ORANGE,
             marker="o", ms=4, lw=1.1, label="Lossy edge-array serialization")
axes[1].set_title("(b) Different schemas; no runtime claim")
axes[1].set_ylabel("Exact JSON bytes (decimal MB)")
axes[1].set_yscale("log")
axes[1].legend(frameon=False, loc="upper left")
for ax in axes:
    ax.set_xscale("log", base=2)
    ax.set_xticks([2, 4, 8, 16], [2, 4, 8, 16])
    ax.set_xlabel("Members per association factor")
    ax.grid(alpha=.2, which="both")
fig.subplots_adjust(left=.1, right=.99, bottom=.22, top=.85, wspace=.35)
save(fig, "graph_representation")

fig, axes = plt.subplots(1, 2, figsize=(6.7, 2.25))
rows = data["distractors"]
positions = np.arange(len(rows))
for key, label, color, marker in [("factors", "Factors", BLUE, "o"),
                                  ("incidences", "Incidences", ORANGE, "s")]:
    axes[0].plot(positions, [r["query"]["completeness"]["work"][key] for r in rows],
                 label=label, color=color, marker=marker, ms=4, lw=1.1)
axes[0].set_xticks(positions, [r["distractors"] for r in rows])
axes[0].set_xlabel("Irrelevant topic factors in indexed graph")
axes[0].set_ylabel("Counted visits after indexing")
axes[0].set_ylim(0, 3)
axes[0].set_title("(a) Explicit task-support relation filter")
axes[0].legend(frameon=False, ncol=2, loc="upper center")
rows = data["wideFactors"]
axes[1].plot([r["size"] for r in rows],
             [r["query"]["completeness"]["work"]["incidences"] for r in rows],
             color=ORANGE, marker="s", ms=4, lw=1.1, label="Incidence budget = 16")
axes[1].set_xscale("log")
axes[1].set_xticks([100, 1000, 10000], ["100", "1,000", "10,000"])
axes[1].set_xlabel("Members in one allowed factor")
axes[1].set_ylabel("Counted incidence visits")
axes[1].set_ylim(0, 20)
axes[1].set_title("(b) Every answer set marked incomplete")
axes[1].legend(frameon=False, loc="lower right")
for ax in axes:
    ax.grid(alpha=.2)
fig.subplots_adjust(left=.09, right=.99, bottom=.25, top=.84, wspace=.35)
save(fig, "graph_budgets")

(OUT / "graph-manifest.json").write_text(json.dumps({
    "source": str(SOURCE.relative_to(ROOT)),
    "sourceSHA256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
    "protocol": data["protocol"], "seeds": data["config"]["seeds"],
    "interpretation": "Repository measurements and synthetic structural-contract cases; no learner outcomes.",
    "errorBars": "Sample SD of per-seed rates across 12 fixed seeds; not a human confidence interval.",
    "files": ["graph_conjunction.pdf", "graph_representation.pdf", "graph_budgets.pdf"],
}, indent=2) + "\n")
audit = data["catalogue"]
values = {
    "GraphAlignments": audit["legacyStats"]["concepts"],
    "GraphLanguages": audit["legacyStats"]["languages"],
    "GraphTermSlots": audit["legacyStats"]["nodes"],
    "GraphTranslationPairs": audit["compatibility"]["pairsChecked"],
    "GraphRoleMismatches": audit["compatibility"]["oldTargetRoleMismatches"],
    "GraphNodes": audit["snapshot"]["nodeCount"],
    "GraphFactors": audit["snapshot"]["factorCount"],
    "GraphSources": audit["snapshot"]["sourceCount"],
    "GraphIncidences": audit["snapshot"]["membershipIncidences"],
    "GraphForms": audit["snapshot"]["indexStats"]["nodeTypes"]["form"],
    "GraphSnapshotBytes": audit["snapshot"]["JSONBytes"],
    "GraphExportBytes": audit["legacyExport"]["JSONBytes"],
    "GraphRuntimeBytes": audit["legacyRuntimeModuleBytes"],
    "GraphTopicPairs": audit["legacyExport"]["topicPairs"],
    "GraphBridges": audit["legacyExport"]["explicitBridgeRecords"],
    "GraphAmbiguousKeys": audit["ambiguousLookupKeys"],
    "GraphMultipleRoles": audit["snapshot"]["sameSurfaceDifferentRolePairs"],
    "GraphOccurrenceCount": len(audit["occurrences"]),
    "GraphAcceptanceChecks": len(data["checks"]),
    "GraphSubsets": len(data["config"]["seeds"]) * data["config"]["trialsPerSeed"] * len(data["config"]["arities"]),
}
lines = ["% Generated only from docs/graph-evaluation/results.json; do not edit numeric values."]
lines += ["\\newcommand{\\" + key + "}{" + f"{value:,}" + "}" for key, value in values.items()]
rows = []
for row in data["conjunction"]["summary"]:
    if row["model"] != "pairwise":
        continue
    fp = row["metrics"]["falseAvailabilityRate"]
    false_claim = row["metrics"]["falseAmongAvailable"]
    rows.append(f"{row['arity']} & ${fp['mean']:.4f} \\pm {fp['sd']:.4f}$ & "
                f"${false_claim['mean']:.4f} \\pm {false_claim['sd']:.4f}$ \\\\")
lines.append("\\newcommand{\\GraphConjunctionRows}{\n" + "\n".join(rows) + "\n}")
rows = []
for row in data["scale"]["rows"]:
    if row["factorCount"] == 10000:
        rows.append(f"{row['arity']} & {row['membershipIncidences']:,} & {row['directedEdges']:,} & "
                    f"{row['snapshotJSONBytes']/1e6:.3f} & {row['serializedEdgeArrayBytes']/1e6:.3f} \\\\")
lines.append("\\newcommand{\\GraphSizeRows}{\n" + "\n".join(rows) + "\n}")
(ROOT / "paper/graph-results.tex").write_text("\n".join(lines) + "\n")
print("Built three vector graph figures from " + str(SOURCE.relative_to(ROOT)))
