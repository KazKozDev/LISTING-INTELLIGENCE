#!/bin/bash

# Vision Agent Analyst - React + FastAPI Launcher
# Double-click this file to start the app

cd "$(dirname "$0")"

echo "🔄 Stopping existing processes..."
pkill -f "uvicorn api.main" 2>/dev/null
pkill -f "npm run dev" 2>/dev/null
lsof -ti:8000 | xargs kill -9 2>/dev/null
lsof -ti:5173 | xargs kill -9 2>/dev/null

sleep 1

echo "📦 Installing Python dependencies..."
pip install -q fastapi uvicorn python-multipart

echo ""
echo "🚀 Starting FastAPI backend on port 8000..."
python -m uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

sleep 2

echo "🎨 Starting React frontend on port 5173..."
cd frontend && npm run dev &
FRONTEND_PID=$!

cd ..

sleep 3

echo ""
echo "🌐 Opening browser..."
open http://localhost:5173

echo ""
echo "╔════════════════════════════════════════════════╗"
echo "║  ✅ Vision Agent Analyst is running!           ║"
echo "╠════════════════════════════════════════════════╣"
echo "║  🎨 Frontend: http://localhost:5173            ║"
echo "║  🔌 Backend:  http://localhost:8000            ║"
echo "║  📚 API Docs: http://localhost:8000/docs       ║"
echo "╚════════════════════════════════════════════════╝"
echo ""
echo "Press Ctrl+C to stop both servers."
echo ""

# Wait for either process to exit
wait $BACKEND_PID $FRONTEND_PID
