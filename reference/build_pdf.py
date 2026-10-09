import json, math, re, html
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer,
                                Table, TableStyle, KeepTogether, PageBreak, NextPageTemplate, CondPageBreak)
from reportlab.graphics.shapes import Drawing, Polygon, Line, Circle, Rect, String, Path, Group

COMMIT = '46a592e40494368390c9a731978a577ac4ecb1e0'
COMMIT_DATE = 'October 7, 2026'
REPO = 'https://github.com/tobymao/18xx'

FILL = {'yellow': ['#FBE88A'], 'green': ['#A8D5A2'], 'brown': ['#D9B48F'], 'gray': ['#D0D0D0'],
        'sepia': ['#E6CFA8'], 'greenbrown': ['#A8D5A2', '#D9B48F'], 'browngray': ['#D9B48F', '#D0D0D0'],
        'brownsepia': ['#D9B48F', '#E6CFA8'], 'none': ['#FFFFFF'], 'white': ['#FFFFFF']}

# Edge numbering per TILES.md "Anatomy of a Flat Tile": 0 bottom, then clockwise
def edge_ang(e):
    return math.radians(-90 - 60 * e)

def parse(code):
    parts = []
    for p in (code or '').split(';'):
        p = p.strip()
        if not p:
            continue
        typ, _, rest = p.partition('=')
        d = {}
        if rest:
            for kv in rest.split(','):
                k, _, v = kv.partition(':')
                d[k] = v
        parts.append((typ, d))
    return parts

def rev_text(v):
    if v is None:
        return None
    nums = re.findall(r'(\d+)', v.split('|')[0] if '|' not in v else v)
    if '|' in v:
        nums = [re.findall(r'(\d+)$', x)[0] for x in v.split('|') if re.findall(r'(\d+)$', x)]
    return '/'.join(nums) if nums else None

def bez(p0, p1, p2, p3, t):
    u = 1 - t
    return (u**3*p0[0] + 3*u*u*t*p1[0] + 3*u*t*t*p2[0] + t**3*p3[0],
            u**3*p0[1] + 3*u*u*t*p1[1] + 3*u*t*t*p2[1] + t**3*p3[1])

def render_tile(code, color, size, number=None):
    """Return a Drawing of a flat-top hex. size = drawing width in points."""
    R = size / 2.0 - 1
    a = R * math.sqrt(3) / 2
    W, H = size, 2 * a + 2
    cx, cy = W / 2, H / 2
    d = Drawing(W, H)
    pts = []
    for i in range(6):
        ang = math.radians(60 * i)
        pts += [cx + R * math.cos(ang), cy + R * math.sin(ang)]
    fills = FILL.get(color, ['#FFFFFF'])
    if len(fills) == 1:
        d.add(Polygon(pts, fillColor=colors.HexColor(fills[0]), strokeColor=None))
    else:  # two-tone: left half first colour, right half second (document convention)
        left = [cx, cy + a, cx - R / 2, cy + a, cx - R, cy, cx - R / 2, cy - a, cx, cy - a]
        right = [cx, cy + a, cx + R / 2, cy + a, cx + R, cy, cx + R / 2, cy - a, cx, cy - a]
        d.add(Polygon(left, fillColor=colors.HexColor(fills[0]), strokeColor=None))
        d.add(Polygon(right, fillColor=colors.HexColor(fills[1]), strokeColor=None))

    parts = parse(code)
    nodes = []  # dicts: kind, slots, rev, loc, pos
    paths = []
    labels, extras = [], []
    frame = None
    for typ, dd in parts:
        if typ in ('city', 'town', 'junction', 'offboard', 'pass'):
            nodes.append({'kind': typ, 'slots': int(dd.get('slots', 1) or 1), 'rev': rev_text(dd.get('revenue')),
                          'loc': dd.get('loc'), 'edges': [], 'nbrs': []})
        elif typ == 'path':
            paths.append(dd)
        elif typ == 'label':
            labels.append(next(iter(dd.keys())))
        elif typ == 'frame':
            frame = dd.get('color')
        elif typ == 'upgrade':
            extras.append('$' + dd.get('cost', '?'))
        elif typ == 'icon':
            extras.append('icon:' + dd.get('image', '?').split('/')[-1])
        elif typ == 'future_label':
            extras.append('future ' + dd.get('label', '?') + (' (' + dd['color'] + ')' if dd.get('color') else ''))

    def ep(e):  # edge midpoint
        ang = edge_ang(e)
        return (cx + a * math.cos(ang), cy + a * math.sin(ang))

    def is_node(x):
        return x.startswith('_')

    for p in paths:
        A, B = p.get('a', ''), p.get('b', '')
        for X, Y in ((A, B), (B, A)):
            if is_node(X):
                n = int(X[1:])
                if n < len(nodes):
                    if is_node(Y):
                        nodes[n]['nbrs'].append(int(Y[1:]))
                    elif Y != '':
                        nodes[n]['edges'].append(int(float(Y)))

    # position nodes
    real = [n for n in nodes if n['kind'] != 'junction']
    for n in nodes:
        loc = n['loc']
        n['through'] = None
        if n['kind'] == 'junction':
            n['pos'] = (cx, cy)
        elif loc == 'center':
            n['pos'] = (cx, cy)
        elif loc not in (None, ''):
            f = float(loc)
            if f == int(f):
                ang, r = edge_ang(int(f)), 0.55 * a
            else:
                ang, r = math.radians(-90 - 60 * f), 0.55 * R
            n['pos'] = (cx + r * math.cos(ang), cy + r * math.sin(ang))
        elif n['kind'] == 'town' and len(n['edges']) == 2 and not n['nbrs']:
            e1, e2 = n['edges']
            p0, p3 = ep(e1), ep(e2)
            k = 0.5 * a
            p1 = (p0[0] + (cx - p0[0]) / a * k, p0[1] + (cy - p0[1]) / a * k)
            p2 = (p3[0] + (cx - p3[0]) / a * k, p3[1] + (cy - p3[1]) / a * k)
            n['pos'] = bez(p0, p1, p2, p3, 0.5)
            q1, q2 = bez(p0, p1, p2, p3, 0.45), bez(p0, p1, p2, p3, 0.55)
            n['through'] = (p0, p1, p2, p3, math.atan2(q2[1] - q1[1], q2[0] - q1[0]))
        elif len(real) == 1:
            n['pos'] = (cx, cy)
        elif n['edges']:
            vx = sum(math.cos(edge_ang(e)) for e in n['edges'])
            vy = sum(math.sin(edge_ang(e)) for e in n['edges'])
            L = math.hypot(vx, vy)
            if L < 1e-6:
                n['pos'] = (cx, cy)
            else:
                r = 0.5 * a
                n['pos'] = (cx + vx / L * r, cy + vy / L * r)
        else:
            n['pos'] = None
    # unplaced nodes (no edges, no loc): opposite to the placed ones, spread
    unplaced = [n for n in nodes if n['pos'] is None]
    if unplaced:
        placed = [n['pos'] for n in nodes if n['pos'] is not None and n['pos'] != (cx, cy)]
        if placed:
            mx = sum(p[0] - cx for p in placed); my = sum(p[1] - cy for p in placed)
            base = math.atan2(-my, -mx) if math.hypot(mx, my) > 1e-6 else math.radians(90)
        else:
            base = math.radians(90)
        for i, n in enumerate(unplaced):
            ang = base + (i - (len(unplaced) - 1) / 2) * math.radians(60)
            n['pos'] = (cx + 0.5 * a * math.cos(ang), cy + 0.5 * a * math.sin(ang))
    # nudge exact overlaps
    seen = {}
    for n in nodes:
        key = (round(n['pos'][0], 1), round(n['pos'][1], 1))
        if key in seen and n['kind'] != 'junction':
            n['pos'] = (n['pos'][0], n['pos'][1] - 0.45 * a)
        seen[key] = 1

    track_pts = []
    lw = 0.13 * a
    def draw_track(pathobj_pts, track):
        # pathobj_pts: list of points along curve
        P = Path(strokeColor=colors.black, strokeWidth=lw, fillColor=None, strokeLineCap=0)
        P.moveTo(*pathobj_pts[0])
        for q in pathobj_pts[1:]:
            P.lineTo(*q)
        if track == 'narrow':
            P.strokeWidth = lw * 0.55
            P.strokeDashArray = [lw * 0.9, lw * 0.6]
            d.add(P)
        elif track == 'dual':
            d.add(P)
            P2 = Path(strokeColor=colors.white, strokeWidth=lw * 0.3, fillColor=None, strokeDashArray=[lw * 0.6, lw * 0.6])
            P2.moveTo(*pathobj_pts[0])
            for q in pathobj_pts[1:]:
                P2.lineTo(*q)
            d.add(P2)
        else:
            d.add(P)
        track_pts.extend(pathobj_pts)

    def curve(p0, p1, p2, p3, nseg=24):
        return [bez(p0, p1, p2, p3, i / nseg) for i in range(nseg + 1)]

    def inward(p, k):
        return (p[0] + (cx - p[0]) / a * k, p[1] + (cy - p[1]) / a * k)

    drawn_through = set()
    for p in paths:
        A, B = p.get('a', ''), p.get('b', '')
        track = p.get('track', 'broad')
        if not is_node(A) and not is_node(B):
            e1, e2 = int(float(A)), int(float(B))
            p0, p3 = ep(e1), ep(e2)
            draw_track(curve(p0, inward(p0, 0.5 * a), inward(p3, 0.5 * a), p3), track)
        elif is_node(A) and is_node(B):
            n1, n2 = nodes[int(A[1:])], nodes[int(B[1:])]
            draw_track([n1['pos'], n2['pos']], track)
        else:
            e = A if not is_node(A) else B
            nn = B if is_node(B) else A
            n = nodes[int(nn[1:])]
            if n['through']:
                if id(n) in drawn_through:
                    continue
                drawn_through.add(id(n))
                p0, p1, p2, p3, _ = n['through']
                draw_track(curve(p0, p1, p2, p3), track)
                continue
            p0 = ep(int(float(e)))
            q = n['pos']
            dist = math.hypot(q[0] - p0[0], q[1] - p0[1])
            p1 = inward(p0, min(0.45 * a, dist * 0.5))
            draw_track(curve(p0, p1, q, q), track)

    # frame
    if frame:
        fp = []
        for i in range(6):
            ang = math.radians(60 * i)
            fp += [cx + (R - 0.07 * a) * math.cos(ang), cy + (R - 0.07 * a) * math.sin(ang)]
        d.add(Polygon(fp, fillColor=None, strokeColor=colors.HexColor(frame), strokeWidth=0.12 * a))

    occupied = list(track_pts)
    cr = 0.19 * a  # city slot radius
    badges = []
    for n in nodes:
        x, y = n['pos']
        if n['kind'] == 'city':
            s = n['slots']
            if s == 1:
                offs = [(0, 0)]
            elif s == 2:
                offs = [(-cr, 0), (cr, 0)]
            elif s == 3:
                offs = [(-cr, -cr * 0.58), (cr, -cr * 0.58), (0, cr * 1.15)]
            else:
                offs = [(-cr, -cr), (cr, -cr), (-cr, cr), (cr, cr)][:max(4, 0)]
            if s == 2:
                d.add(Rect(x - cr, y - cr, 2 * cr, 2 * cr, fillColor=colors.white, strokeColor=None))
            if s >= 3:
                d.add(Circle(x, y, cr * (1.85 if s == 3 else 2.2), fillColor=colors.white, strokeColor=colors.black, strokeWidth=0.6))
            for ox, oy in offs:
                d.add(Circle(x + ox, y + oy, cr, fillColor=colors.white, strokeColor=colors.black, strokeWidth=0.8))
            ext = cr * (1 if s == 1 else 2.2)
            for ang in range(0, 360, 30):
                occupied.append((x + ext * math.cos(math.radians(ang)), y + ext * math.sin(math.radians(ang))))
            occupied.append((x, y))
            badges.append((n, ext))
        elif n['kind'] == 'town':
            if n['through']:
                ang = n['through'][4] + math.pi / 2
                hl, hw = 0.2 * a, 0.065 * a
                dx, dy = math.cos(ang), math.sin(ang)
                px, py = -dy, dx
                d.add(Polygon([x + dx * hl + px * hw, y + dy * hl + py * hw, x + dx * hl - px * hw, y + dy * hl - py * hw,
                               x - dx * hl - px * hw, y - dy * hl - py * hw, x - dx * hl + px * hw, y - dy * hl + py * hw],
                              fillColor=colors.black, strokeColor=None))
                ext = 0.2 * a
            else:
                d.add(Circle(x, y, 0.1 * a, fillColor=colors.black, strokeColor=None))
                ext = 0.1 * a
            occupied.append((x, y))
            badges.append((n, ext))
        elif n['kind'] == 'pass':
            d.add(Circle(x, y, 0.09 * a, fillColor=colors.white, strokeColor=colors.black, strokeWidth=0.8))
            badges.append((n, 0.09 * a))
        elif n['kind'] == 'junction':
            d.add(Circle(x, y, lw * 0.5, fillColor=colors.black, strokeColor=None))

    def inside(px, py, m=0.12):
        # inside hex with margin m*a
        for i in range(6):
            ang = math.radians(-90 - 60 * i)
            if (px - cx) * math.cos(ang) + (py - cy) * math.sin(ang) > a * (1 - m):
                return False
        return True

    def clearance(px, py):
        return min([math.hypot(px - q[0], py - q[1]) for q in occupied] or [99])

    br = 0.15 * a
    for n, ext in badges:
        if not n['rev'] or n['rev'] == '0':
            continue
        x, y = n['pos']
        best, bc = None, -1
        for ang in range(0, 360, 15):
            for dist in (ext + br * 1.15, ext + br * 1.6):
                px, py = x + dist * math.cos(math.radians(ang)), y + dist * math.sin(math.radians(ang))
                if not inside(px, py, 0.08 + 1.3 * br / a):
                    continue
                c = clearance(px, py)
                if c > bc:
                    bc, best = c, (px, py)
        if best:
            txt = n['rev']
            rr = br * (1 if len(txt) <= 2 else 1.25 if len(txt) <= 3 else 1.6)
            d.add(Circle(best[0], best[1], rr, fillColor=colors.white, strokeColor=colors.black, strokeWidth=0.5))
            fs = rr * (1.05 if len(txt) <= 2 else 0.85 if len(txt) <= 3 else 0.6)
            d.add(String(best[0], best[1] - fs * 0.35, txt, fontName='Helvetica', fontSize=fs, textAnchor='middle'))
            for ang in range(0, 360, 45):
                occupied.append((best[0] + rr * math.cos(math.radians(ang)), best[1] + rr * math.sin(math.radians(ang))))

    def place_text(txt, fs, bold=True):
        best, bc = None, -1
        cands = []
        for i in range(6):
            for frac in (0.62, 0.72):
                ang = math.radians(-60 * i)  # corners
                cands.append((cx + frac * R * math.cos(ang), cy + frac * R * math.sin(ang)))
            ang = edge_ang(i)
            cands.append((cx + 0.62 * a * math.cos(ang), cy + 0.62 * a * math.sin(ang)))
        from reportlab.pdfbase.pdfmetrics import stringWidth
        tw = stringWidth(txt, 'Helvetica-Bold' if bold else 'Helvetica', fs)
        for frac in (0.55, 0.45, 0.35):
            for i in range(6):
                ang = math.radians(-60 * i)
                cands.append((cx + frac * R * math.cos(ang), cy + frac * R * math.sin(ang)))
        def fits(px, py):
            return all(inside(px + sx * tw / 2, py + sy * fs * 0.45, 0.04) for sx in (-1, 1) for sy in (-1, 1))
        ok = [c for c in cands if fits(*c)] or [(cx, cy)]
        for px, py in ok:
            c = clearance(px, py)
            if c > bc:
                bc, best = c, (px, py)
        d.add(String(best[0], best[1] - fs * 0.35, txt, fontName='Helvetica-Bold' if bold else 'Helvetica',
                     fontSize=fs, textAnchor='middle'))
        for dx in (-1, 0, 1):
            occupied.append((best[0] + dx * fs * len(txt) * 0.3, best[1]))

    for lab in labels:
        fs = 0.36 * a if len(lab) <= 2 else 0.26 * a if len(lab) <= 3 else 0.18 * a
        place_text(lab, fs)
    for ex in extras:
        place_text(ex, 0.15 * a, bold=False)

    # outline
    if color == 'none':
        d.add(Polygon(pts, fillColor=None, strokeColor=colors.black, strokeWidth=0.6, strokeDashArray=[2, 2]))
    else:
        d.add(Polygon(pts, fillColor=None, strokeColor=colors.HexColor('#555555'), strokeWidth=0.6))
    if number:
        fs = 0.17 * a
        ang = math.radians(-60)
        d.add(String(cx + 0.78 * R * math.cos(ang) - 0.05 * a, cy + 0.78 * R * math.sin(ang) - fs * 0.3 + 0.03 * a,
                     number, fontName='Helvetica', fontSize=fs, textAnchor='middle', fillColor=colors.HexColor('#333333')))
    return d


# ---------------- document ----------------
def esc(s):
    return html.escape(s or '', quote=False)

def numkey(name):
    m = re.match(r'^(\d+)(.*)$', name)
    return (int(m.group(1)), m.group(2)) if m else (10**9, name)

COLOR_ORDER = ['yellow', 'green', 'brown', 'gray', 'greenbrown', 'browngray', 'brownsepia', 'none']
COLOR_TITLE = {'yellow': 'Yellow tiles', 'green': 'Green tiles', 'brown': 'Brown tiles', 'gray': 'Gray tiles',
               'greenbrown': 'Other: green/brown tiles', 'browngray': 'Other: brown/gray tiles',
               'brownsepia': 'Other: brown/sepia tiles', 'none': 'Other: uncoloured tiles (color "none")'}

ST = {
    'title': ParagraphStyle('t', fontName='Helvetica-Bold', fontSize=20, leading=24, spaceAfter=6),
    'h1': ParagraphStyle('h1', fontName='Helvetica-Bold', fontSize=14, leading=17, spaceBefore=4, spaceAfter=6),
    'h2': ParagraphStyle('h2', fontName='Helvetica-Bold', fontSize=11, leading=14, spaceBefore=6, spaceAfter=3),
    'body': ParagraphStyle('b', fontName='Helvetica', fontSize=8.8, leading=10.8, spaceAfter=4),
    'small': ParagraphStyle('s', fontName='Helvetica', fontSize=7, leading=8.4),
    'code': ParagraphStyle('c', fontName='Courier', fontSize=5.6, leading=6.6, textColor=colors.HexColor('#333333')),
    'num': ParagraphStyle('n', fontName='Helvetica-Bold', fontSize=11, leading=13),
}

class TTable(Table):
    def split(self, aW, aH):
        parts = Table.split(self, aW, aH)
        if parts and hasattr(self, '_tile_name'):
            parts[0]._tile_name = self._tile_name
        return parts


def entry(t):
    rows = []
    hex_d = render_tile(t['code'], t['color'], 62, None)
    n = len(t['games'])
    games = esc(', '.join(t['games'])) if n else '<i>No game on 18xx.games lists this tile in its parsed manifest.</i>'
    txt = [Paragraph('#%s <font size="7" color="#555555">%s</font>' % (esc(t['name']), t['color']), ST['num']),
           Paragraph('<b>Games (%d):</b> %s' % (n, games), ST['small']),
           Paragraph(esc(t['code']) or '(empty definition)', ST['code'])]
    rows.append([hex_d, txt])
    for v in t.get('vgroups', []):
        vc = v['color'] or t['color']
        vd = render_tile(v['code'], vc, 46, None)
        vt = [Paragraph('<b>Different definition under #%s</b> (%s) in: %s' % (esc(t['name']), esc(vc), esc(', '.join(v['games']))), ST['small']),
              Paragraph(esc(v['code']) or '(empty definition)', ST['code'])]
        rows.append([vd, vt])
    tb = TTable(rows, colWidths=[66, None])
    style = [('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LEFTPADDING', (0, 0), (-1, -1), 1), ('RIGHTPADDING', (0, 0), (-1, -1), 2),
             ('TOPPADDING', (0, 0), (-1, -1), 2), ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
             ('LINEBELOW', (0, -1), (-1, -1), 0.4, colors.HexColor('#BBBBBB'))]
    if len(rows) > 1:
        style += [('ALIGN', (0, 1), (0, -1), 'CENTER'), ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#F6F6F6'))]
    tb.setStyle(TableStyle(style))
    tb._tile_name = t['name']
    return tb


class Doc(BaseDocTemplate):
    def __init__(self, fn, **kw):
        super().__init__(fn, pagesize=letter, leftMargin=0.5 * inch, rightMargin=0.5 * inch,
                         topMargin=0.55 * inch, bottomMargin=0.55 * inch, **kw)
        W, H = letter
        fw = (W - inch - 0.25 * inch) / 2
        fh = H - 1.1 * inch
        one = Frame(0.5 * inch, 0.55 * inch, W - inch, fh, id='one')
        c1 = Frame(0.5 * inch, 0.55 * inch, fw, fh, id='c1')
        c2 = Frame(0.5 * inch + fw + 0.25 * inch, 0.55 * inch, fw, fh, id='c2')
        self.addPageTemplates([PageTemplate('one', [one], onPageEnd=self.deco),
                               PageTemplate('two', [c1, c2], onPageEnd=self.deco)])
        self.pages = {}
        self.section = ''

    def deco(self, canv, doc):
        canv.saveState()
        canv.setFont('Helvetica', 7)
        canv.setFillColor(colors.HexColor('#555555'))
        canv.drawString(0.5 * inch, 0.32 * inch, '18xx generic tile reference - source: tobymao/18xx lib/engine/config/tile.rb @ %s' % COMMIT[:7])
        canv.drawRightString(letter[0] - 0.5 * inch, 0.32 * inch, 'Page %d' % doc.page)
        if self.section:
            canv.drawString(0.5 * inch, letter[1] - 0.35 * inch, self.section)
        canv.restoreState()

    def afterFlowable(self, f):
        if hasattr(f, '_tile_name'):
            self.pages.setdefault(f._tile_name, self.page)
        if hasattr(f, '_section'):
            self.section = f._section


def build(out, index_pages=None):
    tiles = json.load(open('tiles.json'))
    games = json.load(open('games.json'))
    n_games = sum(1 for g in games.values() if g['tiles'])
    story = []
    story.append(Paragraph('18xx Generic Tile Reference', ST['title']))
    story.append(Paragraph('The shared numbered track tiles defined by the 18xx.games open-source engine, drawn from their '
                           'documented definitions, with the games on 18xx.games that use each tile and every place a game '
                           'redefines the same number differently.', ST['body']))
    story.append(Paragraph('Sources', ST['h1']))
    src = [
        '<b>Tile definitions:</b> tobymao/18xx, file <font name="Courier">lib/engine/config/tile.rb</font>, commit %s (%s). '
        '%s. The file header states it was originally exported from 18xx-maker/export-rb. %d numbered tiles are defined '
        '(sections YELLOW, GREEN, BROWN, GRAY, GREENBROWN, BROWNGRAY, BROWNSEPIA, NONE). The three WHITE entries '
        '(blank, city, town) are generic map hexes, not numbered tiles, and are excluded. Lines commented out in that '
        'file are excluded.' % (COMMIT, COMMIT_DATE, REPO, len(tiles)),
        '<b>Definition language and edge numbering:</b> tobymao/18xx, <font name="Courier">TILES.md</font> ("Tile language" and '
        '"Anatomy of a Flat Tile"). Edges are numbered 0 at the bottom of a flat-topped hex, then 1 lower-left, 2 upper-left, '
        '3 top, 4 upper-right, 5 lower-right.',
        '<b>Games using each tile:</b> the TILES manifests in <font name="Courier">lib/engine/game/g_*/</font> at the same commit. '
        '%d game titles with a tile manifest were parsed. A game is listed under a number when its manifest lists that number '
        'with no custom definition, or with a custom definition identical to the generic one.' % n_games,
        '<b>License:</b> the repository LICENSE states the MIT License applies to the platform software and does not apply to '
        'rights associated with the game titles themselves.',
        '<b>Physical tile images:</b> not reproduced. For photographs and scans of printed tiles, see Keith Thomasson\'s 18xx Tiles '
        'Database, http://www.fwtwr.com/18xx/tiles/tiles.asp.',
    ]
    for s in src:
        story.append(Paragraph(s, ST['body']))
    story.append(Paragraph('How to read each entry', ST['h1']))
    story.append(Paragraph('Each entry shows the drawing, the tile number and colour section, the games that use the generic '
                           'definition, and the exact definition string from the source file (small monospace text), so every '
                           'drawing can be checked against its source. Shaded sub-rows show a game that defines a tile with the '
                           'same number but a different definition string; these are the "versions" of that number on 18xx.games.',
                           ST['body']))
    # legend drawings
    leg = [('path=a:0,b:3', 'yellow', 'Standard (broad) track'),
           ('path=a:0,b:3,track:narrow', 'yellow', 'Narrow gauge (dashed)'),
           ('path=a:0,b:3,track:dual', 'yellow', 'Dual gauge (white dashes in black)'),
           ('city=revenue:30;path=a:0,b:_0', 'green', 'City, one token slot; revenue in white circle'),
           ('city=revenue:40,slots:2;path=a:0,b:_0;path=a:3,b:_0', 'brown', 'City with two token slots'),
           ('town=revenue:10;path=a:0,b:_0;path=a:_0,b:3', 'yellow', 'Town on through track (bar)'),
           ('town=revenue:10;path=a:0,b:_0', 'yellow', 'Town at end of track (dot)'),
           ('junction;path=a:0,b:_0;path=a:2,b:_0;path=a:4,b:_0', 'green', 'Lawson junction (centre point)'),
           ('city=revenue:30;path=a:0,b:_0;label=Y', 'yellow', 'Placement label'),
           ('city=revenue:40;path=a:0,b:_0;frame=color:#800080', 'green', 'Coloured frame'),
           ('city=revenue:40,slots:2;path=a:0,b:_0;path=a:3,b:_0', 'greenbrown', 'Two-colour section (left/right halves)'),
           ('path=a:0,b:3,track:narrow', 'none', 'Colour "none" (dashed outline)')]
    cells = []
    for code, col, lab in leg:
        cells.append([render_tile(code, col, 44), Paragraph(lab, ST['small'])])
    rows = [cells[i] + cells[i + 1] + cells[i + 2] for i in range(0, len(cells), 3)]
    lt = Table([[c for c in r] for r in rows], colWidths=[48, 120] * 3)
    lt.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'MIDDLE'), ('TOPPADDING', (0, 0), (-1, -1), 1), ('BOTTOMPADDING', (0, 0), (-1, -1), 1)]))
    story.append(lt)
    story.append(Spacer(1, 4))
    story.append(Paragraph('Limitations', ST['h1']))
    lim = [
        'Drawings are schematic and generated by this document from the definition strings. They show what each tile '
        'connects, its revenue, token slots, and labels. They are not copies of any publisher\'s artwork; curve shapes, '
        'colours, and the exact position of cities, towns, revenue circles, and labels are this document\'s own layout '
        'choices where the definition does not specify a location (the definition language leaves these to the renderer).',
        'Tiles are shown in rotation 0 only. Games may lay them in any allowed rotation.',
        'Game lists cover only games implemented on 18xx.games, not every published 18xx title. Some games add or remove '
        'tiles through optional rules in code; those adjustments are not reflected. Harzbahn 1873 declares its tiles in a way '
        'this parser did not read and is not included. Rolling Stock and Rolling Stock Stars have no track tiles.',
        'A shaded "different definition" row means the strings differ as text after sorting their parts. Some differences are '
        'only a rotation, a label, or an extra attribute and may be the same physical tile in practice; no judgement about '
        'physical equivalence has been made.',
        'Revenue values written with several phases in the source (for example the 1835 Hamburg note in the BROWN section) are '
        'shown as "a/b".',
        'Generated content should be reviewed and verified before it is relied on.',
    ]
    for s in lim:
        story.append(Paragraph('- ' + s, ST['body']))
    story.append(NextPageTemplate('two'))
    story.append(PageBreak())

    for col in COLOR_ORDER:
        group = sorted([t for t in tiles if t['color'] == col], key=lambda t: numkey(t['name']))
        if not group:
            continue
        h = Paragraph('%s (%d)' % (COLOR_TITLE[col], len(group)), ST['h1'])
        h._section = COLOR_TITLE[col]
        story.append(CondPageBreak(1.6 * inch))
        story.append(h)
        for t in group:
            story.append(entry(t))

    # index
    story.append(NextPageTemplate('one'))
    story.append(PageBreak())
    ih = Paragraph('Index by tile number', ST['h1'])
    ih._section = 'Index'
    story.append(ih)
    if index_pages:
        allt = sorted(tiles, key=lambda t: numkey(t['name']))
        items = ['%s&nbsp;-&nbsp;p.%d' % (esc(t['name']), index_pages.get(t['name'], 0)) for t in allt]
        per = 6
        data = [[Paragraph(items[i + j], ST['small']) if i + j < len(items) else '' for j in range(per)]
                for i in range(0, len(items), per)]
        it = Table(data, colWidths=[(letter[0] - inch) / per] * per)
        it.setStyle(TableStyle([('TOPPADDING', (0, 0), (-1, -1), 0.5), ('BOTTOMPADDING', (0, 0), (-1, -1), 0.5)]))
        story.append(it)
    doc = Doc(out, title='18xx Generic Tile Reference', author='Generated with Claude',
              subject='Tiles from tobymao/18xx lib/engine/config/tile.rb @ ' + COMMIT[:7])
    doc.build(story)
    return doc.pages

if __name__ == '__main__':
    pages = build('/home/claude/pass1.pdf')
    build('/mnt/user-data/outputs/18xx_Generic_Tile_Reference.pdf', pages)
    print('ok', len(pages))
