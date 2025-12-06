# Vision Agent Analyst

Vision Agent Analyst is a multimodal AI application designed to automate the analysis of visual data including financial charts, user interface screenshots, and multi-page PDF documents. By leveraging advanced Large Language Models (LLMs) through a unified interface, it enables businesses to extract structured insights, generate detailed reports, and perform quality assurance tasks without manual intervention.

The application is built on a modern architecture combining a FastAPI backend for robust processing and a React frontend for an intuitive user experience. It supports both privacy-focused local execution via Ollama and scalable cloud-based analysis through major providers such as OpenAI, Anthropic, and Google.

<img width="1532" height="972" alt="Screenshot 2025-12-06 at 13 47 59" src="https://github.com/user-attachments/assets/aa0942cb-0472-4dec-a033-113e4f39934c" />

## Features

- **Multimodal Analysis**: Capabilities to process and interpret complex visual inputs, including data visualizations, application interfaces, and scanned documents.
- **Multi-Provider Support**: Seamless integration with Ollama for local inference and cloud APIs (OpenAI, Anthropic, Google Gemini, Azure OpenAI) for enhanced performance.
- **Document Processing**: Specialized handling for PDF documents, performing page-by-page analysis to extract text and visual context.
- **Export Capabilities**: Generation of structured outputs in Markdown and CSV formats for easy integration with downstream workflows.
- **Template System**: Pre-configured analysis templates for specific domains such as Finance, Medical, E-commerce, and UI/UX design.
- **Detailed Audit Logging**: Comprehensive logging of API interactions and analysis steps for debugging and compliance.

## Prerequisites

Ensure the following dependencies are installed on the host system:

- **Python**: Version 3.11 or higher
- **Node.js**: Version 18 or higher (for the frontend interface)
- **Ollama** (Optional): For local model execution. The `qwen3-vl:8b` model is recommended.

## Installation

Clone the repository and set up the environment using the following steps:

1. **Clone the repository**
   ```bash
   git clone https://github.com/KazKozDev/vision-agent-analyst.git
   cd vision-agent-analyst
   ```

2. **Setup Backend**
   Initialize the Python virtual environment and install dependencies.
   ```bash
   python -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```

3. **Setup Frontend**
   Install the required Node.js packages.
   ```bash
   cd frontend
   npm install
   cd ..
   ```

## Configuration

The application is configured via environment variables. Copy the example configuration file to begin.

```bash
cp .env.example .env
```

Edit the `.env` file to define your preferred LLM provider and credentials.

### Configuration Variables

| Variable | Description |
|----------|-------------|
| `LLM_PROVIDER` | Specifies the LLM provider (ollama, openai, anthropic, google, azure). Default: `ollama` |
| `LLM_MODEL` | The specific model identifier (e.g., `qwen3-vl:8b`, `gpt-4o`). |
| `LLM_BASE_URL` | Base URL for the API (required for Ollama and Azure). |
| `OPENAI_API_KEY` | API key for OpenAI (required if provider is openai). |
| `ANTHROPIC_API_KEY` | API key for Anthropic (required if provider is anthropic). |

## Usage

### Starting the Application

Use the provided startup script to launch both the backend API and the frontend interface simultaneously.

```bash
./start.command
```

The web interface will automatically open at `http://localhost:5173`.

### Manual Startup

Alternatively, services can be started individually.

**Backend API**:
```bash
source venv/bin/activate
uvicorn api.main:app --reload --port 8000
```

**Frontend Interface**:
```bash
cd frontend
npm run dev
```

## License

This project is licensed under the MIT License.
