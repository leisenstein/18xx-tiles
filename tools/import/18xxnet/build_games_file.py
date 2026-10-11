"""Build 18xxnet-games.json (and 18xxnet-source.json) from the reviewed 18xx.net diff, in exactly the format of the import's games.json.

The output is meant to be imported by the app's normal importer (api/Data/Seeding/DataImporter.cs) in place of games.json, with no change to
the importer. It is kept in git: 18xx.net is no longer updated and the file holds decisions made by hand, so nothing could regenerate it.

  18xxnet-games.json   same shape as games.json: an object keyed by an id, each game with title, dir (its Games.SourceKey), designer,
                       publisher, and tiles (number -> {custom, count} for generic tiles, or {custom, code, color, count} for other versions).
                       It holds only what 18xx.net adds:
                         - the new games, units, and variants (dir "18xxnet_<slug>"), with the tiles the database already has;
                         - existing games (their 18xx.games dir and current title) with only the links and empty publishers to add.
  18xxnet-source.json  same shape as source.json; its dataHash is new whenever the games file changes, so the importer applies it once.

How to import it (also in docs/RUNBOOK.md): copy 18xxnet-games.json over api/Data/Seeding/SeedFiles/games.json and 18xxnet-source.json over
source.json (tiles.json stays), rebuild and start the API, then put the normal files back with
"python -I tools/import/update_data.py --pinned --no-fetch". The import runs in merge mode, so it only adds and fills.

Steps this script takes:
  1. Entries in 18xxnet-diff.json whose "decision" is still null get one from RULES below (the choices agreed in review, 11 October 2026).
     A decision already set by hand is never changed: to change one, edit its "decision" in the diff and run this again.
  2. Entries marked "import" become games and tiles in the output. Tiles are matched to the database's by number and colour (preferring the
     generic version); a tile the database does not have, or has in several versions, is left out and reported.

Usage:  python -I tools/import/18xxnet/build_games_file.py [--db data/tiles.db]
The database is only read, to find tiles and current titles; nothing is written to it.
"""
import argparse
import hashlib
import json
import os
import re
import sqlite3
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
DIFF = os.path.join(HERE, '18xxnet-diff.json')
OUT_GAMES = os.path.join(HERE, '18xxnet-games.json')
OUT_SOURCE = os.path.join(HERE, '18xxnet-source.json')
MISSING = os.path.join(HERE, '18xxnet-missing-tiles.json')
DIR_PREFIX = '18xxnet_'                  # dir (Games.SourceKey) of games added from 18xx.net; 18xx.games games use g_...
COUNT_LIMIT = 100                        # the app's largest real count (Domain/TileCounts.MaxCount); 999 means unlimited

# The review decisions, as rules. Each returns "import", "skip", or None (not decided: left for later, not imported).
RULES = {
    'fillGameInfo': lambda c: 'import',                          # publisher or designer the database lacks
    'gameInfoDiffers': lambda c: 'skip',                         # 18xx.games values are more current
    'addGameTile': lambda c: 'import' if c['match'] == 'good' and 'tile' in c else 'skip',
    'fillCount': lambda c: 'skip',
    'updateCount': lambda c: 'skip',                             # database counts follow the current editions
    'countConflict': lambda c: 'skip',
    'newGame': lambda c: 'import' if c['tileCount'] > 0 else 'skip',   # every game, unit or variant with a tile list
    'newTile': lambda c: None,                                   # needs a hand-written definition; kept for later
    'colorConflict': lambda c: None,                             # information only
}


def read_db(db_path):
    c = sqlite3.connect(f'file:{db_path}?mode=ro', uri=True)
    tiles = {}
    for number, color, code, source in c.execute('SELECT Number, Color, DefinitionCode, Source FROM Tiles WHERE IsDeleted = 0'):
        tiles.setdefault(number, []).append({'number': number, 'color': color, 'definition': code, 'source': source})
    games = {key: {'title': title, 'designer': designer, 'publisher': publisher}
             for key, title, designer, publisher in c.execute('SELECT SourceKey, Title, Designer, Publisher FROM Games')}
    return tiles, games


def resolve(tiles, number, color):
    """The one database tile this 18xx.net tile is: same number and colour, preferring the generic version. None if none or unclear."""
    cands = [t for t in tiles.get(number, []) if t['color'] == color]
    generic = [t for t in cands if t['source'] == 'generic']
    pick = generic if len(generic) == 1 else cands
    return pick[0] if len(pick) == 1 else None


def count_of(text):
    """A manifest count as games.json stores it: '3' -> 3, '(1)' -> 1, anything else ('1?', '120') -> None (unknown)."""
    m = re.fullmatch(r'\(?(\d+)\)?', str(text).strip())
    return int(m.group(1)) if m and 1 <= int(m.group(1)) <= COUNT_LIMIT else None


def entry(tile, count):
    """A games.json tile entry: generic tiles by number only; other versions carry their definition, as games.json's custom tiles do."""
    if tile['source'] == 'generic':
        return {'custom': False, 'count': count}
    return {'custom': True, 'code': tile['definition'], 'color': tile['color'], 'count': count}


def slug(title):
    return re.sub(r'[^a-z0-9]+', '_', title.lower()).strip('_')


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--db', default=os.path.join(ROOT, 'data', 'tiles.db'))
    args = ap.parse_args()

    diff = json.load(open(DIFF, encoding='utf-8'))
    for c in diff['changes']:
        if c['decision'] is None:
            c['decision'] = RULES[c['type']](c)
    with open(DIFF, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(diff, f, indent=1, ensure_ascii=False)
        f.write('\n')

    tiles, db_games = read_db(args.db)
    chosen = [c for c in diff['changes'] if c['decision'] == 'import']
    unsupported = sorted({c['type'] for c in chosen} - {'fillGameInfo', 'addGameTile', 'newGame'})
    if unsupported:
        sys.exit(f'Marked "import" but this script cannot carry these yet: {", ".join(unsupported)}')

    out, missing = {}, {}

    # Existing games: their own dir and current title (a different title would rename the game), only the additions.
    def existing(key):
        if key not in out:
            g = db_games[key]
            out[key] = {'title': g['title'], 'designer': None, 'publisher': None, 'dir': key, 'tiles': {}}
        return out[key]

    for c in chosen:
        if c['type'] == 'fillGameInfo':
            existing(c['game'])[c['field']] = c['value']
        elif c['type'] == 'addGameTile':
            existing(c['game'])['tiles'][c['tile']['number']] = entry(c['tile'], count_of(c['count18xxnet']))

    # New games, units, and variants.
    titles = {g['title'] for g in db_games.values()}
    for c in sorted((c for c in chosen if c['type'] == 'newGame'), key=lambda c: c['title']):
        title = c['title']
        if title in titles:            # an 18xx.games game already has this title: name the 18xx.net one by its designer
            title = f'{title} ({c["designer"] or "18xx.net"})'
        if title in titles:
            sys.exit(f'No free title for the 18xx.net game {c["title"]}')
        titles.add(title)
        key = DIR_PREFIX + slug(c['title'])
        if key in out or key in db_games:
            sys.exit(f'Two 18xx.net games got the dir {key}')
        game = {'title': title, 'designer': c['designer'], 'publisher': c['publisher'], 'dir': key, 'tiles': {}}
        for t in c['tiles']:
            tile = resolve(tiles, t['number'], t['color']) if t['color'] else None
            if tile and t['number'] not in game['tiles']:
                game['tiles'][t['number']] = entry(tile, count_of(t['count']))
            elif not tile:
                missing.setdefault(title, []).append({'number': t['number'], 'color': t['color'], 'count': t['count']})
        out[key] = game

    games = dict(sorted(out.items()))
    text = json.dumps(games, indent=1, ensure_ascii=False) + '\n'
    with open(OUT_GAMES, 'w', encoding='utf-8', newline='\n') as f:
        f.write(text)
    source = {'repository': 'http://www.18xx.net/', 'commit': '18xx.net', 'committedUtc': None,
              'dataHash': hashlib.sha256(text.encode('utf-8')).hexdigest()}
    with open(OUT_SOURCE, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(source, f, indent=1)
        f.write('\n')
    with open(MISSING, 'w', encoding='utf-8', newline='\n') as f:
        json.dump({'note': 'Tiles 18xx.net lists for the new games that the database does not have (or has in several versions); '
                           'not in 18xxnet-games.json.', 'games': missing}, f, indent=1, ensure_ascii=False)
        f.write('\n')

    decisions = {}
    for c in diff['changes']:
        decisions.setdefault(c['type'], {}).setdefault(str(c['decision']), 0)
        decisions[c['type']][str(c['decision'])] += 1
    print(json.dumps(decisions))
    new = [g for k, g in games.items() if k.startswith(DIR_PREFIX)]
    old = [g for k, g in games.items() if not k.startswith(DIR_PREFIX)]
    print(f'{os.path.relpath(OUT_GAMES, ROOT)}: {len(new)} new games with {sum(len(g["tiles"]) for g in new)} tiles; '
          f'{len(old)} existing games with {sum(len(g["tiles"]) for g in old)} added tiles and '
          f'{sum(1 for g in old for f in ("designer", "publisher") if g[f])} filled details. '
          f'{sum(len(v) for v in missing.values())} tiles not in the database are listed in {os.path.basename(MISSING)}.')


if __name__ == '__main__':
    main()
