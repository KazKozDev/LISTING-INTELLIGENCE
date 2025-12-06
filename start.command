#!/bin/bash
cd "$(dirname "$0")"

echo "🚀 Starting Vision Agent Analyst (New Architecture)..."

# Check if venv exists
if [ -d "venv" ]; then
    source venv/bin/activate
else
    echo "⚠️  Virtual environment not found. Please run 'python -m venv venv' and install requirements."
fi

# Function to kill processes on exit
cleanup() {
    echo "🛑 Shutting down services..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    exit
}

trap cleanup EXIT INT

# Start Backend
echo "Starting FastAPI Backend..."
python -m uvicorn api.main:app --reload --port 8000 &
BACKEND_PID=$!

# Start Frontend
echo "Starting React Frontend..."
cd frontend
npm run dev -- --host &
FRONTEND_PID=$!

# Wait for services to initialize
echo "⏳ Waiting for services to start..."
sleep 5

# Open Browser
echo "🌐 Opening Browser..."
open http://localhost:5173

echo "✅ App is running! Press Ctrl+C to stop."
wait
