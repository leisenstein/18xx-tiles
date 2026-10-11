"""Build the 18xx Tiles promo video: title cards (HTML -> Edge screenshot), slides (site screenshots + headline), neural voice-over
(edge-tts), captions (SRT), and the MP4 (ffmpeg: slow zoom per slide, fades)."""
import asyncio, os, re, subprocess, sys
import edge_tts
from PIL import Image, ImageDraw, ImageFilter, ImageFont

WORK = sys.argv[1]                 # scratch folder with shots/
OUT = sys.argv[2]                  # final output folder
FFMPEG = sys.argv[3]
FFPROBE = FFMPEG.replace('ffmpeg.exe', 'ffprobe.exe')
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
LOGO = open(r'C:\Users\LarryE\Desktop\18xx-tiles\branding\18xx-tiles-logo.svg', encoding='utf-8').read()
VOICE, RATE = 'en-US-AndrewNeural', '-6%'
W, H, FPS = 1920, 1080, 30
FONT = r'C:\Windows\Fonts\segoeuib.ttf'
FONT_REG = r'C:\Windows\Fonts\segoeui.ttf'

# (id, image, headline, narration). Narration spells 18xx the way players say it.
SLIDES = [
    ('s1', 'title', None,
     "If you play eighteen ex ex, you know the moment. Halfway through the game, somebody asks: is there another number fifty-seven left? "
     "Or, which green tile can this city upgrade to? Eighteen ex ex Tiles is built to answer that, fast."),
    ('s2', '01-home', '180 games in one place',
     "It covers a hundred and eighty games. That's the whole eighteen ex ex dot games collection, plus older games and variants from "
     "eighteen ex ex dot net. Every card shows the designer, the publisher, and how many tiles come in the box."),
    ('s3', '02-game-tiles', 'Every tile a game uses, with box counts',
     "Pick a game, and you get every tile it uses, drawn cleanly in yellow, green, brown, and gray, with how many of each you should have. "
     "You can filter by color, by cities or towns, or just type a tile number."),
    ('s4', '03-tile-detail', 'See every game that uses a tile',
     "Open any tile to see the full drawing, and every game that uses it. Tile fifty-seven, for example, turns up in a hundred and thirty-four games."),
    ('s5', '04-common', 'The tiles most games share',
     "The common tiles page shows the workhorses, the tiles shared by game after game. Handy when you're building a set, or replacing lost pieces."),
    ('s6', '05-print', 'Print number circles for a whole game',
     "Lost a tile number, or making your own copy of a game? Sign in, and you can print number circles for every tile in a game. "
     "Pick the size, and you get a PDF sheet that's ready for paper or round labels."),
    ('s7', '06-submit', 'Missing a tile? Submit it',
     "And if you spot a tile that's missing, you can submit it. Every suggestion gets reviewed before it goes live, so the reference stays right."),
    ('s8', 'end', None,
     "Eighteen ex ex Tiles. Every track tile, every game, one place. Bring it to your next game night."),
]

CARD = """<!doctype html><html><head><meta charset="utf-8"><style>
html,body{{margin:0;width:1920px;height:1080px;overflow:hidden;font-family:'Segoe UI',sans-serif}}
body{{background:radial-gradient(ellipse at 30% 20%,#2b2f3a 0%,#14161c 70%);color:#fff;display:flex;align-items:center;justify-content:center}}
.bar{{position:absolute;top:0;left:0;right:0;height:14px;display:flex}}.bar i{{flex:1}}
.wrap{{display:flex;align-items:center;gap:70px}} svg{{width:{logo}px;height:auto}}
h1{{font-size:{h1}px;margin:0;font-weight:700;letter-spacing:-2px}} p{{font-size:46px;margin:18px 0 0;color:#d6d0c4}}
small{{display:block;margin-top:40px;font-size:30px;color:#9aa0ab}}
</style></head><body><div class="bar"><i style="background:#f2c230"></i><i style="background:#5fae57"></i><i style="background:#b9814b"></i><i style="background:#9a9a9a"></i></div>
<div class="wrap">{svg}<div><h1>18xx Tiles</h1><p>{tag}</p>{extra}</div></div></body></html>"""


def card(name, tag, extra=''):
    html = os.path.normpath(os.path.join(WORK, name + '.html'))
    open(html, 'w', encoding='utf-8').write(CARD.format(svg=LOGO, tag=tag, extra=extra, logo=420, h1=150))
    png = os.path.normpath(os.path.join(WORK, 'shots', name + '.png'))
    r = subprocess.run([EDGE, '--headless=new', '--disable-gpu', '--hide-scrollbars', f'--user-data-dir={os.path.normpath(os.path.join(WORK, "edgecards-" + name))}',
                    f'--screenshot={png.replace(os.sep, "/")}', '--window-size=1920,1080', 'file:///' + html.replace('\\', '/')], capture_output=True, text=True)
    import time
    for _ in range(30):                   # Edge can return before the file is written
        if os.path.exists(png):
            break
        time.sleep(0.5)
    if not os.path.exists(png):
        sys.exit(f'Edge did not write {png}: {r.returncode} {r.stdout[-300:]} {r.stderr[-500:]}')
    return png


def slide(shot, headline, dst):
    """The screenshot, slightly inset on a dark backdrop, with a headline band at the bottom."""
    bg = Image.new('RGB', (W, H), (20, 22, 28))
    img = Image.open(os.path.join(WORK, 'shots', shot + '.png')).convert('RGB').resize((W, H), Image.LANCZOS)
    if headline is None:
        img.save(dst)
        return
    inset = img.resize((1760, 990), Image.LANCZOS)
    shadow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle((80, 40, 80 + 1760, 40 + 990), 24, fill=(0, 0, 0, 160))
    bg.paste(shadow.filter(ImageFilter.GaussianBlur(18)), (0, 12), shadow.filter(ImageFilter.GaussianBlur(18)))
    mask = Image.new('L', inset.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, *inset.size), 24, fill=255)
    bg.paste(inset, (80, 40), mask)
    d = ImageDraw.Draw(bg, 'RGBA')
    font = ImageFont.truetype(FONT, 64)
    tw = d.textlength(headline, font=font)
    x0, y0 = (W - tw) / 2 - 48, H - 210
    d.rounded_rectangle((x0, y0, x0 + tw + 96, y0 + 120), 28, fill=(20, 22, 28, 235))
    d.text((x0 + 48, y0 + 20), headline, font=font, fill=(255, 255, 255))
    for i, c in enumerate([(242, 194, 48), (95, 174, 87), (185, 129, 75), (154, 154, 154)]):   # tile-color underline
        seg = (tw + 96 - 56) / 4
        d.rectangle((x0 + 28 + i * seg, y0 + 104, x0 + 28 + (i + 1) * seg - 6, y0 + 110), fill=c)
    bg.save(dst)


async def speak(text, mp3):
    comm = edge_tts.Communicate(text, VOICE, rate=RATE, boundary='SentenceBoundary')
    subs = []
    with open(mp3, 'wb') as f:
        async for chunk in comm.stream():
            if chunk['type'] == 'audio':
                f.write(chunk['data'])
            elif chunk['type'] in ('SentenceBoundary', 'WordBoundary'):
                subs.append((chunk['offset'] / 1e7, (chunk['offset'] + chunk['duration']) / 1e7, chunk['text']))
    return subs


def duration(path):
    return float(subprocess.run([FFPROBE, '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path],
                                capture_output=True, text=True, check=True).stdout)


def ts(t):
    h, rem = divmod(t, 3600)
    m, s = divmod(rem, 60)
    return f'{int(h):02}:{int(m):02}:{s:06.3f}'.replace('.', ',')


def caption(text):
    """Captions show 18xx as written, not as spoken."""
    text = re.sub(r'[Ee]ighteen ex ex dot games', '18xx.games', text)
    text = re.sub(r'[Ee]ighteen ex ex dot net', '18xx.net', text)
    return re.sub(r'[Ee]ighteen ex ex', '18xx', text)


def main():
    os.makedirs(OUT, exist_ok=True)
    card('title', 'Every track tile, every game, one place')
    card('end', 'Every track tile, every game, one place', '<small>A reference for 18xx players</small>')
    PRE, POST = 0.5, 0.9                       # silence before and after each slide's narration
    segments, srt, clock = [], [], 0.0
    for i, (sid, shot, headline, text) in enumerate(SLIDES):
        frame = os.path.join(WORK, sid + '.png')
        slide(shot, headline, frame)
        mp3 = os.path.join(WORK, sid + '.mp3')
        for attempt in range(4):          # the speech service occasionally returns a clipped clip; about 2.5 words a second is expected
            subs = asyncio.run(speak(text, mp3))
            if duration(mp3) >= len(text.split()) / 4:
                break
            print(f'{sid}: short audio, retrying')
        else:
            sys.exit(f'{sid}: the speech service kept returning short audio')
        dur = PRE + duration(mp3) + POST
        for a, b, t in subs:
            srt.append((clock + PRE + a, clock + PRE + b, caption(t)))
        n = int(dur * FPS)
        seg = os.path.join(WORK, sid + '.mp4')
        zoom = f"zoompan=z='1+0.05*on/{n}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s={W}x{H}:fps={FPS}"
        vf = f"scale=3840:2160,{zoom},fade=t=in:st=0:d=0.4,fade=t=out:st={dur - 0.4:.3f}:d=0.4,format=yuv420p"
        af = f"adelay={int(PRE * 1000)}:all=1,apad,atrim=0:{dur:.3f},afade=t=in:st=0:d=0.2"
        subprocess.run([FFMPEG, '-y', '-v', 'error', '-loop', '1', '-framerate', str(FPS), '-t', f'{dur:.3f}', '-i', frame, '-i', mp3,
                        '-vf', vf, '-af', af, '-t', f'{dur:.3f}', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
                        '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', seg], check=True)
        segments.append(seg)
        clock += dur
        print(f'{sid}: {dur:.1f}s')
    lst = os.path.join(WORK, 'segments.txt')
    open(lst, 'w').write(''.join(f"file '{s.replace(os.sep, '/')}'\n" for s in segments))
    video = os.path.join(OUT, '18xx-Tiles-Promo.mp4')
    subprocess.run([FFMPEG, '-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', lst, '-c', 'copy', '-movflags', '+faststart', video], check=True)
    with open(os.path.join(OUT, '18xx-Tiles-Promo.srt'), 'w', encoding='utf-8') as f:
        for k, (a, b, t) in enumerate(srt, 1):
            f.write(f'{k}\n{ts(a)} --> {ts(b)}\n{t}\n\n')
    with open(os.path.join(OUT, '18xx-Tiles-Promo-script.md'), 'w', encoding='utf-8') as f:
        f.write('# 18xx Tiles promo: narration script\n\n')
        for k, (sid, shot, headline, text) in enumerate(SLIDES, 1):
            f.write(f'## {k}. {headline or ("Title" if k == 1 else "Closing")}\n\n{caption(text)}\n\n')
    print(f'total {clock:.1f}s -> {video}')


main()
