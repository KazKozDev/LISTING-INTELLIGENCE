#!/bin/bash
cd "$(dirname "$0")"

# Backend
osascript -e 'tell application "Terminal" to do script "cd '"'"''"$(pwd)"''"'"' && uvicorn api.main:app --reload --port 8000"'

# Frontend
osascript -e 'tell application "Terminal" to do script "cd '"'"''"$(pwd)"'/frontend'"'"' && npm run dev"'

# Open browser after 3 seconds
sleep 3
open http://localhost:5173
