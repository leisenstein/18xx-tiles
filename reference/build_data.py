import re,json,collections
t=open('repo/lib/engine/config/tile.rb').read()
order=['YELLOW','GREEN','BROWN','GRAY','GREENBROWN','BROWNGRAY','BROWNSEPIA','NONE']
tiles=[]
for c,b in re.findall(r"(\w+) = \{(.*?)\}\.freeze",t,re.S):
    if c not in order: continue
    for m in re.finditer(r"^\s+'([^']+)' => '([^']*)'",b,re.M):
        tiles.append({'name':m.group(1),'color':c.lower(),'code':m.group(2)})
games=json.load(open('games.json'))
def norm(c): return ';'.join(sorted(p.strip() for p in c.split(';') if p.strip()))
for tl in tiles:
    tl['games']=[];tl['variants']=[]
    for g in games.values():
        e=g['tiles'].get(tl['name'])
        if not e: continue
        if not e['custom'] or norm(e['code'])==norm(tl['code']) and (not e['color'] or e['color']==tl['color']):
            tl['games'].append(g['title'])
        else:
            tl['variants'].append({'game':g['title'],'code':e['code'],'color':e['color']})
    tl['games']=sorted(set(tl['games']),key=str.lower)
json.dump(tiles,open('tiles.json','w'),indent=1)
print(len(tiles))
print(sum(1 for x in tiles if not x['games']), 'unused by any parsed game')
print(sum(1 for x in tiles if x['variants']),'with variants')
for x in tiles[:3]+[y for y in tiles if y['name'] in('45','46','57')]: print(x['name'],x['color'],len(x['games']),x['games'][:6],x['variants'][:2])
for x in tiles:
    codes={}
    for v in x['variants']: codes.setdefault((v['code'],v['color']),[]).append(v['game'])
    x['vgroups']=[{'code':k[0],'color':k[1],'games':sorted(set(g),key=str.lower)} for k,g in codes.items()]
json.dump(tiles,open('tiles.json','w'),indent=1)
print('variant groups',sum(len(x['vgroups']) for x in tiles))
