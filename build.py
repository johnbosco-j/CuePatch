"""Prepare a static Firebase Hosting directory using optional local demo settings."""
from pathlib import Path
from shutil import copyfile
root = Path(__file__).resolve().parent
dist = root / 'dist'
dist.mkdir(exist_ok=True)
for file in (root / 'web').iterdir():
    copyfile(file, dist / file.name)
if (root / 'config.local.js').is_file():
    copyfile(root / 'config.local.js', dist / 'config.js')
