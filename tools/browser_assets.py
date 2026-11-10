"""Build/check the search index, JSON content versions, and navigation thumbnails.

Run: python -m tools.browser_assets [--check]
"""
from __future__ import annotations
import argparse
import io
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import subprocess
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
WEAPONS = 'pages/items/weapons_data05.json'
ARMORS = 'pages/items/armors_data06.json'
MONSTERS = 'pages/enemies/monsters_data03.json'
PERKS = 'pages/systems/perks.json'
ALLOWLISTS = 'data/allowlists.json'
DROPS = 'data/codex-overrides/drop_sources.json'
RESISTS = 'pages/systems/resistances.json'
RELATIONSHIPS = ['data/codex-overrides/item_relationships.json','data/codex-overrides/item_relationship_targets.json']
CATALOGS = {
    'pages/items/weapons.html': (WEAPONS,'weapons','weapon','Weapons'),
    'pages/items/armors.html': (ARMORS,'armors','armor','Armors'),
    'pages/enemies/monsters.html': (MONSTERS,'monsters','monster','Monsters'),
    'pages/items/collectables.html': ('pages/items/collectables_data.json','collectables','collectable','Collectables'),
    'pages/items/useables.html': ('pages/items/useables_data.json','useables','useable','Useables'),
}

class PageText(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.body = False
        self.skip = 0
        self.parts = []
        self.assets = []
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        asset = attrs.get('src') if tag == 'script' else attrs.get('href') if tag == 'link' and attrs.get('rel') == 'stylesheet' else None
        if asset and asset.startswith(('js/','css/')): self.assets.append(asset)
        if tag == 'body': self.body = True
        if tag in ('script','style','noscript'): self.skip += 1
    def handle_endtag(self, tag):
        if tag == 'body': self.body = False
        if tag in ('script','style','noscript'): self.skip = max(0,self.skip-1)
    def handle_data(self, data):
        if self.body and not self.skip: self.parts.append(data)

def digest(data):
    return hashlib.sha256(data).hexdigest()

def build(root=ROOT):
    pages = [root/'index.html', *sorted((root/'pages').rglob('*.html'))]
    texts = {}
    descriptors = {}
    for path in pages:
        parser = PageText()
        parser.feed(path.read_text(encoding='utf-8'))
        relative = path.relative_to(root).as_posix()
        texts[relative] = ' '.join(' '.join(parser.parts).split())
        descriptors[relative] = {'assets':list(dict.fromkeys(parser.assets)), 'data':[]}
    result = subprocess.run(['node',str(root/'tools/build_search_index.mjs'),str(root)],input=json.dumps(texts),capture_output=True,text=True,encoding='utf-8',check=True)
    index = (result.stdout.strip()+'\n').encode('utf-8')
    entries = json.loads(result.stdout)['entries']
    for page, (dataset,folder,query,category) in CATALOGS.items():
        descriptor = descriptors[page]
        descriptor.update(dataset=dataset,imageFolder=folder,queryKey=query)
        descriptor['data'] = [dataset,f'images/{folder}/manifest.json']
        descriptor['details'] = []
        if dataset in (WEAPONS,ARMORS):
            descriptor['data'] += [PERKS,ALLOWLISTS]
            descriptor['details'] = [MONSTERS,DROPS]+([RESISTS] if dataset == WEAPONS else [])
        elif dataset == MONSTERS:
            descriptor['data'] += [ALLOWLISTS]
            descriptor['details'] = [WEAPONS,ARMORS,PERKS,RESISTS,DROPS]
        else: descriptor['details'] = RELATIONSHIPS
        public = {entry['title'] for entry in entries if entry['category'] == category}
        rows = [row for row in json.loads((root/dataset).read_text(encoding='utf-8')) if row.get('name') in public]
        def rank(row):
            fields = row.get('fields',{})
            if dataset in (WEAPONS,MONSTERS):
                speed = fields.get('attack_speed',0)
                return (fields.get('min_damage',0)+fields.get('max_damage',0))/2*1000/speed if speed else 0
            return fields.get('level',0) if dataset == ARMORS else 0
        rows.sort(key=(lambda row:row.get('name','')) if dataset not in (WEAPONS,ARMORS,MONSTERS) else rank, reverse=dataset in (WEAPONS,ARMORS,MONSTERS))
        images = json.loads((root/f'images/{folder}/manifest.json').read_text(encoding='utf-8'))
        by_name = {Path(image).stem.lower():image for image in images}
        descriptor['images'] = list(dict.fromkeys(by_name.get(f"{row['name']}-{row['id']}".lower()) or by_name.get(row['name'].lower()) for row in rows[:6]))
        descriptor['images'] = [image for image in descriptor['images'] if image]
    descriptors['pages/General/build-planner.html']['data'] = [WEAPONS,ARMORS,PERKS,ALLOWLISTS]
    descriptors['pages/General/quests.html']['data'] = ['pages/General/quests_data.json']
    descriptors['pages/systems/perks.html']['data'] = [PERKS,WEAPONS,ARMORS,MONSTERS,ALLOWLISTS]
    for page in ['pages/stats/level.html','pages/stats/skills.html']:
        descriptors[page]['data'] = ['data/player_tables.json']
    for page in ['pages/stats/strength.html','pages/stats/constitution.html','pages/stats/dexterity.html']:
        descriptors[page]['data'] = [WEAPONS,ALLOWLISTS]
    descriptors['pages/stats/resistances.html']['data'] = [MONSTERS,RESISTS,ALLOWLISTS]
    files = {'data/search-index.json':digest(index)}
    for folder in ('pages','data'):
        for path in sorted((root/folder).rglob('*.json')):
            relative = path.relative_to(root).as_posix()
            if relative in ('data/browser-release.json','data/search-index.json'): continue
            files[relative] = digest(path.read_text(encoding='utf-8').replace('\r\n','\n').encode('utf-8'))
    for path in sorted((root/'images').glob('*/manifest.json')):
        files[path.relative_to(root).as_posix()] = digest(path.read_text(encoding='utf-8').encode('utf-8'))
    manifest = json.dumps({'schema':1,'files':dict(sorted(files.items())),'pages':descriptors},separators=(',',':'))+'\n'
    outputs = {'data/search-index.json':index,'data/browser-release.json':manifest.encode('utf-8')}
    for n in (1,2):
        with Image.open(root/f'images/logo-{n}.png') as image:
            for size in (128,256):
                stream = io.BytesIO()
                image.resize((size,size),Image.Resampling.LANCZOS).save(stream,format='PNG',optimize=True)
                outputs[f'images/logo-{n}-{size}.png'] = stream.getvalue()
    return outputs

def main():
    parser=argparse.ArgumentParser(__doc__)
    parser.add_argument('--check',action='store_true')
    args=parser.parse_args()
    outputs=build()
    changed=[]
    for relative,data in outputs.items():
        path=ROOT/relative
        matches = path.exists() and path.read_bytes() == data
        if not matches and path.exists() and path.suffix == '.png':
            # PNG compression can differ across Pillow/zlib releases; pixels matter.
            with Image.open(path) as actual, Image.open(io.BytesIO(data)) as expected:
                matches = actual.size == expected.size and actual.convert('RGBA').tobytes() == expected.convert('RGBA').tobytes()
        if not matches:
            changed.append(relative)
            if not args.check: path.write_bytes(data)
    if args.check:
        if changed: raise SystemExit('Browser assets are stale; run python -m tools.browser_assets: '+', '.join(changed))
        print('Browser search index, content versions, and logos are current.')
    else:
        print('Built browser index, release manifest, and navigation logos.')

if __name__=='__main__': main()
