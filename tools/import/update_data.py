"""Refresh the seed data files from the tobymao/18xx repository (the code behind 18xx.games). DESIGN.md section 6.4.

What it does:
  1. Downloads only the files it needs (lib/engine/game/** and lib/engine/config/tile.rb) for one commit, into tools/import/.cache/18xx (gitignored).
  2. Reads every game's tile manifest (number, count, and custom definitions) and the generic tile list.
  3. Writes games.json, tiles.json, and source.json (which commit they came from) to api/Data/Seeding/SeedFiles/.
  4. Prints what changed compared with the files that were there before.

The API applies new seed files at its next start (DataImporter): it adds new games, tiles, and links, and fills empty counts, but never overwrites edits
made in the app. See the import report on the Admin page.

Usage, from the repo root (-I keeps Python from loading anything from the downloaded folder):
  python -I tools/import/update_data.py                  latest commit on the default branch
  python -I tools/import/update_data.py --ref 46a592e    a specific commit, branch, or tag (full or short hash once fetched)
  python -I tools/import/update_data.py --no-fetch       re-parse the commit already in the cache
"""

import argparse
import datetime
import glob
import json
import os
import re
import subprocess
import sys

REPO_URL = 'https://github.com/tobymao/18xx.git'
SPARSE_PATHS = ['lib/engine/game/', 'lib/engine/config/tile.rb', 'LICENSE']

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, '.cache', '18xx')
DEFAULT_OUT = os.path.join(HERE, '..', '..', 'api', 'Data', 'Seeding', 'SeedFiles')

# Domain/TileCounts.cs: 999 means unlimited; real counts are 1 to 100. Anything else (formulas, constants) is stored as unknown (null).
UNLIMITED = 999
MAX_COUNT = 100

# Generic tile colors in config/tile.rb, in the order the tiles are listed.
GENERIC_COLORS = ['YELLOW', 'GREEN', 'BROWN', 'GRAY', 'GREENBROWN', 'BROWNGRAY', 'BROWNSEPIA', 'NONE']


# ---- 1. Download ------------------------------------------------------------------------------------------------------------------------------------

def git(*args, check=True):
    result = subprocess.run(['git', *args], cwd=CACHE, capture_output=True, text=True)
    if check and result.returncode != 0:
        sys.exit(f'git {" ".join(args)} failed:\n{result.stderr.strip()}')
    return result.stdout.strip()


def fetch(ref):
    """Shallow, sparse fetch of one commit: only the game folders and the generic tile list, about 14 MB."""
    if not os.path.isdir(os.path.join(CACHE, '.git')):
        os.makedirs(CACHE, exist_ok=True)
        git('init', '-q')
        git('remote', 'add', 'origin', REPO_URL)
        git('sparse-checkout', 'set', '--no-cone', *SPARSE_PATHS)
    print(f'Fetching {ref} from {REPO_URL} ...')
    git('fetch', '-q', '--depth', '1', '--filter=blob:none', 'origin', ref)
    git('checkout', '-q', '--force', '--detach', 'FETCH_HEAD')


def current_commit():
    """The checked-out commit's hash and when it was committed, in UTC."""
    committed = datetime.datetime.fromisoformat(git('log', '-1', '--format=%cI')).astimezone(datetime.timezone.utc)
    return git('rev-parse', 'HEAD'), committed.isoformat().replace('+00:00', 'Z')


# ---- 2. Parse ---------------------------------------------------------------------------------------------------------------------------------------
# A small reader for the parts of Ruby the game files use for tile manifests. It is not a Ruby parser: it finds "TILES = { ... }" blocks and reads
# their string keys and simple values.

def read(path):
    with open(path, encoding='utf-8') as f:
        return f.read()


def strip_comments(source):
    """Remove Ruby # comments that are not inside quotes."""
    out = []
    for line in source.split('\n'):
        quote = None
        kept = ''
        for i, ch in enumerate(line):
            if quote:
                kept += ch
                if ch == '\\':
                    continue
                if ch == quote and line[i - 1] != '\\':
                    quote = None
            elif ch in '\'"':
                quote = ch
                kept += ch
            elif ch == '#':
                break
            else:
                kept += ch
        out.append(kept)
    return '\n'.join(out)


def match_brace(s, i):
    """Index of the } that closes the { at s[i], skipping quoted text; -1 if none."""
    depth = 0
    quote = None
    j = i
    while j < len(s):
        ch = s[j]
        if quote:
            if ch == '\\':
                j += 2
                continue
            if ch == quote:
                quote = None
        elif ch in '\'"':
            quote = ch
        elif ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                return j
        j += 1
    return -1


def split_top(body):
    """Split a hash body on commas that are not nested inside brackets or quotes."""
    parts = []
    depth = 0
    quote = None
    current = ''
    i = 0
    while i < len(body):
        ch = body[i]
        if quote:
            current += ch
            if ch == '\\':
                current += body[i + 1]
                i += 2
                continue
            if ch == quote:
                quote = None
        elif ch in '\'"':
            quote = ch
            current += ch
        elif ch in '{[(':
            depth += 1
            current += ch
        elif ch in '}])':
            depth -= 1
            current += ch
        elif ch == ',' and depth == 0:
            parts.append(current)
            current = ''
        else:
            current += ch
        i += 1
    if current.strip():
        parts.append(current)
    return [p.strip() for p in parts if p.strip()]


def string_literal(value):
    """Join the quoted pieces of a Ruby string expression: 'a;' \\ 'b' -> a;b."""
    return ''.join(a or b for a, b in re.findall(r"'((?:[^'\\]|\\.)*)'|\"((?:[^\"\\]|\\.)*)\"", value))


def parse_count(value):
    """A manifest count: 4 -> 4; 'unlimited' or :unlimited -> 999; anything else (a constant or formula) -> None (unknown)."""
    value = value.strip()
    if re.fullmatch(r'\d+', value):
        count = int(value)
        return count if 1 <= count <= MAX_COUNT else None
    if value in ("'unlimited'", '"unlimited"', ':unlimited'):
        return UNLIMITED
    return None


def parse_tile_hash(body):
    """Read one TILES hash: '57' => 4, '58' => 'unlimited', 'X1' => { 'count' => 1, 'color' => 'green', 'code' => '...' }."""
    tiles = {}
    for part in split_top(body):
        m = re.match(r"""['"]([^'"]+)['"]\s*=>\s*(.*)$""", part, re.S)
        if not m:
            continue
        number, value = m.group(1), m.group(2).strip()
        if value.startswith('{'):
            fields = {}
            for field in split_top(value[1:match_brace(value, 0)]):
                mm = re.match(r"""['"]?(\w+)['"]?\s*(?:=>|:)\s*(.*)$""", field, re.S)
                if mm:
                    fields[mm.group(1)] = mm.group(2).strip()
            if 'code' in fields or 'count' in fields:
                tiles[number] = {
                    'custom': 'code' in fields,
                    'code': string_literal(fields['code']) if 'code' in fields else None,
                    'color': string_literal(fields.get('color', '')) or None,
                    'count': parse_count(fields['count']) if 'count' in fields else None,
                }
        elif re.match(r"^(\d+|'unlimited'|:unlimited|\w+)$", value):
            tiles[number] = {'custom': False, 'count': parse_count(value)}
    return tiles


def parse_games(game_root):
    """Every game folder (g_*) with a meta.rb: title, dev stage, folder name, and its tile manifest. Keyed by Ruby module name, e.g. G1830."""
    games = {}
    # Sorted by folder name, the same on every operating system (sorting full paths puts g_18_los_angeles1 first on Windows, because of the backslash).
    for meta in sorted(glob.glob(os.path.join(game_root, 'g_*', 'meta.rb')), key=lambda p: os.path.basename(os.path.dirname(p))):
        folder = os.path.dirname(meta)
        text = read(meta)
        module = [x for x in re.findall(r'module (G\w+)', text) if x != 'Game'][0]
        title = re.search(r"GAME_TITLE = '((?:[^'\\]|\\.)+)'", text)
        title = title.group(1).replace("\\'", "'") if title else module[1:]
        stage = re.search(r'DEV_STAGE = :(\w+)', text)
        stage = stage.group(1) if stage else '?'

        tiles = {}
        alias = None
        # Sorted so that when two files define the same tile number, the result does not depend on the file system.
        for path in sorted(glob.glob(os.path.join(folder, '*.rb'))):
            source = strip_comments(read(path))
            for m in re.finditer(r'(?:\b(\w*TILES)|\btiles)\s*=\s*\{', source):
                end = match_brace(source, m.end() - 1)
                for number, entry in parse_tile_hash(source[m.end():end]).items():
                    tiles.setdefault(number, entry)
            # Games that reuse another game's tiles: "TILES = G1830::Map::TILES" or "class Game < G1830::Game".
            m = re.search(r'\bTILES\s*=\s*(G\w+)::Map::TILES', source)
            if m:
                alias = m.group(1)
            m = re.search(r'class Game < (G\w+)::Game', source)
            if m and not alias:
                alias = m.group(1)
        games[module] = {'title': title, 'stage': stage, 'dir': os.path.basename(folder), 'tiles': tiles, 'alias': alias}

    # Games without their own manifest use their parent's. Repeat until nothing changes, so a chain (A uses B, B uses C) works in any order.
    changed = True
    while changed:
        changed = False
        for game in games.values():
            parent = games.get(game['alias'])
            if not game['tiles'] and parent and parent['tiles']:
                game['tiles'] = parent['tiles']
                game['aliased'] = True
                changed = True
    return games


def normalize(code):
    """Definitions match when their parts match in any order (DESIGN.md rule 6.3.7)."""
    return ';'.join(sorted(p.strip() for p in code.split(';') if p.strip()))


def parse_generic_tiles(tile_rb, games):
    """The generic numbered tiles from config/tile.rb, with which games use each one as is and which games have their own version."""
    text = read(tile_rb)
    tiles = []
    for color, body in re.findall(r'(\w+) = \{(.*?)\}\.freeze', text, re.S):
        if color not in GENERIC_COLORS:
            continue
        for m in re.finditer(r"^\s+'([^']+)' => '([^']*)'", body, re.M):
            tiles.append({'name': m.group(1), 'color': color.lower(), 'code': m.group(2)})

    for tile in tiles:
        users, variants = [], []
        for game in games.values():
            entry = game['tiles'].get(tile['name'])
            if not entry:
                continue
            same = not entry['custom'] or normalize(entry['code']) == normalize(tile['code']) and (not entry['color'] or entry['color'] == tile['color'])
            if same:
                users.append(game['title'])
            else:
                variants.append({'game': game['title'], 'code': entry['code'], 'color': entry['color']})
        tile['games'] = sorted(set(users), key=str.lower)
        tile['variants'] = variants
        groups = {}
        for v in variants:
            groups.setdefault((v['code'], v['color']), []).append(v['game'])
        tile['vgroups'] = [{'code': k[0], 'color': k[1], 'games': sorted(set(g), key=str.lower)} for k, g in groups.items()]
    return tiles


# ---- 3 and 4. Write and compare ---------------------------------------------------------------------------------------------------------------------

def load_json(path):
    return json.loads(read(path)) if os.path.exists(path) else None


def write_json(path, data):
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(data, f, indent=1)
        f.write('\n')


def summarize(old_games, new_games, old_tiles, new_tiles):
    """Print what the new files change, so you can decide whether to keep them before starting the API."""
    if old_games is None:
        print('No previous games.json to compare with.')
        return
    old_by_dir = {g['dir']: g for g in old_games.values()}
    new_by_dir = {g['dir']: g for g in new_games.values()}
    lines = []
    for d in sorted(new_by_dir.keys() - old_by_dir.keys()):
        lines.append(f'  + game {new_by_dir[d]["title"]} ({len(new_by_dir[d]["tiles"])} tiles)')
    for d in sorted(old_by_dir.keys() - new_by_dir.keys()):
        lines.append(f'  - game {old_by_dir[d]["title"]} (no longer upstream; the app keeps it)')
    counts = 0
    for d in sorted(old_by_dir.keys() & new_by_dir.keys()):
        old, new = old_by_dir[d], new_by_dir[d]
        if old['title'] != new['title']:
            lines.append(f'  ~ game {old["title"]} renamed to {new["title"]}')
        for number in sorted(new['tiles'].keys() - old['tiles'].keys()):
            lines.append(f'  + {new["title"]}: tile {number}')
        for number in sorted(old['tiles'].keys() - new['tiles'].keys()):
            lines.append(f'  - {new["title"]}: tile {number}')
        for number in sorted(old['tiles'].keys() & new['tiles'].keys()):
            a, b = old['tiles'][number], new['tiles'][number]
            if (a.get('code'), a.get('color')) != (b.get('code'), b.get('color')):
                lines.append(f'  ~ {new["title"]}: tile {number} definition or color changed')
            elif a.get('count') != b.get('count'):
                counts += 1
    old_generic = {t['name']: (t['color'], t['code']) for t in old_tiles or []}
    for t in new_tiles:
        if t['name'] not in old_generic:
            lines.append(f'  + generic tile {t["name"]}')
        elif old_generic[t['name']] != (t['color'], t['code']):
            lines.append(f'  ~ generic tile {t["name"]} changed')
    print('\n'.join(lines) if lines else 'No game, tile, or definition changes.')
    if counts:
        print(f'  {counts} tile counts changed or added.')


def main():
    parser = argparse.ArgumentParser(description='Refresh the seed data files from tobymao/18xx.')
    parser.add_argument('--ref', default='HEAD', help='commit, branch, or tag to fetch (default: latest on the default branch)')
    parser.add_argument('--no-fetch', action='store_true', help='use the commit already in tools/import/.cache/18xx')
    parser.add_argument('--out', default=DEFAULT_OUT, help='folder for games.json, tiles.json, and source.json (default: the API seed folder)')
    args = parser.parse_args()

    if not args.no_fetch:
        fetch(args.ref)
    elif not os.path.isdir(os.path.join(CACHE, 'lib')):
        sys.exit('Nothing in the cache yet; run without --no-fetch first.')
    commit, committed = current_commit()
    print(f'Parsing commit {commit} ({committed})')

    games = parse_games(os.path.join(CACHE, 'lib', 'engine', 'game'))
    tiles = parse_generic_tiles(os.path.join(CACHE, 'lib', 'engine', 'config', 'tile.rb'), games)
    entries = [e for g in games.values() for e in g['tiles'].values()]
    print(f'{len(games)} games ({sum(1 for g in games.values() if g["tiles"])} with tiles), {len(tiles)} generic tiles, {len(entries)} manifest entries, '
          f'{sum(1 for e in entries if e["count"] is not None)} with a count')

    out = os.path.abspath(args.out)
    os.makedirs(out, exist_ok=True)
    summarize(load_json(os.path.join(out, 'games.json')), games, load_json(os.path.join(out, 'tiles.json')), tiles)

    write_json(os.path.join(out, 'games.json'), games)
    write_json(os.path.join(out, 'tiles.json'), tiles)
    write_json(os.path.join(out, 'source.json'), {'repository': REPO_URL, 'commit': commit, 'committedUtc': committed})
    print(f'Wrote games.json, tiles.json, and source.json to {out}')
    print('Restart the API to apply them; the import report is on the Admin page.')


if __name__ == '__main__':
    main()
