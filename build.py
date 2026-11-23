"""Prepare a static Firebase Hosting directory using optional local demo settings."""
from pathlib import Path
from hashlib import sha256
import json
import os
from shutil import copyfile
root = Path(__file__).resolve().parent
dist = root / 'dist'
dist.mkdir(exist_ok=True)
for file in (root / 'web').iterdir():
    copyfile(file, dist / file.name)
web_config = os.environ.get('CUEPATCH_FIREBASE_WEB')
if web_config:
    config = json.loads(web_config)
    if not config.get('appCheckSiteKey') or not all(config.get('firebase', {}).get(key) for key in ('projectId', 'apiKey', 'appId')):
        raise ValueError('CUEPATCH_FIREBASE_WEB needs the Firebase web registration and public App Check site key.')
    public = {'firebase': config['firebase'], 'appCheckSiteKey': config['appCheckSiteKey'], 'localDebug': False}
    (dist / 'config.js').write_text('window.CUEPATCH_CONFIG = ' + json.dumps(public) + ';\n')
elif (root / 'config.local.js').is_file():
    copyfile(root / 'config.local.js', dist / 'config.js')

assets = sha256()
for source in sorted(dist.iterdir()):
    if source.is_file() and source.name != 'sw.js':
        assets.update(source.name.encode())
        assets.update(source.read_bytes())
worker = (root / 'web' / 'sw.js').read_text()
(dist / 'sw.js').write_text(worker.replace('__ASSET_HASH__', assets.hexdigest()[:16]))
