"""Build the locally bundled, sense-bound catalogue. No provider or network calls."""
from pathlib import Path
import base64, hashlib, json, xml.etree.ElementTree as ET
ROOT = Path(__file__).resolve().parents[1]
catalogue = json.loads((ROOT/'data/illustrations.json').read_text())
items = []
for asset in catalogue['assets']:
    raw = (ROOT/'public/clipart'/f"{asset['id']}.svg").read_bytes()
    assert hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest() == asset['sourceBlob'], 'Upstream asset changed: '+asset['id']
    assert hashlib.sha256(raw).hexdigest() == asset['sha256']
    assert asset['concepts'] and asset['alt'] and asset['sense'] and asset['license']
    assert asset['styleVersion'] == catalogue['styleVersion']
    tree = ET.fromstring(raw)
    for el in tree.iter():
        assert el.tag.split('}')[-1] not in ('script','foreignObject','image','text')
        assert not any(k.startswith('on') or 'href' in k for k in el.attrib)
    items.append({**asset, 'src':'data:image/svg+xml;base64,'+base64.b64encode(raw).decode()})
(ROOT/'public/nabu-clipart.js').write_text('/* Generated catalogue. OpenMoji, CC BY-SA 4.0; unmodified. See THIRD_PARTY_MEDIA.md. */\nexport const CLIPART = '+json.dumps(items,ensure_ascii=True)+';\n')
print('Embedded', len(items), 'unmodified, hash-verified, sense-bound OpenMoji assets')
