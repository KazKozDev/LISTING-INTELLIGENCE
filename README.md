# Vision Agent Analyst

Professional multimodal AI agent for analyzing charts, UI screenshots, and PDF documents. Built with React and FastAPI.

## Who is this for?

- **Business Analysts**: Extract insights from charts, financial reports, and invoices automatically.
- **Developers & Designers**: Review UI screenshots for accessibility, UX improvements, and code generation.
- **E-commerce Managers**: Batch analyze product images for descriptions, tagging, and quality control.
- **Privacy-Conscious Teams**: Run powerful analysis locally using Ollama without sending sensitive data to the cloud.

<img width="1532" height="972" alt="Screenshot 2025-12-06 at 13 47 59" src="https://github.com/user-attachments/assets/910f27df-62a3-45be-af0c-fbb367789d82" />


## Key Benefits

- 🚀 **Automation**: Process hundreds of documents/images in minutes.
- 🔒 **Privacy**: Full support for local execution (Ollama) ensures data sovereignty.
- 📊 **Multimodal**: Handles PDFs, Charts, and UI Screenshots seamlessly.
- 📝 **Professional Reports**: Generates structured Markdown/CSV reports tailored for business use.

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

