#!/bin/bash

# Vision Agent Analyst - Start Script
# Kills existing process, starts app, opens browser

echo "🔄 Stopping existing Streamlit processes..."
pkill -f "streamlit run app.py"
sleep 1

echo "🚀 Starting Vision Agent Analyst..."
streamlit run app.py &

echo "⏳ Waiting for server to start..."
sleep 3

echo "🌐 Opening browser..."
open http://localhost:8501

echo "✅ Vision Agent Analyst is running!"
echo "📍 URL: http://localhost:8501"
echo ""
echo "To stop: pkill -f 'streamlit run app.py'"
