"""Prepare a static Firebase Hosting directory using optional local demo settings."""
from pathlib import Path
from hashlib import sha256
from shutil import copyfile
root = Path(__file__).resolve().parent
dist = root / 'dist'
dist.mkdir(exist_ok=True)
for file in (root / 'web').iterdir():
    copyfile(file, dist / file.name)
if (root / 'config.local.js').is_file():
    copyfile(root / 'config.local.js', dist / 'config.js')

assets = sha256()
for source in sorted(dist.iterdir()):
    if source.is_file() and source.name != 'sw.js':
        assets.update(source.name.encode())
        assets.update(source.read_bytes())
worker = (root / 'web' / 'sw.js').read_text()
(dist / 'sw.js').write_text(worker.replace('__ASSET_HASH__', assets.hexdigest()[:16]))
