# OpenClaw recovery

Este backup sirve para reconstruir la config de Atila sin subir secretos a GitHub.

## Archivos

- `openclaw.template.json`: copia sanitizada de `~/.openclaw/openclaw.json`
- `MISSING-COMPONENTS.md`: inventario explícito de lo que no se subió, por qué y cómo reponerlo

## Qué tenés que reponer a mano

Reemplazá estos placeholders antes de usar la config:

- `__REPLACE_DISCORD_TOKEN__`
- `__REPLACE_GATEWAY_AUTH_TOKEN__`
- `__REPLACE_NOTION_TOKEN__`
- `__REPLACE_OLLAMA_API_KEY__`

## Restore rápido

1. Instalar OpenClaw.
2. Copiar `openclaw.template.json` a `~/.openclaw/openclaw.json`.
3. Reemplazar los placeholders por los valores reales.
4. Reiniciar gateway:
   - `openclaw gateway restart`
5. Verificar estado:
   - `openclaw gateway status`

## Estado capturado en este backup

- OpenClaw: `2026.4.14 (323493f)`
- Gateway bind: `127.0.0.1:18789`
- Modelo principal esperado: `openai-codex/gpt-5.4`
- Ollama local configurado con:
  - `qwen3:0.6b`
  - `llama3.2:1b`
  - `llama3.1:8b`
- Discord voice/TTS activo con:
  - voz `es-UY-MateoNeural`
  - `lang=es-UY`
  - `pitch=-4Hz`
  - `rate=+6%`
- Discord exec approvals: habilitados
- Discord thread-bound subagent spawns: habilitados

## Notas

- Este backup no incluye credenciales reales.
- Este backup tampoco pretende ser una copia literal de todo `~/.openclaw/`. Es un espejo seguro de la config principal más una guía explícita de lo que falta.
- Para ver exactamente qué no se subió y qué deberías recrear o restaurar, mirá `MISSING-COMPONENTS.md`.
- Si además querés una recuperación total de Atila, este repo también debería conservar tus skills locales, scripts y archivos de workspace relevantes.
- La config real fuente en esta máquina vive en `~/.openclaw/openclaw.json`.
