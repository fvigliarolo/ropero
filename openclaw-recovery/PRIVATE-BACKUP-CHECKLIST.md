# Private backup checklist

Este archivo **no** contiene secretos reales. Es una checklist de qué conviene guardar en un backup privado aparte de GitHub para poder reconstruir Atila/OpenClaw casi sin dolor.

## Objetivo

Combinar:
- **GitHub público/seguro** para config sanitizada, scripts y documentación
- **backup privado** para secretos, identidad y estado sensible

## Guardar en backup privado

### 1. Secretos principales

Guardar los valores reales de:

- Discord bot token
- Gateway auth token
- Notion token
- Ollama API key (si aplica)
- cualquier otro token/API key agregado después

## 2. Archivos de credenciales

Respaldar, si siguen siendo válidos/útiles:

- `~/.openclaw/credentials/`
- `~/.openclaw/credentials-backup/`

Especial atención a cualquier credencial de:
- Discord
- WhatsApp
- integraciones futuras
- archivos `.env` privados fuera del repo

## 3. Identidad y pairing

Respaldar:

- `~/.openclaw/identity/`
- `~/.openclaw/devices/`

Esto puede ahorrar re-pairings o recreación de identidad local.

## 4. Cron y automatizaciones

Si querés recuperar automatizaciones exactamente como estaban, guardar:

- `~/.openclaw/cron/jobs.json`
- cualquier referencia externa necesaria para esos jobs

## 5. Estado interno opcional

No siempre hace falta, pero puede servir en una recuperación muy fiel:

- `~/.openclaw/state-recovery/`
- `~/.openclaw/exec-approvals.json`
- `~/.openclaw/subagents/runs.json`

## 6. Workspace sensible o importante

Aunque parte de esto ya pueda vivir en GitHub, conviene un backup privado completo del workspace por si el repo no está al día o hay cosas locales no publicadas:

- `~/.openclaw/workspace/skills/`
- `~/.openclaw/workspace/scripts/`
- `~/.openclaw/workspace/notion/`
- `~/.openclaw/workspace/expenses/`
- `~/.openclaw/workspace/memory/`
- `~/.openclaw/workspace/MEMORY.md`
- `~/.openclaw/workspace/SESSION_SYNC.md`
- `~/.openclaw/workspace/TOOLS.md`
- `~/.openclaw/workspace/AGENTS.md`
- `~/.openclaw/workspace/SOUL.md`
- `~/.openclaw/workspace/USER.md`

## 7. Cosas que NO hace falta priorizar

Normalmente no vale la pena guardar, salvo caso puntual:

- `~/.openclaw/logs/`
- `~/.openclaw/delivery-queue/`
- `~/.openclaw/media/inbound/`
- caches efímeras
- sqlite temporales de runtime, salvo que quieras una restauración muy exacta

## Checklist práctica

### Backup público (GitHub)
- [ ] `openclaw-recovery/openclaw.template.json`
- [ ] `openclaw-recovery/RESTORE.md`
- [ ] `openclaw-recovery/MISSING-COMPONENTS.md`
- [ ] scripts, skills y docs importantes del workspace

### Backup privado
- [ ] secretos reales copiados a un lugar seguro
- [ ] `~/.openclaw/credentials/`
- [ ] `~/.openclaw/identity/`
- [ ] `~/.openclaw/devices/`
- [ ] `~/.openclaw/cron/jobs.json`
- [ ] snapshot privado del workspace completo

## Recomendación operativa

Idealmente tener dos backups:

1. **GitHub repo** con todo lo seguro/versionable
2. **archivo cifrado o carpeta privada** con secretos y estado sensible

Así, si pasa una catástrofe:
- desde GitHub reconstruís la estructura y config
- desde el backup privado reponés lo que no conviene publicar
