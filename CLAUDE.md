@AGENTS.md

## Orquestador (`.claude/agents/orquestador.md`)

Cuando el usuario pida una tarea sin indicar el equipo, sigue el flujo del agente `orquestador`: clasifica la tarea (backend, frontend, ambos o despliegue), delega en los agentes de ese equipo y, si trabajó backend o frontend, termina siempre con el equipo de despliegue (`deploy-committer` → `deploy-vercel`).

## Flujo de agentes de backend (`.claude/agents/backend/`)

Para cualquier requerimiento de backend, sigue este orden:

1. `backend-planner` → escribe el plan en `planifications/`.
2. `backend-migrations` → migraciones SQL en `supabase/migrations/` según el plan.
3. `backend-api` → Route Handlers en `app/api/` (y servicios en `lib/`) según el plan y las migraciones.
4. `backend-validator` → nota del 1 al 10 para migraciones y para API por separado (7 o más = aprobado).
5. Si alguno sale RECHAZADO, vuelve a invocar al agente correspondiente (`backend-migrations` y/o `backend-api`) pasándole el plan y las observaciones del informe, y luego vuelve a invocar `backend-validator`. Repite hasta que ambos estén aprobados (máximo 3 ciclos; después, informa al usuario).
