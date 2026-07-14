# Missing / private components

Este archivo enumera qué partes de `~/.openclaw/` **no** se subieron a GitHub en el backup seguro, por qué faltan y cómo recuperarlas.

## Criterio

- **Subido al repo**: configuración segura, sanitizada, scripts y documentación.
- **No subido**: secretos, tokens, estado volátil, colas runtime, logs, bases internas y archivos sensibles.

## Lo que sí está en GitHub

- `openclaw-recovery/openclaw.template.json`
- `openclaw-recovery/RESTORE.md`
- este archivo

## Lo que falta reponer o recrear

| Ruta en `~/.openclaw/` | Estado | Motivo | Qué hacer al restaurar |
|---|---|---|---|
| `openclaw.json` real | **No subido** | contiene secretos | copiar `openclaw.template.json`, reemplazar placeholders y guardarlo como `~/.openclaw/openclaw.json` |
| `credentials/` | **No subido** | tokens y credenciales sensibles | restaurar desde backup privado o volver a autenticar Discord, Notion y otros servicios |
| `credentials-backup/` | **No subido** | histórico sensible | restaurar solo desde backup privado si hace falta |
| `identity/` | **No subido** | identidad de dispositivo / auth local | dejar que OpenClaw la regenere o restaurarla desde backup privado |
| `gateway auth token` | **No subido** | secreto | volver a ponerlo manualmente en `openclaw.json` |
| `channels.discord.token` | **No subido** | secreto | volver a ponerlo manualmente en `openclaw.json` |
| `env.NOTION_TOKEN` | **No subido** | secreto | volver a ponerlo manualmente en `openclaw.json` o en un env privado |
| `env.OLLAMA_API_KEY` / `models.providers.ollama.apiKey` | **Sanitizado** | secreto menor pero igual privado | reponer el valor real si cambia del placeholder |
| `cron/jobs.json` | **No subido** | estado operativo cambiante | recrear manualmente los cron jobs que quieras conservar |
| `devices/paired.json` y `devices/pending.json` | **No subido** | pairing sensible / estado efímero | volver a emparejar dispositivos si hace falta |
| `exec-approvals.json` | **No subido** | historial sensible / runtime | dejar que se regenere |
| `flows/registry.sqlite*` | **No subido** | base interna runtime | dejar que se regenere |
| `tasks/runs.sqlite*` | **No subido** | historial interno runtime | dejar que se regenere |
| `memory/main.sqlite` | **No subido** | índice/estado interno | dejar que se regenere |
| `subagents/runs.json` | **No subido** | estado efímero | dejar que se regenere |
| `delivery-queue/` | **No subido** | cola runtime efímera | dejar que se regenere |
| `logs/` | **No subido** | logs sensibles / no necesarios | opcional, no hace falta restaurarlos |
| `media/` | **No subido** | adjuntos / datos privados | no restaurar salvo necesidad puntual |
| `publish/` | **No subido** | artefactos locales opcionales | recrear si esa publicación sigue siendo necesaria |
| `state-recovery/` | **No subido** | backups internos sensibles | conservar solo en backup privado |
| `update-check.json` | **No subido** | cache efímera | dejar que se regenere |

## También importante fuera de `~/.openclaw/`

Además de `~/.openclaw/`, tu instalación real depende de archivos del workspace que sí conviene versionar o respaldar:

- `AGENTS.md`
- `SOUL.md`
- `USER.md`
- `TOOLS.md`
- `SESSION_SYNC.md`
- `MEMORY.md`
- `skills/`
- `scripts/`
- `notion/`
- `expenses/`
- `memory/*.md`
- `DEV_INTEROP.md`
- `GUIA-RECUPERAR-CODEX-Y-ATILA.md`
- otros docs operativos que quieras conservar

## Resultado esperado

Con lo ya subido a GitHub + esta guía, podés reconstruir:

- la forma principal de configuración de OpenClaw
- el comportamiento de Discord/TTS/Ollama
- qué secretos faltan
- qué directorios no deberían versionarse
- qué partes hay que restaurar manualmente o desde backup privado
