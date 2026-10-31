"""Run with the CURRENT release Python and trusted server environment."""
import os
import subprocess
import sys
sys.path.insert(0, os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
import django
django.setup()
from django.conf import settings
database = settings.DATABASES['default']
if database['ENGINE'] != 'django.db.backends.postgresql':
    raise RuntimeError('Expected production PostgreSQL')
environment = dict(os.environ, PGPASSWORD=database.get('PASSWORD', ''))
subprocess.run(['pg_dump', '--format=custom', '--no-owner',
                '--host', database.get('HOST') or '127.0.0.1',
                '--port', str(database.get('PORT') or 5432),
                '--username', database['USER'], '--file', sys.argv[1], database['NAME']],
               env=environment, check=True)
