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

> Los valores por defecto funcionan sin modificaciones para desarrollo local.

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

Todos los usuarios usan la contraseña: **`demo123`**

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
