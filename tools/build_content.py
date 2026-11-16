"""Build the original, versioned catalogue; fail on broken source anchors."""
from pathlib import Path
import json,subprocess
ROOT=Path(__file__).resolve().parents[1]
value=json.loads((ROOT/'data/explore.json').read_text(encoding='utf-8'))
# No runtime fetch or new credential: packaged, inspectable and usable offline.
(ROOT/'public/nabu-content-catalogue.js').write_text('/* Generated from data/explore.json. Edit the JSON, not this file. */\nexport const CATALOG = '+json.dumps(value,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
subprocess.run(['node','--input-type=module','-e','import {validateCatalogue} from "./public/nabu-content.js"; console.log(validateCatalogue());'],cwd=ROOT,check=True)
