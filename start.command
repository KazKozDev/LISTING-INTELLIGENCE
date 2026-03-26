#!/bin/bash
# ─────────────────────────────────────────────
# Listing Intelligence — one-click launcher
# Double-click this file to start the app
# ─────────────────────────────────────────────
set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
VENV_DIR="$PROJECT_DIR/.venv"

# ── Colors ──
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

quote_shell() {
    printf '%q' "$1"
}

open_terminal_tab() {
    local command="$1"

    osascript - "$command" <<'APPLESCRIPT'
on run argv
    tell application "Terminal"
        activate
        do script (item 1 of argv)
    end tell
end run
APPLESCRIPT
}

wait_for_port() {
    local port="$1"
    local name="$2"
    local attempts=20

    while [ "$attempts" -gt 0 ]; do
        if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
            echo -e "${GREEN}✓ ${name} started on :${port}${NC}"
            return 0
        fi

        sleep 1
        attempts=$((attempts - 1))
    done

    echo -e "${RED}✗ ${name} did not start on :${port}${NC}"
    return 1
}

echo -e "${GREEN}━━━ Listing Intelligence ━━━${NC}"
echo ""

# ── 1. Python: create venv if missing ──
if [ ! -d "$VENV_DIR" ]; then
    echo -e "${YELLOW}Creating virtual environment...${NC}"
    python3 -m venv "$VENV_DIR"
    echo -e "${GREEN}✓ Virtual environment created${NC}"
fi

# Activate venv
source "$VENV_DIR/bin/activate"
export PYTORCH_ENABLE_MPS_FALLBACK="${PYTORCH_ENABLE_MPS_FALLBACK:-1}"

# ── 2. Install Python deps if needed ──
if ! python -c "import fastapi" 2>/dev/null; then
    echo -e "${YELLOW}Installing Python dependencies...${NC}"
    pip install -e "$PROJECT_DIR[dev]" --quiet
    echo -e "${GREEN}✓ Python dependencies installed${NC}"
fi

# ── 3. Node.js: load nvm if available ──
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
    source "$NVM_DIR/nvm.sh"
fi

# Check node exists
if ! command -v node &>/dev/null; then
    echo -e "${RED}✗ Node.js not found. Install it: https://nodejs.org${NC}"
    exit 1
fi

# ── 4. Install frontend deps if needed ──
if [ ! -d "$PROJECT_DIR/frontend/node_modules" ]; then
    echo -e "${YELLOW}Installing frontend dependencies...${NC}"
    cd "$PROJECT_DIR/frontend" && npm install --silent
    echo -e "${GREEN}✓ Frontend dependencies installed${NC}"
fi

# ── 5. Check Ollama ──
if command -v ollama &>/dev/null; then
    echo -e "${GREEN}✓ Ollama found${NC}"
else
    echo -e "${YELLOW}⚠ Ollama not found — install from https://ollama.com if using local models${NC}"
fi

echo ""

# ── 6. Start backend in a new Terminal tab ──
BACKEND_CMD="source $(quote_shell "$VENV_DIR/bin/activate") && export PYTORCH_ENABLE_MPS_FALLBACK=1 && cd $(quote_shell "$PROJECT_DIR") && uvicorn api.main:app --reload --port 8000"
open_terminal_tab "$BACKEND_CMD"

# ── 7. Start frontend in a new Terminal tab ──
LOAD_NVM=""
if [ -s "$NVM_DIR/nvm.sh" ]; then
    LOAD_NVM="export NVM_DIR=$(quote_shell "$NVM_DIR") && source $(quote_shell "$NVM_DIR/nvm.sh") && "
fi

FRONTEND_CMD="${LOAD_NVM}cd $(quote_shell "$PROJECT_DIR/frontend") && npm run dev"
open_terminal_tab "$FRONTEND_CMD"

BACKEND_OK=0
FRONTEND_OK=0

wait_for_port 8000 "Backend" || BACKEND_OK=1
wait_for_port 5173 "Frontend" || FRONTEND_OK=1
echo ""

# ── 8. Open browser ──
if [ "$FRONTEND_OK" -eq 0 ]; then
    open http://localhost:5173
    echo -e "${GREEN}✓ Browser opened — ready to go!${NC}"
else
    echo -e "${YELLOW}⚠ Frontend did not become ready automatically. Check the opened Terminal tab for details.${NC}"
fi

if [ "$BACKEND_OK" -ne 0 ] || [ "$FRONTEND_OK" -ne 0 ]; then
    exit 1
fi
