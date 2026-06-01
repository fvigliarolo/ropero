#!/usr/bin/env bash
set -euo pipefail
cd /home/fede/.openclaw/workspace/tmp/wardrobe-viewer
PORT="${PORT:-4782}"
echo "Levantando viewer en puerto ${PORT}"
node server.js
