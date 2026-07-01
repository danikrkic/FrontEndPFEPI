# Sistema de Gestión de Contratos de Obra Pública

Plataforma full-stack para la administración de contratos de obra pública: catálogo de conceptos, programa de obra (Gantt mensual), estimaciones, bitácora, convenios modificatorios, garantías y seguimiento de avance.

---

## Requisitos

| Herramienta | Versión mínima |
|---|---|
| Docker Desktop | 24+ |
| Docker Compose | v2 (incluido en Docker Desktop) |
| Git | cualquiera |

> Sin Docker: Node.js 20+ y Python 3.11+ con PostgreSQL 16.

---

## Inicio rápido con Docker (recomendado)

### 1. Clonar el repositorio

```bash
git clone https://github.com/danikrkic/FrontEndPFEPI.git
cd FrontEndPFEPI
```

### 2. Crear los archivos de entorno

```bash
# Backend
cp backend/.env.example backend/.env

# Frontend
cp contract-system-output/.env.local.example contract-system-output/.env.local
```

> Los valores por defecto funcionan sin modificaciones para desarrollo local. `SECRET_KEY` y
> `DEFAULT_USER_PASSWORD` son obligatorios (sin valor por defecto en el código) — si el `.env`
> no los define, el backend no arranca.

### 3. Levantar los servicios

```bash
docker compose up --build
```

Al iniciar por primera vez, el backend ejecuta automáticamente:
- Migraciones de base de datos
- Carga de contratos de demo (`seed_demo_data`)
- Creación de usuarios de prueba (`seed_users`)

### 4. Abrir la aplicación

| Servicio | URL |
|---|---|
| Frontend | http://localhost:3000 |
| API backend | http://localhost:8000/api |
| Admin Django | http://localhost:8000/admin |

---

## Usuarios de prueba

`seed_users` crea un usuario por rol con la contraseña definida en `DEFAULT_USER_PASSWORD` (ver `backend/.env`, no versionado). Solicita esa contraseña al equipo por un canal seguro.

| Email | Rol | Permisos principales |
|---|---|---|
| `dependencia@gacm.mx` | Dependencia | Ver contratos, aprobar activación, revisar convenios |
| `residente@gacm.mx` | Residente | Capturar programa de obra, crear estimaciones, bitácora |
| `superintendente@gacm.mx` | Superintendente | Ver contrato, firmar bitácora |
| `supervision@gacm.mx` | Supervisión | Revisar estimaciones, registrar avance diario |
| `finanzas@gacm.mx` | Finanzas | Gestionar garantías, dispersar pagos |

---

## Inicio manual (sin Docker)

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env             # ajustar DB_HOST=localhost
python manage.py migrate
python manage.py seed_demo_data
python manage.py seed_users
python manage.py runserver
```

### Frontend

```bash
cd contract-system-output
npm install
cp .env.local.example .env.local
npm run dev
```

---

## Estructura del proyecto

```
FrontEndPFEPI/
├── backend/                        # Django REST Framework
│   ├── contracts/                  # Modelos, vistas y serializadores
│   │   ├── management/commands/    # seed_demo_data, seed_users, migrar_programa_obra
│   │   └── migrations/
│   └── users/                      # Modelo de usuario con roles
├── contract-system-output/         # Next.js 16 + React 19
│   ├── app/                        # Rutas (App Router)
│   ├── components/contracts/       # Paneles de la aplicación
│   └── lib/                        # store, api, types, format
└── docker-compose.yml
```

---

## Comandos útiles

```bash
# Detener servicios
docker compose down

# Detener y borrar la base de datos (datos de demo)
docker compose down -v

# Ver logs del backend
docker compose logs -f backend

# Ejecutar comandos de Django dentro del contenedor
docker compose exec backend python manage.py <comando>

# Migrar programa de obra de formato semanal a mensual
docker compose exec backend python manage.py migrar_programa_obra

# Recrear datos de demo desde cero
docker compose down -v && docker compose up
```

---

## Antes de desplegar a producción

El `.env` de desarrollo tiene valores de ejemplo que **no deben usarse tal cual** fuera de tu máquina:

- `SECRET_KEY`: genera uno nuevo y único, por ejemplo con `python -c "import secrets; print(secrets.token_urlsafe(50))"`.
- `DEFAULT_USER_PASSWORD`: cambia `demo123` por una contraseña real; compártela con el equipo por un canal seguro, no por chat ni la incluyas en el repo.
- `DEBUG=False` y `ALLOWED_HOSTS`/`CORS_ALLOWED_ORIGINS` apuntando al dominio real.
- `DB_PASSWORD`: usa la contraseña que te dé el proveedor de base de datos (Railway, etc.), no `fepi`.
- Revisa que `backend/.env` y `contract-system-output/.env.local` sigan sin subirse al repo (`git status` no debe listarlos).

---

## Roles y flujo principal

```
Dependencia  →  crea contrato (registrado)
Residente    →  captura catálogo de conceptos y programa de obra
Dependencia  →  activa contrato (registrado → activo)
Residente    →  registra estimaciones de avance
Supervisión  →  revisa y acepta/rechaza estimaciones
Finanzas     →  dispersa órdenes de pago
Cualquiera   →  solicita convenio modificatorio → Dependencia lo aprueba
```
