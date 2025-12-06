# Vision Agent Analyst

Professional multimodal AI agent for analyzing charts, UI screenshots, and PDF documents. Built with React and FastAPI.

## Prerequisites

- **Required**: [Ollama](https://ollama.ai) with `qwen3-vl:8b` model (Recommended for local use)
  ```bash
  ollama pull qwen3-vl:8b
  ```
- **Optional**: API keys for OpenAI, Anthropic, Google Gemini (if using cloud providers).

## Installation

```bash
# Clone
git clone https://github.com/KazKozDev/vision-agent-analyst.git
cd vision-agent-analyst

# Setup Backend (Python)
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Setup Frontend (React)
cd frontend
npm install
cd ..

# Configuration
cp .env.example .env
# Edit .env to set LLM_PROVIDER (ollama/openai/anthropic) and API keys
```

## Running the App

The easiest way to start both backend and frontend:

```bash
./start.command
```

Access the interface at: `http://localhost:5173`

## Features

- **Multimodal**: Analyze Images (Charts, UI) and PDFs (with page-by-page analysis).
- **Multi-Provider**: Switch between local (Ollama) and cloud (GPT-4, Claude 3.5, Gemini).
- **History**: Save and export analysis reports (Markdown/CSV).
- **Templates**: Pre-built prompts for Finance, Medical, E-commerce, etc.
