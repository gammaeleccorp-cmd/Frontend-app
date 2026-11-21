"""Exercise the production location rules with real Nginx, including old validators."""
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import tempfile
import time
import unittest
import urllib.error
import urllib.request


@unittest.skipUnless(shutil.which('nginx'), 'Nginx is required for HTTP delivery checks')
class DeliveryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.frontend = self.root / 'frontend'
        for name, body in [('a', '<html>old</html>'), ('b', '<html>new</html>')]:
            folder = self.frontend / name
            (folder / 'assets').mkdir(parents=True)
            for filename in ['index.html', 'legacy.html']:
                (folder / filename).write_text(body)
                os.utime(folder / filename, (0, 0))
            (folder / 'SOURCE_COMMIT').write_text(name * 40)
            (folder / 'release.json').write_text(json.dumps({'component': 'frontend', 'source_commit': name * 40}))
            (folder / 'assets' / f'index-{name * 8}.js').write_text(f'// {name}')
        (self.frontend / 'assets').mkdir()
        (self.frontend / 'assets' / 'index-aaaaaaaa.js').write_text('// a')
        (self.frontend / 'current').symlink_to(self.frontend / 'a')
        with socket.socket() as listener:
            try:
                listener.bind(('127.0.0.1', 0))
            except PermissionError as exc:
                self.skipTest(f'Runtime forbids HTTP listeners: {exc}')
            port = listener.getsockname()[1]
        self.base = f'http://127.0.0.1:{port}'
        candidate = Path(__file__).with_name('nginx').joinpath('gamma-pwa.release.conf').read_text()
        server = candidate.split('server {', 1)[1].split('\nserver {', 1)[0]
        server = 'server {' + server
        server = server.replace('/home/gamma/releases/sprint10/frontend', str(self.frontend))
        server = server.replace('listen 443 ssl;', f'listen 127.0.0.1:{port};')
        server = '\n'.join(line for line in server.splitlines() if not any(token in line for token in ['ssl_certificate', 'ssl_dhparam', 'include /etc/letsencrypt']))
        # A deliberately vulnerable location proves why no-cache alone is insufficient.
        server = server.replace('index index.html;', 'index index.html;\nlocation = /legacy.html { etag on; if_modified_since exact; }')
        config = self.root / 'nginx.conf'
        config.write_text(f'daemon off; master_process off; pid {self.root}/nginx.pid; error_log {self.root}/error.log;\nevents {{}}\nhttp {{ access_log off; include /etc/nginx/mime.types; {server} }}')
        nginx = subprocess.Popen([shutil.which('nginx'), '-p', str(self.root), '-c', str(config)], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        def stop():
            nginx.terminate()
            nginx.communicate(timeout=5)
        self.addCleanup(stop)
        for _ in range(50):
            if nginx.poll() is not None:
                self.fail(nginx.communicate()[1].decode() + (self.root / 'error.log').read_text())
            try:
                self.get('/')
                break
            except OSError:
                time.sleep(0.1)
        else:
            self.fail('Nginx did not start')

    def get(self, path, headers=None):
        try:
            response = urllib.request.urlopen(urllib.request.Request(self.base + path, headers=headers or {}), timeout=2)
        except urllib.error.HTTPError as exc:
            response = exc
        with response:
            return response.status, response.headers, response.read()

    def test_equal_size_epoch_html_collision_and_fixed_navigation(self):
        status, legacy_headers, old = self.get('/legacy.html')
        self.assertEqual(status, 200)
        self.assertEqual(legacy_headers['ETag'], '"0-10"')
        (self.frontend / 'next').symlink_to(self.frontend / 'b')
        os.replace(self.frontend / 'next', self.frontend / 'current')
        validators = {'If-None-Match': legacy_headers['ETag'], 'If-Modified-Since': legacy_headers['Last-Modified']}
        self.assertEqual(self.get('/legacy.html', validators)[0], 304)
        for path in ['/', '/index.html', '/routes', '/profile']:
            status, headers, body = self.get(path, validators)
            self.assertEqual(status, 200)
            self.assertEqual(body, b'<html>new</html>')
            self.assertNotEqual(body, old)
            self.assertIn('no-cache', headers['Cache-Control'])
            self.assertIsNone(headers.get('ETag'))
        for path in ['/release.json', '/SOURCE_COMMIT']:
            status, headers, body = self.get(path, validators)
            self.assertEqual(status, 200)
            self.assertIn(b'b' * 40, body)
            self.assertRegex(headers['Cache-Control'], 'no-cache|no-store')
        for name in ['aaaaaaaa', 'bbbbbbbb']:
            status, headers, body = self.get(f'/assets/index-{name}.js')
            self.assertEqual(status, 200)
            self.assertIn('immutable', headers['Cache-Control'])
            self.assertTrue(body.startswith(b'//'))
        for path in ['/assets/missing-cccccccc.js', '/assets/missing-cccccccc.css']:
            status, headers, body = self.get(path)
            self.assertEqual(status, 404)
            self.assertNotIn('immutable', headers.get('Cache-Control', ''))
        (self.frontend / 'b' / 'release.json').unlink()
        self.assertEqual(self.get('/release.json')[0], 404)


if __name__ == '__main__':
    unittest.main()
