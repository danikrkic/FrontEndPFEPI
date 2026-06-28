#!/bin/sh
set -e

if [ -n "$DB_HOST" ]; then
  echo "Waiting for database at $DB_HOST:${DB_PORT:-5432}..."
  until python -c "
import psycopg2, os, sys
try:
    psycopg2.connect(
        dbname=os.environ.get('DB_NAME', 'fepi_contracts'),
        user=os.environ.get('DB_USER', 'fepi'),
        password=os.environ.get('DB_PASSWORD', 'fepi'),
        host=os.environ.get('DB_HOST', 'localhost'),
        port=os.environ.get('DB_PORT', '5432'),
    )
except Exception:
    sys.exit(1)
"; do
    sleep 1
  done
  echo "Database is up."
fi

python manage.py migrate --noinput

echo "Cargando datos de prueba..."
python manage.py seed_demo_data
python manage.py seed_users
echo "Datos de prueba cargados."

exec python manage.py runserver 0.0.0.0:8000
