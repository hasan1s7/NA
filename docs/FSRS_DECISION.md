# Scheduler decision for Nabu 1.4

**Keep the existing production scheduler. Do not silently reschedule users.**

This release separates recognition, production, listening and sentence-completion
schedules. Changing the underlying algorithm at the same time without a staged
migration would make both compatibility failures and learning claims hard to
interpret. There is no supplied real learner dataset to establish superiority.

The production policy remains `nabu-srs-v1`, an explicitly SM-2-inspired heuristic,
not AnkiWeb synchronization, Anki's implementation or FSRS. Existing schedules
and imports keep their values. Historical unlabelled reviews mean recognition.

`tools/evaluate_fsrs.py` supplies an opt-in, read-only replay against the official
Python package. It groups by card and skill, sorts events, retains original times,
computes Brier/log-loss only on next reviews after at least 24 hours, and produces
candidate schedules without writing a Nabu database. Ratings are self-assessments.
This is exploratory model checking, not a randomized comparison or efficacy claim.
Default FSRS parameters are not optimized on the same evaluation data.

```bash
# Separate analysis environment, not production requirements:
python -m pip install fsrs==6.3.0
python tools/evaluate_fsrs.py PRIVATE_BACKUP.json --output PRIVATE_fsrs-evaluation.json
```

**Verification boundary:** the input parser and no-input-mutation checks ran. The
optional `fsrs` dependency could not be installed because package-network access
was unavailable. Library replay, calibration and migration are unverified. Do not
mistake the existence of this helper for a successful FSRS benchmark.

Before replacing the scheduler: gather consented longitudinal review history,
exclude missing-history imports or flag them, use a held-out later time window,
inspect calibration by skill and language, compare actual workload/retention in a
prospective pilot, and design an opt-in reversible schema migration. Keep original
schedules and logs for rollback. No automatic production migration is implemented.

Primary references:
https://open-spaced-repetition.github.io/py-fsrs/fsrs.html
https://docs.ankiweb.net/deck-options.html#fsrs
https://pypi.org/project/fsrs/6.3.0/
