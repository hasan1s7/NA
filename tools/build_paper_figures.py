"""Build vector figures from the saved synthetic evaluation; no rerunning or fitting.

Run from any directory: python tools/build_paper_figures.py
Requires matplotlib. All uncertainty bars are sample SD across the 12 fixed seeds.
"""
from pathlib import Path
import json
import hashlib
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'docs/evidence-evaluation/results.json'
OUT = ROOT / 'paper/figures'
OUT.mkdir(parents=True, exist_ok=True)
data = json.loads(SOURCE.read_text())
assert data['synthetic'] and data['protocol'] == 'synthetic-evidence-v1'
plt.rcParams.update({'font.family': 'DejaVu Sans', 'font.size': 8,
 'axes.labelsize': 8, 'axes.titlesize': 9, 'legend.fontsize': 7,
 'xtick.labelsize': 7, 'ytick.labelsize': 7, 'pdf.fonttype': 42,
 'ps.fonttype': 42, 'axes.spines.top': False, 'axes.spines.right': False,
 'axes.linewidth': .65, 'grid.linewidth': .4, 'savefig.dpi': 220})
BLUE, ORANGE = '#235789', '#B35B26'
worlds = ['shared-operation', 'independent-memorized-items',
          'same-spelling-different-reading', 'conflicting-analysis',
          'wrong-application-domain']
labels = ['Shared\noperation', 'Independent\nitems', 'Distinct\nreadings',
          'Conflicting\nanalysis', 'Wrong\ndomain']

def save(fig, name):
    fig.savefig(OUT / (name + '.pdf'), bbox_inches='tight', pad_inches=.035,
                metadata={'Title': name, 'Subject': 'Synthetic Nabu evidence evaluation',
                          'Creator': 'tools/build_paper_figures.py',
                          'CreationDate': None, 'ModDate': None})
    plt.close(fig)

fig, axes = plt.subplots(1, 3, figsize=(6.7, 2.65), sharey=True)
splits = ['later-same-item', 'new-item-within-family', 'new-lexical-family']
titles = ['(a) Later, same item', '(b) New item, same family', '(c) New lexical family']
for ax, split, title in zip(axes, splits, titles):
    for offset, model, color, label in [(-.18, 'direct-item', BLUE, 'Direct item'),
                                       (.18, 'experimental-graph', ORANGE, 'Experimental graph')]:
        rows = [next(r for r in data['prediction']['summary'] if r['world'] == w
                     and r['split'] == split and r['model'] == model) for w in worlds]
        ax.barh(np.arange(5) + offset, [r['metrics']['brier']['mean'] for r in rows],
               xerr=[r['metrics']['brier']['sd'] for r in rows], height=.34,
               color=color, label=label, capsize=2, error_kw={'lw': .7})
    ax.set_yticks(range(5), labels)
    ax.set_xlim(0, .59)
    ax.set_xticks([0, .2, .4])
    ax.set_xlabel('Brier score')
    ax.set_title(title, fontsize=8)
    ax.xaxis.grid(True, alpha=.25)
    ax.set_axisbelow(True)
axes[0].invert_yaxis()
fig.legend(*axes[0].get_legend_handles_labels(), ncol=2, loc='upper center',
           bbox_to_anchor=(.55, 1.04), frameon=False)
fig.subplots_adjust(left=.14, wspace=.17, bottom=.18, top=.84)
save(fig, 'prediction_brier')

fig, axes = plt.subplots(1, 2, figsize=(6.7, 2.35), sharex=True, sharey=True)
for ax, world, title in zip(axes, ['shared-operation', 'wrong-application-domain'],
                           ['(a) Shared operation', '(b) Wrong application domain']):
    ax.plot([0, 1], [0, 1], color='#888888', ls='--', lw=.8, label='Ideal calibration')
    for model, color, marker, label in [('direct-item', BLUE, 's', 'Direct item'),
                                        ('experimental-graph', ORANGE, 'o', 'Experimental graph')]:
        row = next(r for r in data['prediction']['summary'] if r['world'] == world
                   and r['split'] == 'new-lexical-family' and r['model'] == model)
        bins = [b for b in row['pooled']['reliability'] if b['n']]
        ax.plot([b['meanPrediction'] for b in bins], [b['observedFrequency'] for b in bins],
                marker=marker, ms=4.5, lw=1.1, color=color, label=label)
    ax.set(xlim=(-.03, 1.03), ylim=(-.03, 1.03), xlabel='Mean predicted probability')
    ax.set_title(title)
    ax.grid(alpha=.2)
axes[0].set_ylabel('Observed correct frequency')
fig.legend(*axes[0].get_legend_handles_labels(), ncol=3, loc='upper center',
           bbox_to_anchor=(.5, 1.12), frameon=False)
fig.subplots_adjust(wspace=.18, top=.87, bottom=.22)
save(fig, 'calibration')

policy_worlds = ['uncertain-critical', 'known-critical-gap', 'already-ready',
                 'stale-success-history', 'assisted-retry']
policy_labels = ['Uncertain critical items', 'Known critical gap', 'Already ready',
                 'Stale success history', 'Assisted retry']
colors = ['#235789', '#B35B26', '#35734B', '#9C3848', '#765D9D']
markers = ['o', 's', '^', 'D', 'v']
fig, axes = plt.subplots(1, 2, figsize=(6.7, 2.5))
for world, label, color, marker in zip(policy_worlds, policy_labels, colors, markers):
    rows = sorted([r for r in data['policy']['paired'] if r['world'] == world
                   and r['regime'] == 'assumed-default'], key=lambda r: r['budget'])
    for ax, metric, scale in [(axes[0], 'taskSuccess', 100), (axes[1], 'questions', 1)]:
        ax.errorbar([r['budget'] for r in rows], [r['metrics'][metric]['mean']*scale for r in rows],
                    yerr=[r['metrics'][metric]['sd']*scale for r in rows],
                    color=color, marker=marker, ms=4, lw=1.1, capsize=2, label=label)
for ax in axes:
    ax.axhline(0, color='#555555', lw=.8, ls='--')
    ax.set_xticks([60, 120, 240])
    ax.set_xlabel('Shared time budget (seconds)')
    ax.grid(alpha=.2)
axes[0].set_ylabel('Task success difference (pp)')
axes[1].set_ylabel('Assessment-question difference')
axes[0].set_title('(a) Diagnostic minus fixed')
axes[1].set_title('(b) Diagnostic minus fixed')
fig.legend(*axes[0].get_legend_handles_labels(), ncol=3, loc='lower center',
           bbox_to_anchor=(.5, -.11), frameon=False)
fig.subplots_adjust(wspace=.3, bottom=.29, top=.88)
save(fig, 'policy_budget')

fig, axes = plt.subplots(1, 3, figsize=(6.7, 2.45), sharey=True)
for ax, regime, title in zip(axes, ['weak', 'assumed-default', 'strong'],
                            ['(a) Gain .15, retention .50', '(b) Gain .45, retention .75',
                             '(c) Gain .65, retention .90']):
    for world, label, color, marker in zip(policy_worlds, policy_labels, colors, markers):
        rows = sorted([r for r in data['policy']['paired'] if r['world'] == world
                       and r['regime'] == regime], key=lambda r: r['budget'])
        ax.errorbar([r['budget'] for r in rows], [r['metrics']['taskSuccess']['mean']*100 for r in rows],
                    yerr=[r['metrics']['taskSuccess']['sd']*100 for r in rows],
                    color=color, marker=marker, ms=3.5, lw=1, capsize=1.5, label=label)
    ax.axhline(0, color='#555555', lw=.7, ls='--')
    ax.set_xticks([60, 120, 240])
    ax.set_xlabel('Budget (seconds)')
    ax.set_title(title, fontsize=8)
    ax.grid(alpha=.2)
axes[0].set_ylabel('Task success difference (pp)')
fig.legend(*axes[0].get_legend_handles_labels(), ncol=3, loc='lower center',
           bbox_to_anchor=(.5, -.11), frameon=False)
fig.subplots_adjust(wspace=.15, bottom=.29, top=.87)
save(fig, 'policy_sensitivity')

(OUT / 'manifest.json').write_text(json.dumps({
 'synthetic': True, 'source': str(SOURCE.relative_to(ROOT)),
 'sourceSHA256': hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
 'protocol': data['protocol'], 'seeds': data['config']['seeds'],
 'errorBars': 'Sample SD across fixed-seed means; calibration curves pool nonempty bins.',
 'files': ['prediction_brier.pdf', 'calibration.pdf', 'policy_budget.pdf', 'policy_sensitivity.pdf']
}, indent=2)+'\n')
print('Built four vector figures from '+str(SOURCE.relative_to(ROOT)))
