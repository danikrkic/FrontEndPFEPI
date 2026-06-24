#!/bin/sh
set -e

if [ -n "$DB_HOST" ]; then
  echo "Waiting for database at $DB_HOST:${DB_PORT:-5432}..."
  until python -c "
import socket, sys
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.settimeout(1)
try:
    s.connect(('$DB_HOST', int('${DB_PORT:-5432}')))
except OSError:
    sys.exit(1)
"; do
    sleep 1
  done
  echo "Database is up."
fi

python manage.py migrate --noinput

exec python manage.py runserver 0.0.0.0:8000
