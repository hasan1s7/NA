# Nabu 1.15.0 - Source, previews, and slideshow

## Open these files

- `nabu-local-1.15.0.zip`: the original complete 1.15.0 application source archive, unchanged.
- `Nabu-1.15.0-Walkthrough.pptx`: new editable eight-slide walkthrough.
- `Nabu-1.15.0-Walkthrough.pdf`: PDF version of the same slides.
- `Nabu-Bayesian-Learner-Paper-1.15.0.pdf`: the original nine-page paper, unchanged.
- `previews/`: eight slide PNGs, two actual paper-page PNGs, and a slide contact sheet.
- `Nabu-1.15.0-Delivery-Manifest.json`: the original source-release verification record.
- `DELIVERY-CHECKS.json`: checks performed while assembling this delivery.

## Preview boundary

The PNGs are paper pages and rendered presentation slides, NOT native application screenshots.
The flow slide is a source-grounded schematic. The numerical figures are copied unchanged from
saved synthetic results. They are not this user's history, calibrated human performance, or
measured learning gains. Native-browser visual acceptance remains unverified.

## Start the app

1. Extract `nabu-local-1.15.0.zip` into a separate folder.
2. Enter its `nabu` directory.
3. Run `python start_local.py` (Windows: `py -3 start_local.py`).
4. Open `http://127.0.0.1:8000/explore` or `/read`.
5. Choose `A small learning goal` > `Find useful support`.

Use Python 3.11 or newer. The launcher manages the existing hosting setup; the learner inference
adds no paid provider or runtime credentials. The ZIP includes editable paper sources, tests,
and the generated application.

## Upgrade and verification

Preserve existing private `.data/` and `.env.local` files; make backups before updating.
Keep the same browser profile and origin to retain browser-local work. See
`nabu/docs/RELEASE_NOTES_1.15.0.md` for complete instructions.

The ZIP and paper SHA-256 values match the original 1.15.0 delivery manifest. ZIP CRC integrity
and all 695 content hashes in `nabu/RELEASE_MANIFEST_1.15.0.json` were checked again for this delivery.
Use that versioned manifest for current content hashes: the retained `nabu/SHA256SUMS.json` is a
historical 1.14 file and is not the 1.15 release manifest.

The 855 JavaScript, 72 DOM, and 483 Python passes shown in the slides are recorded release results,
not reruns performed during this packaging request. This delivery rechecked file integrity and
rendered/checked the slideshow. No application source or paper content was changed.
