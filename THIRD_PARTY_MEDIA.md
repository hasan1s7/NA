# Third-party media attribution

Five **unmodified** SVGs by **OpenMoji contributors**, distributed under
**Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)**.

Project: https://openmoji.org/
Source: https://github.com/hfg-gmuend/openmoji
License: https://creativecommons.org/licenses/by-sa/4.0/
Full source license text: https://github.com/hfg-gmuend/openmoji/blob/master/LICENSE.txt

| Bundled filename | Original source | Git blob SHA verified during packaging |
|---|---|---|
| `public/clipart/water.svg` | `color/svg/1F4A7.svg` | `5a70df569f9ce02d40d306ba33c42a9d3e59264f` |
| `public/clipart/book.svg` | `color/svg/1F4D6.svg` | `c9ae8df5831d75c1801344eac9b5253c09001bf9` |
| `public/clipart/house.svg` | `color/svg/1F3E0.svg` | `fa2faf7798857257196861ef9fa621fde7c5728d` |
| `public/clipart/sun.svg` | `color/svg/2600.svg` | `d875b61b39a52721a341e815944377c852e22283` |
| `public/clipart/bank.svg` | `color/svg/1F3E6.svg` | `028d7f0dfe2344ff8a492be65b195ef089b952e7` |

The bundled SVGs were not redrawn or modified. The generated JavaScript embeds
these exact bytes as data URLs so the cards do not depend on a remote image host.
`tools/build_media_catalogue.py` checks source blob hashes and rejects executable
or externally referenced SVG content before building the catalogue.

Retain attribution and license information when redistributing these assets.
Adaptations of the artwork must follow the license's ShareAlike conditions.
No endorsement by OpenMoji is implied. These assets are supplied without warranty.
This notice does not change the license/ownership of Nabu's application code.

## Catalogue and style

`data/illustrations.json` records each asset's meaning/concept, descriptive alt text,
style version `nabu-openmoji-1`, source, applicable license, original Git blob and
SHA-256 hashes. `generation: null` means bundled original artwork, not AI generation.
Financial bank is only for `city.bank`, never an automatic illustration for a river
bank. The initial catalogue has no idiom illustration. See `MEANING_TOOLS.md`.

## Optional speech model/software (not bundled)

`requirements-speech.txt` selects faster-whisper 1.2.1. The setup helper can
explicitly download a multilingual Systran faster-whisper conversion. No model
weights or FFmpeg binaries are included in this archive.

- https://github.com/SYSTRAN/faster-whisper (software and installation documentation)
- https://huggingface.co/Systran/faster-whisper-base (model card/license)
- https://ffmpeg.org/legal.html (FFmpeg distribution terms)

Keep the licenses of any separately installed software/models. Free software does
not imply zero computing cost, universal accuracy, or permission to record media.
