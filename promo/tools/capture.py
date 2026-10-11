"""Capture 1920x1080 screenshots of the local test site with headless Edge over the DevTools protocol (minimal websocket client, stdlib only)."""
import base64, json, os, socket, subprocess, sys, time, urllib.request

OUT = sys.argv[1]
SITE = 'http://localhost:5177'
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
PROFILE = os.path.join(os.path.dirname(OUT), 'edgeprofile')
PORT = 9333


class WS:
    def __init__(self, url):
        host, path = url[len('ws://'):].split('/', 1)
        h, p = host.split(':')
        self.s = socket.create_connection((h, int(p)))
        key = base64.b64encode(os.urandom(16)).decode()
        self.s.sendall((f'GET /{path} HTTP/1.1\r\nHost: {host}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n'
                        f'Sec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n').encode())
        buf = b''
        while b'\r\n\r\n' not in buf:
            buf += self.s.recv(4096)
        self.rest = buf.split(b'\r\n\r\n', 1)[1]
        self.id = 0

    def _read(self, n):
        while len(self.rest) < n:
            chunk = self.s.recv(1 << 20)
            if not chunk:
                raise ConnectionError('closed')
            self.rest += chunk
        out, self.rest = self.rest[:n], self.rest[n:]
        return out

    def recv(self):
        data = b''
        while True:
            b1, b2 = self._read(2)
            n = b2 & 0x7F
            if n == 126:
                n = int.from_bytes(self._read(2), 'big')
            elif n == 127:
                n = int.from_bytes(self._read(8), 'big')
            data += self._read(n)
            if b1 & 0x80:
                return json.loads(data)

    def send(self, obj):
        payload = json.dumps(obj).encode()
        mask = os.urandom(4)
        n = len(payload)
        head = bytes([0x81]) + (bytes([0x80 | n]) if n < 126 else bytes([0x80 | 126]) + n.to_bytes(2, 'big') if n < 65536
                                 else bytes([0x80 | 127]) + n.to_bytes(8, 'big'))
        self.s.sendall(head + mask + bytes(b ^ mask[i % 4] for i, b in enumerate(payload)))

    def call(self, method, **params):
        self.id += 1
        self.send({'id': self.id, 'method': method, 'params': params})
        while True:
            msg = self.recv()
            if msg.get('id') == self.id:
                if 'error' in msg:
                    raise RuntimeError(f'{method}: {msg["error"]}')
                return msg.get('result', {})


edge = subprocess.Popen([EDGE, '--headless=new', f'--remote-debugging-port={PORT}', f'--user-data-dir={PROFILE}', '--disable-gpu',
                         '--hide-scrollbars', '--force-color-profile=srgb', 'about:blank'])
try:
    for _ in range(50):
        try:
            targets = json.load(urllib.request.urlopen(f'http://127.0.0.1:{PORT}/json/list'))
            page = next(t for t in targets if t['type'] == 'page')
            break
        except Exception:
            time.sleep(0.3)
    ws = WS(page['webSocketDebuggerUrl'])
    ws.call('Page.enable')
    ws.call('Emulation.setDeviceMetricsOverride', width=1600, height=900, deviceScaleFactor=1.2, mobile=False)
    ws.call('Emulation.setEmulatedMedia', features=[{'name': 'prefers-color-scheme', 'value': 'light'}])

    def go(url, wait=2.5):
        ws.call('Page.navigate', url=SITE + url)
        time.sleep(wait)

    def shot(name, scroll=0):
        if scroll:
            ws.call('Runtime.evaluate', expression=f'window.scrollTo(0,{scroll})')
            time.sleep(0.6)
        data = ws.call('Page.captureScreenshot', format='png')['data']
        open(os.path.join(OUT, name + '.png'), 'wb').write(base64.b64decode(data))
        print('saved', name)

    def js(expr):
        return ws.call('Runtime.evaluate', expression=expr, awaitPromise=True, returnByValue=True).get('result', {}).get('value')

    go('/')
    shot('01-home')
    go('/tiles?game=25')
    shot('02-game-tiles')
    go('/tiles/12')
    shot('03-tile-detail')
    go('/tiles/common')
    shot('04-common')
    # Sign in as the test player for the signed-in pages.
    print('login', js("fetch('/api/auth/login?useCookies=true',{method:'POST',headers:{'Content-Type':'application/json'},"
                      "body:JSON.stringify({email:'promo@example.test',password:'Promo-Player-123!'})}).then(r=>r.status)"))
    go('/print/circles?game=25', wait=4)
    shot('05-print')
    go('/submit')
    shot('06-submit')
    go('/?q=1830')
    shot('07-search-1830')
finally:
    edge.terminate()
