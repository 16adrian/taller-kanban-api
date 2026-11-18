# Kanban Board API · Taller CI/CD

API REST de un **tablero Kanban** con **límites WIP** y **métricas de flujo** (throughput, lead time, cycle time), desplegada en la nube con un **pipeline CI/CD de 6 etapas** en GitHub Actions.

> Metodologías de Desarrollo de Software · UDLA · NRC 2206 · Adrián Morales Quilumba

**Producción:** https://taller-kanban-api.onrender.com/

## Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/` | Tablero visual (HTML) |
| GET | `/health` | Estado, versión y commit desplegado |
| GET | `/api/board` | Columnas con sus tarjetas, conteo y límite WIP |
| GET | `/api/cards?column=doing` | Lista de tarjetas (filtro opcional) |
| POST | `/api/cards` | Crea tarjeta `{ "title": "...", "assignee": "..." }` |
| GET | `/api/cards/:id` | Detalle con historial de movimientos |
| PATCH | `/api/cards/:id/move` | Mueve `{ "to": "doing" }` → **409** si se supera el WIP |
| DELETE | `/api/cards/:id` | Elimina |
| PUT | `/api/columns/:id/wip` | Cambia el límite `{ "limit": 4 }` |
| GET | `/api/metrics` | Throughput, lead time y cycle time promedio, WIP por columna |

## Cómo aplica Kanban

| Práctica Kanban | Implementación |
|---|---|
| Visualizar el flujo | Columnas `todo → doing → review → done` y tablero en `/` |
| Limitar el WIP | `doing` máx. 3, `review` máx. 2; la API responde **409 WIP_LIMIT_REACHED** |
| Gestionar el flujo | Cada movimiento queda en `history`; se calculan lead time y cycle time |
| Políticas explícitas | Cada columna expone su `policy` |
| Ciclos de retroalimentación | `/api/metrics` + resultados del pipeline en cada push |

## Pipeline CI/CD

```
1. Lint ─► 2. Pruebas ─► 3. Seguridad ─► 4. Build Docker ─► 5. Deploy Render ─► 6. Verificación en producción
└──────────────── CI (push y PR) ────────────────┘   └──────── CD (solo push a main) ────────┘
```

Ver `.github/workflows/ci-cd.yml` y la guía paso a paso en `GUIA_PASOS_MANUALES.md`.

## Ejecutar localmente

```bash
npm install
npm test        # 21 pruebas
npm run lint
npm start       # http://localhost:3000
```
