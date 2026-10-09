import re, os, json, glob, collections
ROOT='repo/lib/engine/game'
def strip_comments(s):
    out=[];
    for line in s.split('\n'):
        # remove # comments not inside quotes (simple)
        q=None;res=''
        for i,ch in enumerate(line):
            if q:
                res+=ch
                if ch=='\\' : continue
                if ch==q and line[i-1]!='\\': q=None
            else:
                if ch in "'\"": q=ch; res+=ch
                elif ch=='#': break
                else: res+=ch
        out.append(res)
    return '\n'.join(out)
def match_brace(s,i):
    d=0;q=None;j=i
    while j<len(s):
        ch=s[j]
        if q:
            if ch=='\\': j+=2; continue
            if ch==q: q=None
        elif ch in "'\"": q=ch
        elif ch=='{': d+=1
        elif ch=='}':
            d-=1
            if d==0: return j
        j+=1
    return -1
def split_top(body):
    parts=[];d=0;q=None;cur=''
    i=0
    while i<len(body):
        ch=body[i]
        if q:
            cur+=ch
            if ch=='\\': cur+=body[i+1]; i+=2; continue
            if ch==q: q=None
        elif ch in "'\"": q=ch; cur+=ch
        elif ch in '{[(': d+=1; cur+=ch
        elif ch in '}])': d-=1; cur+=ch
        elif ch==',' and d==0: parts.append(cur); cur=''
        else: cur+=ch
        i+=1
    if cur.strip(): parts.append(cur)
    return [p.strip() for p in parts if p.strip()]
def strlit(v):
    return ''.join(m[1] or m[2] for m in re.findall(r"'((?:[^'\\]|\\.)*)'|\"((?:[^\"\\]|\\.)*)\"",v)) if False else ''.join(a or b for a,b in re.findall(r"'((?:[^'\\]|\\.)*)'|\"((?:[^\"\\]|\\.)*)\"",v))
def parse_hash(body):
    res={}
    for p in split_top(body):
        m=re.match(r"""['"]([^'"]+)['"]\s*=>\s*(.*)$""",p,re.S)
        if not m: continue
        k,v=m.group(1),m.group(2).strip()
        if v.startswith('{'):
            sub={}
            for q in split_top(v[1:match_brace(v,0)]):
                mm=re.match(r"""['"]?(\w+)['"]?\s*(?:=>|:)\s*(.*)$""",q,re.S)
                if mm: sub[mm.group(1)]=mm.group(2).strip()
            if 'code' in sub or 'count' in sub:
                res[k]={'custom':'code' in sub,'code':strlit(sub['code']) if 'code' in sub else None,
                        'color':strlit(sub.get('color','')) or None}
        elif re.match(r"^(\d+|'unlimited'|:unlimited|\w+)$",v):
            res[k]={'custom':False}
    return res
games={}
for meta in sorted(glob.glob(ROOT+'/g_*/meta.rb')):
    d=os.path.dirname(meta); t=open(meta).read()
    mod=re.findall(r"module (G\w+)",t); mod=[x for x in mod if x!="Game"][0]
    title=re.search(r"GAME_TITLE = '((?:[^'\\]|\\.)+)'",t)
    title=title.group(1).replace("\\'","'") if title else mod[1:]
    stage=re.search(r"DEV_STAGE = :(\w+)",t); stage=stage.group(1) if stage else '?'
    tiles={};alias=None
    for f in glob.glob(d+'/*.rb'):
        s=strip_comments(open(f).read())
        for m in re.finditer(r"(?:\b(\w*TILES)|\btiles)\s*=\s*\{",s):
            e=match_brace(s,m.end()-1)
            for k,v in parse_hash(s[m.end():e]).items(): tiles.setdefault(k,v)
        m=re.search(r"\bTILES\s*=\s*(G\w+)::Map::TILES",s)
        if m: alias=m.group(1)
        m=re.search(r"class Game < (G\w+)::Game",s)
        if m and not alias: alias=m.group(1)
    games[mod]={'title':title,'stage':stage,'dir':os.path.basename(d),'tiles':tiles,'alias':alias}
for g in games.values():
    if not g['tiles'] and g['alias'] and g['alias'] in games: g['tiles']=games[g['alias']]['tiles']; g['aliased']=True
json.dump(games,open('games.json','w'),indent=1)
print(len(games), sum(1 for g in games.values() if g['tiles']))
print([ (g['title'],g['stage']) for g in games.values() if not g['tiles']])
print(collections.Counter(g['stage'] for g in games.values()))
