"""Compare 18xx.net (games and the Tile Encyclopaedia) with the app's database and write a reviewable diff.

What it reads from 18xx.net (once; pages are cached in tools/import/.cache/18xxnet, one request at a time with a pause between them):
  - The home page's game list, and each game's page: designer, publisher ("Produced by"), status, release date, location.
  - Each game's tile manifest (tiles/<game>.htm): one inventory per edition, unit or variant, giving every tile's colour and box count.
  - The Tile Reference List (tiles/list.htm): every tile number, plus the notes on tiles that carry two numbers.
  - The Tile Finder pages (tiles/f*.htm): the colour of tiles that are in no manifest.
  - The detail page (tiles/e*.htm) of each tile the database does not have: original game, revenue, city slots.

It reads the database read-only (data/tiles.db by default) and writes two files next to this script:
  18xxnet-diff.json  every proposed change, each with "decision": null. Review it, set "import" or "skip", and an import script applies
                     only the entries marked "import".
  18xxnet-diff.md    the same, summarised for reading.

Why the diff cannot simply be imported as is:
  18xx.net gives tile numbers, colours and counts, but not track layouts. A tile the database does not have needs a definition (the
  tobymao/18xx tile code) before it can be added, so "newTile" entries carry "definition": null until someone fills it in. Links, counts
  and game details for things the database already has can be imported directly.

Games are matched by title, with the exceptions in GAME_OVERRIDES and NOT_SAME below (same-named games that are different designs, and
names that differ). Each matched inventory reports how many tiles both sides share, so a poor match stands out.

Data credit: 18xx.net (Blackwater Station) and its Tile Encyclopaedia, by Chris Lawson, John David Galt and contributors. Only factual
data (names, numbers, colours, counts, dates) is used, never the site's text or images.

Usage:  python tools/import/18xxnet/compare_18xxnet.py [--db data/tiles.db] [--offline]
"""
import argparse
import datetime
import html as html_mod
import json
import os
import re
import sqlite3
import sys
import time
import urllib.error
import urllib.request

SITE = 'http://www.18xx.net/'           # plain HTTP: the site's HTTPS certificate is for another name
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
CACHE = os.path.join(ROOT, 'tools', 'import', '.cache', '18xxnet')
DELAY = 0.5                              # seconds between requests: the site is a small volunteer one

# 18xx.net inventory (manifest table title) -> database game, when the titles alone do not match.
GAME_OVERRIDES = {
    '1825 Unit 1': 'g_1825',             # the database 1825 matches Unit 1; the other units and kits are separate inventories
    '1873': 'g_1873',                    # Harzbahn 1873
}
# Same title, different game: never matched, and said so in the summary so nobody adds the match later by mistake.
NOT_SAME = {
    '1847': '1847 (Pfalzbahnen) is not the database 1847 AE.',
    '1862': '18xx.net 1862 is an earlier, different design from the database 1862.',
    '18FR': '18xx.net 18FR is a different design from the database 18FR.',
}

COLORS = {'yellow': 'yellow', 'green': 'green', 'brown': 'brown', 'russet': 'brown', 'grey': 'gray', 'gray': 'gray',
          'red': 'red', 'blue': 'blue', 'purple': 'purple', 'white': 'white', 'orange': 'orange'}
FINDER_COLORS = {'1': 'yellow', '2': 'green', '3': 'brown', '4': 'gray'}
FINDER_KINDS = {'5': 'plain track', '6': 'small station', '7': 'city', '8': 'named', '9': 'special'}


# ---- fetching and HTML helpers ------------------------------------------------------------------------------------------------------

def fetch(path, offline):
    """The page at SITE + path, from the cache or downloaded into it. None if the site has no such page (remembered as an empty file)."""
    local = os.path.join(CACHE, *path.split('/'))
    if os.path.exists(local):
        data = open(local, 'rb').read()
        return data.decode('latin-1') if data else None
    if offline:
        return None
    os.makedirs(os.path.dirname(local), exist_ok=True)
    try:
        with urllib.request.urlopen(SITE + path, timeout=30) as r:
            data = r.read()
    except urllib.error.HTTPError as e:
        if e.code != 404:
            raise
        data = b''
    open(local, 'wb').write(data)
    time.sleep(DELAY)
    return data.decode('latin-1') if data else None


def clean(html):
    html = re.sub(r'<br\s*/?>', ' ', html, flags=re.I)
    text = html_mod.unescape(re.sub(r'<[^>]+>', '', html)).replace('\xa0', ' ')
    return re.sub(r'\s+', ' ', text).strip()


def grid(table):
    """A table's rows as lists of (tag, text), with colspan and rowspan expanded so column i means the same thing on every row."""
    out, carry = [], {}
    for row in re.split(r'<tr\b', table, flags=re.I)[1:]:
        row = row.split('</tr>')[0]
        line = []

        def fill():
            while len(line) in carry:
                col = len(line)
                cell, left = carry[col]
                line.append(cell)
                if left <= 1:
                    del carry[col]
                else:
                    carry[col] = (cell, left - 1)

        for tag, attrs, body in re.findall(r'<(th|td)\b([^>]*)>(.*?)(?=<t[hd]\b|$)', row, flags=re.I | re.S):
            fill()
            cs = int((re.search(r'colspan="?(\d+)', attrs) or [0, 1])[1])
            rs = int((re.search(r'rowspan="?(\d+)', attrs) or [0, 1])[1])
            cell = (tag.lower(), clean(body), id(body))      # id: tells a spanned cell from a neighbour with the same text
            for _ in range(cs):
                if rs > 1:
                    carry[len(line)] = (cell, rs - 1)
                line.append(cell)
        fill()
        out.append(line)
    return out


def norm(title):
    return re.sub(r'[^a-z0-9]', '', title.lower())


def number_from_page(page):
    """e057.htm -> '57', ea03.htm -> '1003', e_AM413.htm -> 'AM413'."""
    k = page[1:-4]
    if k.startswith('_'):
        return k[1:]
    if k.isdigit():
        return str(int(k))
    if len(k) == 3 and k[0] in 'abcdefgh' and k[1:].isdigit():
        return str((10 + 'abcdefgh'.index(k[0])) * 100 + int(k[1:]))
    return k


def page_for_number(n):
    if n.isdigit():
        i = int(n)
        return 'e%03d.htm' % i if i < 1000 else 'e%s%02d.htm' % ('abcdefgh'[i // 100 - 10], i % 100)
    return 'e_%s.htm' % n


def parse_count(text):
    """'3' -> (3, ''), '(1)' -> (1, 'in parentheses'), '1?' -> (1, 'uncertain'), 'unlimited' -> (999, '')."""
    if 'unl' in text.lower() or text.strip() in ('∞', 'inf'):
        return 999, ''
    m = re.search(r'\d+', text)
    n = int(m.group()) if m else None
    flag = 'in parentheses' if text.startswith('(') else 'uncertain' if '?' in text else '' if m else 'not a number'
    return n, flag


# ---- 18xx.net pages -----------------------------------------------------------------------------------------------------------------

def read_games(offline):
    """[{title, page, info{...}, manifest}] for every game on the home page."""
    home = fetch('index.htm', offline)
    if home is None:
        sys.exit('The 18xx.net home page is not available (run without --offline)')
    games = []
    for href, text in re.findall(r'<a[^>]+href="([^"/:]+/[^"/]+\.htm)"[^>]*>(.*?)</a>', home, re.I | re.S):
        folder = href.split('/')[0]
        if folder in ('forum', 'tiles', 'help') or any(g['page'] == href for g in games):
            continue
        s = fetch(href, offline)
        if s is None:
            continue
        info = {}
        for label, value in re.findall(r'<tr[^>]*>\s*<th[^>]*>([^<]+)</th>\s*<td[^>]*>(.*?)</td>', s, re.I | re.S):
            info[clean(label)] = clean(value)
        m = re.search(r'href="\.\./tiles/([^"#]+\.htm)"', s)
        games.append({'title': clean(text), 'page': href, 'info': info, 'manifest': 'tiles/' + m.group(1) if m else None})
    return games


def read_manifest(path, offline):
    """[{name, tiles: [{number, color, count}]}]: one entry per 'Tile Inventory' table on a game's tile manifest page."""
    s = fetch(path, offline)
    if s is None:
        return []
    # Single-inventory pages have no name under "Tile Inventory"; the page title ("1824 Tile Manifest") gives it.
    t = re.search(r'<title>[^:]*:\s*(.*?)\s*Tile Manifest', s, re.I | re.S)
    page_name = clean(t.group(1)) if t else path.split('/')[-1][:-4]
    out = []
    for m in re.finditer(r'<table\b(?:(?!<table\b).)*?Tile Inventory</a>(.*?)</t[hr]>(.*?)</table>', s, re.S | re.I):
        colors, tiles = None, []
        for r in grid('<tr>' + m.group(2)):
            texts = [c[1] for c in r]
            if colors is None:
                if texts and all(t.split(' ')[0].lower() in COLORS for t in texts if t):
                    colors = [COLORS.get(t.split(' ')[0].lower()) for t in texts]
                continue
            for i in range(0, len(r) - 1, 2):
                a, b = r[i], r[i + 1]
                if a[0] == 'th' and a[1] and a[1] not in ('Tile', 'Total') and b[0] == 'td' and b[2] != a[2]:
                    tiles.append({'number': a[1], 'color': colors[i] if i < len(colors) else None, 'count': b[1]})
        out.append({'name': clean(m.group(1)) or page_name, 'manifest': path, 'tiles': tiles})
    return out


def read_reference_list(offline):
    """Every tile number on the Tile Reference List, and its 'Tile 38 = Tile 450' notes."""
    s = fetch('tiles/list.htm', offline)
    if s is None:
        sys.exit('tiles/list.htm is not available (run without --offline)')
    numbers = re.findall(r'<tr align=center><th>([^<]+)<', s)
    aliases = re.findall(r'Tile (\w+)</a></font></td>\s*<td[^>]*><font[^>]*>=</font></td>\s*<td[^>]*><font[^>]*><a[^>]*>Tile (\w+)<', s)
    manifests = sorted(set(re.findall(r'<a href="([^"#/]+\.htm)">', s)) - {'index.htm', 'menu.htm', 'list.htm', 'pgames.htm'})
    return [n.strip() for n in numbers], aliases, ['tiles/' + m for m in manifests if not re.match(r'[eft]\w*\.htm$', m) or m[0].isdigit()]


def read_finders(offline):
    """{number: {colors, kinds, metre, page}} from the Tile Finder pages."""
    found, todo, seen = {}, ['f1.htm'], set()
    while todo:
        name = todo.pop()
        if name in seen:
            continue
        seen.add(name)
        s = fetch('tiles/' + name, offline)
        if s is None:
            continue
        todo += [f for f in re.findall(r'href="(f[^"#/]*\.htm)"', s) if f not in seen]
        key = name[1:-4]
        body = s[s.find('<td width="564"'):]     # skip the menu column
        for page in re.findall(r'href="(e[^"#]+\.htm)"[^>]*>\s*<img', body):
            t = found.setdefault(number_from_page(page), {'colors': set(), 'kinds': set(), 'metre': False, 'page': page})
            if key[0] in FINDER_COLORS:
                t['colors'].add(FINDER_COLORS[key[0]])
            if key[0] in FINDER_KINDS:
                t['kinds'].add(FINDER_KINDS[key[0]])
            if key.endswith('m'):
                t['metre'] = True
    return found


def read_detail(page, offline):
    """Original game, revenue and slots from a tile's detail page."""
    s = fetch('tiles/' + page, offline)
    if s is None:
        return {}
    s = re.sub(r'\s+', ' ', s)
    left = s[s.find('<i><b>Tile'):s.find('INFORMATION')]
    out = {}
    m = re.search(r'Original Game:</b><br>(.*?)<p>', left)
    if m:
        out['originalGame'] = clean(m.group(1))
    for label, key in (('Revenue', 'revenue'), ('Slots', 'slots')):
        m = re.search(label + r':\s*([^<]+)<', left)
        if m:
            out[key] = m.group(1).strip()
    return out


# ---- database -----------------------------------------------------------------------------------------------------------------------

def read_db(path):
    c = sqlite3.connect(f'file:{path}?mode=ro', uri=True)
    tiles = {}
    for tid, number, color, code, source in c.execute(
            'SELECT Id, Number, Color, DefinitionCode, Source FROM Tiles WHERE IsDeleted = 0'):
        tiles.setdefault(number, []).append({'id': tid, 'number': number, 'color': color, 'definition': code, 'source': source})
    games = {key: {'title': title, 'designer': designer, 'publisher': publisher}
             for title, key, designer, publisher in c.execute('SELECT Title, SourceKey, Designer, Publisher FROM Games')}
    links = {}
    for key, number, tid, color, count in c.execute(
            'SELECT g.SourceKey, t.Number, t.Id, t.Color, gt.Count FROM GameTiles gt JOIN Games g ON g.Id = gt.GameId '
            'JOIN Tiles t ON t.Id = gt.TileId WHERE t.IsDeleted = 0'):
        links.setdefault(key, {}).setdefault(number, []).append({'tileId': tid, 'color': color, 'count': count})
    return tiles, games, links


def tile_ref(t):
    """How an import finds a tile: by its natural key, which survives a database rebuild (ids do not)."""
    return {'number': t['number'], 'color': t['color'], 'definition': t['definition'], 'source': t['source']}


def people(text):
    """'Francis Tresham (UK) / Bruce Shelley (US)' -> 'Francis Tresham, Bruce Shelley' (the database's comma-separated form)."""
    text = known(text)
    if not text:
        return None
    parts = [re.sub(r'\s*\([^)]*\)', '', p).strip() for p in re.split(r'\s*/\s*|\s+and\s+', text)]
    return ', '.join(p for p in parts if p) or None


def known(text):
    """None for the site's placeholders ('???', 'To be determined', 'Unlikely to be released', 'Unknown')."""
    if not text or re.search(r'\?\?\?|to be determined|unlikely to be|^unknown$|^not yet', text.strip(), re.I):
        return None
    return text


# ---- compare ------------------------------------------------------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--db', default=os.path.join(ROOT, 'data', 'tiles.db'))
    ap.add_argument('--offline', action='store_true', help='use only cached pages')
    args = ap.parse_args()

    db_tiles, db_games, db_links = read_db(args.db)
    by_title = {norm(g['title']): key for key, g in db_games.items()}

    games = read_games(args.offline)
    list_numbers, aliases, list_manifests = read_reference_list(args.offline)
    manifest_pages = sorted({g['manifest'] for g in games if g['manifest']} | set(list_manifests))
    inventories = [inv for p in manifest_pages for inv in read_manifest(p, args.offline)]
    for g in games:      # some game pages (1881, 18GM) do not link the manifest the Tile Encyclopaedia has for them
        if not g['manifest']:
            g['manifest'] = next((i['manifest'] for i in inventories if norm(i['name']) == norm(g['title'])), None)
    finders = read_finders(args.offline)
    alias_of = {}
    for a, b in aliases:
        alias_of[a], alias_of[b] = b, a

    for t, key in GAME_OVERRIDES.items():
        if key not in db_games:
            sys.exit(f'GAME_OVERRIDES: {key!r} is not in the database')

    def by_name(title):
        if title in GAME_OVERRIDES:
            return GAME_OVERRIDES[title]
        if title in NOT_SAME:
            return None
        return by_title.get(norm(title))

    def overlap(inv, key):
        theirs, ours = {t['number'] for t in inv['tiles']}, set(db_links.get(key, {}))
        return len(theirs & ours) / max(len(theirs), len(ours), 1)

    # Which database game each 18xx.net game page is. Many titles were reused for later, unrelated designs (18xx.net's 1858 and 1880
    # are not the 18xx.games ones), so a title match counts only if the designers share a name, or, when either side has no designer,
    # the game's tile inventory overlaps the database's by at least half.
    game_key, different = {}, {}
    for g in games:
        key = by_name(g['title'])
        if key and g['title'] not in GAME_OVERRIDES:
            main_inv = next((i for i in inventories if i['manifest'] == g['manifest'] and norm(i['name']) == norm(g['title'])), None)
            same = names_overlap(db_games[key]['designer'], people(g['info'].get('Designed by')))
            if same is False or (same is None and main_inv and overlap(main_inv, key) < 0.5):
                different[g['page']], key = key, None
        game_key[g['page']] = key

    # Which database game each inventory is: a game's main inventory follows its game; other units, kits and variants are new.
    owner = {g['manifest']: g for g in games if g['manifest']}
    inv_key = {}
    for inv in inventories:
        g = owner.get(inv['manifest'])
        if inv['name'] in GAME_OVERRIDES:
            inv_key[inv['name']] = GAME_OVERRIDES[inv['name']]
        elif g:
            inv_key[inv['name']] = game_key[g['page']] if norm(inv['name']) == norm(g['title']) else None
        else:
            inv_key[inv['name']] = by_name(inv['name'])     # manifests with no game page of their own (1829 Mainline, 1886, ...)

    def match(inv_name):
        return inv_key.get(inv_name)

    # Colour of each tile number: from the manifests (per game, most reliable), else the Tile Finder pages.
    colors_seen = {}
    for inv in inventories:
        for t in inv['tiles']:
            if t['color']:
                colors_seen.setdefault(t['number'], set()).add(t['color'])
    for n, f in finders.items():
        if n not in colors_seen and f['colors']:
            colors_seen[n] = set(f['colors'])

    changes, inventory_rows = [], []

    # 1. Game details for games both sides have.
    for g in games:
        key = game_key[g['page']]
        if not key:
            continue
        ours = db_games[key]
        for field, label in (('designer', 'Designed by'), ('publisher', 'Produced by')):
            theirs = people(g['info'].get(label))
            if not theirs:
                continue
            if not ours[field]:
                changes.append({'type': 'fillGameInfo', 'game': key, 'gameTitle': ours['title'], 'field': field, 'value': theirs,
                                'text18xxnet': g['info'].get(label)})
            elif norm(ours[field]) != norm(theirs):
                changes.append({'type': 'gameInfoDiffers', 'game': key, 'gameTitle': ours['title'], 'field': field, 'valueDb': ours[field],
                                'value': theirs, 'text18xxnet': g['info'].get(label),
                                'why': 'Information only unless marked "import", which replaces the database value.'})

    # 2. Tiles, links and counts for inventories that match a database game.
    for inv in inventories:
        key = match(inv['name'])
        theirs = {}
        for t in inv['tiles']:
            theirs.setdefault(t['number'], t)          # a number listed twice in one inventory keeps its first entry
        if not key:
            continue
        ours = db_links.get(key, {})
        shared = set(theirs) & set(ours)
        confidence = 'good' if len(shared) >= 0.8 * max(len(theirs), len(ours), 1) else 'check'
        inventory_rows.append({'inventory': inv['name'], 'game': key, 'title': db_games[key]['title'], 'confidence': confidence,
                               'tiles18xxnet': len(theirs), 'tilesDb': len(ours), 'shared': len(shared),
                               'onlyInDb': sorted(set(ours) - set(theirs), key=sort_key)})
        for n, t in theirs.items():
            count, flag = parse_count(t['count'])
            base = {'game': key, 'gameTitle': db_games[key]['title'], 'inventory': inv['name'], 'number': n, 'color18xxnet': t['color'],
                    'count18xxnet': t['count'], 'match': confidence}
            if n in ours:
                have = ours[n]
                if len(have) > 1:
                    if sum(h['count'] or 0 for h in have) != count:
                        changes.append({**base, 'type': 'countConflict', 'dbLinks': have,
                                        'why': 'The game links several tiles with this number; decide by hand.'})
                    continue
                h = have[0]
                ref = tile_ref(next(x for x in db_tiles[n] if x['id'] == h['tileId']))
                if h['count'] is None and count is not None:
                    changes.append({**base, 'type': 'fillCount', 'tile': ref, 'count': count, 'flag': flag})
                elif count is not None and h['count'] != count:
                    changes.append({**base, 'type': 'updateCount', 'tile': ref, 'countDb': h['count'], 'count': count, 'flag': flag})
            elif n in db_tiles:
                cands = [x for x in db_tiles[n] if not t['color'] or x['color'] == t['color']]
                entry = {**base, 'type': 'addGameTile', 'count': count, 'flag': flag}
                if not cands:
                    entry['candidates'] = [tile_ref(x) for x in db_tiles[n]]
                    entry['why'] = f'The database has tile {n} only in another colour; choose one ("tile") only if it is really the same tile.'
                else:
                    generic = [x for x in cands if x['source'] == 'generic']
                    pick = generic if len(generic) == 1 else cands
                    if len(pick) == 1:
                        entry['tile'] = tile_ref(pick[0])
                    else:
                        entry['candidates'] = [tile_ref(x) for x in pick]
                        entry['why'] = 'Several database tiles have this number and colour; choose one ("tile").'
                changes.append(entry)
            # else: no tile with that number at all; the newTile entry covers it.

    # 3. Games (and their inventories) the database does not have.
    for g in games:
        key = game_key[g['page']]
        invs = [inv for inv in inventories if g['manifest'] and inv['manifest'] == g['manifest']]
        if key:
            for inv in invs:           # other units, kits and variants of a game the database has
                if not match(inv['name']):
                    changes.append(new_game(inv['name'], None, inv, db_tiles, variant_of=db_games[key]['title']))
            continue
        note = NOT_SAME.get(g['title'], '')
        if g['page'] in different:
            other = db_games[different[g['page']]]
            note = f'Same title as the database game {other["title"]} ({other["designer"] or "designer unknown"}), but a different design.'
        main_inv = next((i for i in invs if norm(i['name']) == norm(g['title'])), invs[0] if invs else None)
        changes.append(new_game(g['title'], g, main_inv, db_tiles, note=note))
        for inv in invs:
            if inv is not main_inv:
                changes.append(new_game(inv['name'], None, inv, db_tiles, variant_of=g['title']))
    listed = {g['manifest'] for g in games}
    for inv in inventories:                  # manifests linked only from the Tile Encyclopaedia (no game page)
        if inv['manifest'] not in listed and not match(inv['name']):
            changes.append(new_game(inv['name'], None, inv, db_tiles))

    # 4. Tile numbers the database does not have at all.
    in_manifests = {}
    for inv in inventories:
        for t in inv['tiles']:
            in_manifests.setdefault(t['number'], {})[inv['name']] = t['count']
    numbers = sorted(set(list_numbers) | set(finders) | set(in_manifests), key=sort_key)
    for n in numbers:
        if n in db_tiles:
            continue
        f = finders.get(n, {})
        page = f.get('page') or page_for_number(n)
        detail = read_detail(page, args.offline)
        cs = sorted(colors_seen.get(n, []))
        entry = {'type': 'newTile', 'number': n, 'color': cs[0] if len(cs) == 1 else None, 'colorsListed': cs,
                 'kinds': sorted(f.get('kinds', [])), 'metreGauge': f.get('metre', False),
                 'originalGame': detail.get('originalGame'), 'revenue': detail.get('revenue'), 'slots': detail.get('slots'),
                 'inventories': in_manifests.get(n, {}),
                 'gamesInDb': sorted({match(i) for i in in_manifests.get(n, {}) if match(i)}),
                 'url': SITE + 'tiles/' + page, 'definition': None}
        if n in alias_of and alias_of[n] in db_tiles:
            entry['sameTileAs'] = alias_of[n]
            entry['why'] = f'18xx.net says tile {n} is the same tile as {alias_of[n]}, which the database has.'
        changes.append(entry)

    # 5. Same number, different colour: usually two different tiles sharing a number, sometimes a mistake on either side.
    for n in numbers:
        want = colors_seen.get(n, set())
        if n in db_tiles and want and not want & {t['color'] for t in db_tiles[n]}:
            changes.append({'type': 'colorConflict', 'number': n, 'colors18xxnet': sorted(want),
                            'colorsDb': sorted({t['color'] for t in db_tiles[n]}),
                            'url': SITE + 'tiles/' + (finders.get(n, {}).get('page') or page_for_number(n)),
                            'why': 'Information only: check whether these are different tiles that share a number.'})

    order = ['fillGameInfo', 'gameInfoDiffers', 'addGameTile', 'fillCount', 'updateCount', 'countConflict', 'newGame', 'newTile',
             'colorConflict']
    changes.sort(key=lambda c: order.index(c['type']))
    # Ids are built from what the entry is about, so they stay the same when the comparison is run again, and decisions already made in
    # the existing diff file are kept.
    out_path = os.path.join(HERE, '18xxnet-diff.json')
    decided = {}
    if os.path.exists(out_path):
        decided = {c['id']: c.get('decision') for c in json.load(open(out_path, encoding='utf-8'))['changes']}
    changes = [{'id': change_id(c), 'decision': decided.get(change_id(c)), **c} for c in changes]
    if len({c['id'] for c in changes}) != len(changes):
        sys.exit('Two diff entries got the same id; make change_id more specific')

    counts = {t: sum(1 for c in changes if c['type'] == t) for t in order}
    doc = {
        'format': '18xx-tiles-diff/1',
        'source': {'name': '18xx.net (Blackwater Station) and its Tile Encyclopaedia', 'url': SITE,
                   'credit': 'Chris Lawson, John David Galt and contributors', 'siteLastUpdated': '2007 to 2009',
                   'fetchedUtc': datetime.datetime.now(datetime.UTC).strftime('%Y-%m-%dT%H:%M:%SZ')},
        'database': {'file': os.path.relpath(args.db, ROOT).replace('\\', '/'), 'tiles': sum(len(v) for v in db_tiles.values()),
                     'tileNumbers': len(db_tiles), 'games': len(db_games)},
        'compared': {'games18xxnet': len(games), 'inventories18xxnet': len(inventories), 'tileNumbers18xxnet': len(numbers),
                     'inventoriesMatched': len(inventory_rows)},
        'howToReview': [
            'Set "decision" to "import" or "skip" on each entry; null means not decided yet. An import script applies only "import".',
            'fillGameInfo: the database has no designer or publisher for the game; "value" would be stored.',
            'gameInfoDiffers: both sides have a value and they differ. Information only, unless marked "import" (replaces the database value).',
            'addGameTile: link an existing database tile to the game with the 18xx.net count. If "candidates" is present, copy one into "tile".',
            'fillCount / updateCount: set the box count of an existing link. Counts in parentheses are flagged; the site does not say what they mean.',
            'countConflict: the game links several tiles with this number; decide by hand.',
            'newGame: a game, unit or variant the database lacks. Check "title" (and designer, publisher); its tiles are linked only if they exist.',
            'newTile: a tile number the database lacks. 18xx.net has no track layout, so "definition" (tobymao tile code) must be filled in.',
            'colorConflict: information only.',
        ],
        'summary': counts,
        'inventories': inventory_rows,
        'changes': changes,
    }
    with open(out_path, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(doc, f, indent=1, ensure_ascii=False)
        f.write('\n')
    with open(os.path.join(HERE, '18xxnet-diff.md'), 'w', encoding='utf-8', newline='\n') as f:
        f.write(markdown(doc))
    print(json.dumps(counts))


def change_id(c):
    """'addGameTile:g_1844:18', 'newGame:1853 v2', 'newTile:GA451', ..."""
    t = c['type']
    if t in ('fillGameInfo', 'gameInfoDiffers'):
        return f'{t}:{c["game"]}:{c["field"]}'
    if t in ('addGameTile', 'fillCount', 'updateCount', 'countConflict'):
        return f'{t}:{c["game"]}:{c["number"]}'
    if t == 'newGame':
        return f'{t}:{c["title"]}'
    return f'{t}:{c["number"]}'


def sort_key(n):
    return (not n.isdigit(), int(n) if n.isdigit() else 0, n)


def names_overlap(a, b):
    """True if two designer lists share a name word ('Tom Lehmann' and 'Thomas Lehmann'), False if not, None if either is missing."""
    if not a or not b:
        return None
    words = lambda x: set(re.findall(r'[^\W\d_]{3,}', x.lower())) - {'and', 'the', 'games', 'von', 'van', 'der'}
    return bool(words(a) & words(b))


def new_game(title, page, inv, db_tiles, variant_of=None, note=None):
    info = page['info'] if page else {}
    tiles = inv['tiles'] if inv else []
    return {'type': 'newGame', 'title': title, 'variantOf': variant_of,
            'designer': people(info.get('Designed by')), 'publisher': people(info.get('Produced by')),
            'status': known(info.get('Status')), 'released': known(info.get('Release Date')), 'location': known(info.get('Location')),
            'page': SITE + page['page'] if page else None, 'manifest': SITE + inv['manifest'] if inv else None,
            'note': note if note is not None else NOT_SAME.get(title, ''), 'tileCount': len(tiles),
            'tilesInDb': sum(1 for t in tiles if t['number'] in db_tiles), 'tiles': tiles}


# ---- summary -----------------------------------------------------------------------------------------------------------------------

def markdown(doc):
    ch = doc['changes']

    def by(t):
        return [c for c in ch if c['type'] == t]

    def cell(x):
        return str(x if x not in (None, '') else '-').replace('|', '/')

    out = ['# 18xx.net comparison', '',
           f'Source: [{doc["source"]["name"]}]({doc["source"]["url"]}) ({doc["source"]["credit"]}), fetched {doc["source"]["fetchedUtc"]}. '
           f'Compared with `{doc["database"]["file"]}`: {doc["database"]["tiles"]} tiles ({doc["database"]["tileNumbers"]} numbers), '
           f'{doc["database"]["games"]} games. 18xx.net: {doc["compared"]["games18xxnet"]} games, '
           f'{doc["compared"]["inventories18xxnet"]} tile inventories, {doc["compared"]["tileNumbers18xxnet"]} tile numbers.', '',
           'Generated by `tools/import/18xxnet/compare_18xxnet.py`. Decisions are made in `18xxnet-diff.json`; this file is only a summary.', '',
           '## Summary', '', '| Type | Entries | Meaning |', '|---|---:|---|']
    meaning = {'fillGameInfo': 'designer or publisher missing in the database', 'gameInfoDiffers': 'designer or publisher differs (information)',
               'addGameTile': 'existing tile, not linked to a game that uses it', 'fillCount': 'linked, count unknown in the database',
               'updateCount': 'linked, counts differ', 'countConflict': 'several tiles with the number in one game',
               'newGame': 'game, unit or variant not in the database', 'newTile': 'tile number not in the database (needs a definition)',
               'colorConflict': 'same number, different colour (information)'}
    for t, n in doc['summary'].items():
        out.append(f'| {t} | {n} | {meaning[t]} |')

    out += ['', '## Inventories matched to database games', '',
            '| 18xx.net inventory | Database game | Match | 18xx.net tiles | Database tiles | Shared | Only in database |', '|---|---|---|---:|---:|---:|---|']
    for g in doc['inventories']:
        out.append(f'| {g["inventory"]} | {g["title"]} | {g["confidence"]} | {g["tiles18xxnet"]} | {g["tilesDb"]} | {g["shared"]} | '
                   f'{", ".join(g["onlyInDb"]) or "-"} |')
    if NOT_SAME:
        out += ['', 'Not matched on purpose: ' + ' '.join(NOT_SAME.values())]

    info = by('fillGameInfo') + by('gameInfoDiffers')
    if info:
        out += ['', f'## Game details ({len(info)})', '', '| Id | Game | Field | Database | 18xx.net |', '|---|---|---|---|---|']
        for c in info:
            out.append(f'| {c["id"]} | {c["gameTitle"]} | {c["field"]} | {cell(c.get("valueDb"))} | {cell(c["value"])} |')

    def tile_text(c):
        if 'tile' in c:
            return f'{c["tile"]["number"]} ({c["tile"]["color"]}, {c["tile"]["source"]})'
        return f'{c["number"]} ({c["color18xxnet"]}): choose from ' + ', '.join(f'{t["color"]}/{t["source"]}' for t in c['candidates'])

    for t, cols, row in (
            ('addGameTile', ['Tile', 'Count', 'Match'], lambda c: [tile_text(c), c['count18xxnet'], c['match']]),
            ('fillCount', ['Tile', 'Count'], lambda c: [tile_text(c), c['count18xxnet']]),
            ('updateCount', ['Tile', 'Database', '18xx.net'], lambda c: [tile_text(c), c['countDb'], c['count18xxnet']]),
            ('countConflict', ['Number', 'Database', '18xx.net'],
             lambda c: [c['number'], ' + '.join(f'{h["count"]} ({h["color"]})' for h in c['dbLinks']), c['count18xxnet']])):
        items = by(t)
        if items:
            out += ['', f'## {t} ({len(items)})', '', '| Id | Game | ' + ' | '.join(cols) + ' |', '|---|---|' + '---|' * len(cols)]
            out += [f'| {c["id"]} | {c["gameTitle"]} | ' + ' | '.join(cell(x) for x in row(c)) + ' |' for c in items]

    items = by('newGame')
    out += ['', f'## newGame ({len(items)})', '', '| Id | Title | Variant of | Designer | Publisher | Released | Status | Tiles | In database | Note |',
            '|---|---|---|---|---|---|---|---:|---:|---|']
    for c in items:
        out.append(f'| {c["id"]} | {c["title"]} | {cell(c["variantOf"])} | {cell(c["designer"])} | {cell(c["publisher"])} | '
                   f'{cell(c["released"])} | {cell(c["status"])} | {c["tileCount"]} | {c["tilesInDb"]} | {cell(c["note"])} |')

    items = by('newTile')
    out += ['', f'## newTile ({len(items)})', '',
            'Grouped by the game 18xx.net says introduced the tile. Each needs a track definition before it can be imported.', '',
            '| Original game | Tiles | Yellow | Green | Brown | Gray | Other or unknown colour |', '|---|---:|---|---|---|---|---|']
    groups = {}
    for c in items:
        groups.setdefault(c['originalGame'] or 'unknown', []).append(c)
    for g in sorted(groups, key=lambda g: (-len(groups[g]), g)):
        cs = groups[g]

        def col(k):
            return ', '.join(c['number'] for c in cs if c['color'] == k) or '-'

        other = ', '.join(c['number'] for c in cs if c['color'] not in ('yellow', 'green', 'brown', 'gray')) or '-'
        out.append(f'| {g} | {len(cs)} | {col("yellow")} | {col("green")} | {col("brown")} | {col("gray")} | {other} |')
    same = [c for c in items if c.get('sameTileAs')]
    if same:
        out += ['', 'Same tile under another number (per 18xx.net): ' + ', '.join(f'{c["number"]} = {c["sameTileAs"]}' for c in same) + '.']

    items = by('colorConflict')
    if items:
        out += ['', f'## colorConflict ({len(items)})', '', '| Number | 18xx.net | Database |', '|---|---|---|']
        out += [f'| [{c["number"]}]({c["url"]}) | {", ".join(c["colors18xxnet"])} | {", ".join(c["colorsDb"])} |' for c in items]
    return '\n'.join(out) + '\n'


if __name__ == '__main__':
    main()
