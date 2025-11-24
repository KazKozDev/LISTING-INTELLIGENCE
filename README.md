# Vision Agent Analyst

Professional multimodal AI agent for analyzing charts, UI screenshots, and PDF documents. Built for business use with support for multiple LLM providers and a modern web interface.

## Features

### Core Capabilities

- **Chart Analysis**: Extract insights from data visualizations and graphs
- **UI Screenshot Analysis**: Evaluate user interfaces and design elements
- **PDF Document Processing**: Analyze multi-page documents with page-by-page analysis
- **Batch Processing**: Analyze multiple files efficiently
- **Report Generation**: Create professional reports in Markdown and JSON formats

### LLM Provider Support

- **Ollama**: Local deployment with models like qwen3-vl:8b
- **OpenAI**: GPT-4 Vision and other vision-capable models
- **Anthropic**: Claude 3 and Claude 3.5 models
- **Google AI**: Gemini models
- **Azure OpenAI**: Enterprise-grade deployment

### Interfaces

- **Web UI**: Professional Streamlit-based interface for business users
- **CLI**: Command-line interface for automation and scripting
- **Python API**: Direct integration into your applications

## Quick Start

### Prerequisites

Choose one of the following LLM providers:

#### Option 1: Ollama (Local, Free)
```bash
# Install Ollama
# Visit: https://ollama.ai

# Pull a vision model
ollama pull qwen3-vl:8b
```

#### Option 2: Cloud Providers
- OpenAI API key
- Anthropic API key
- Google AI API key
- Azure OpenAI deployment

### Installation

```bash
# Clone the repository
git clone https://github.com/KazKozDev/vision-agent-analyst.git
cd vision-agent-analyst

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your provider settings
```

### Configuration

Edit `.env` to configure your LLM provider:

```env
# For Ollama (local)
LLM_PROVIDER=ollama
LLM_MODEL=qwen3-vl:8b
LLM_BASE_URL=http://localhost:11434

# For OpenAI
LLM_PROVIDER=openai
LLM_MODEL=gpt-4o
LLM_API_KEY=your-api-key

# For Anthropic
LLM_PROVIDER=anthropic
LLM_MODEL=claude-3-5-sonnet-20241022
LLM_API_KEY=your-api-key

# For Google AI
LLM_PROVIDER=google
LLM_MODEL=gemini-1.5-pro
LLM_API_KEY=your-api-key

# For Azure OpenAI
LLM_PROVIDER=azure
LLM_MODEL=your-deployment-name
LLM_API_KEY=your-api-key
LLM_BASE_URL=https://your-resource.openai.azure.com
```

## Usage

### Web Interface (Recommended)

```bash
streamlit run app.py
```

Access the professional web interface at `http://localhost:8501`

Features:
- Provider selection and configuration
- Real-time file upload and analysis
- Batch processing
- Analysis history
- Report generation and download

### Command Line Interface

```bash
# Analyze a single image
python main.py analyze chart.png --task "Analyze this chart"

# Analyze a PDF
python main.py analyze document.pdf

# Batch analysis
python main.py batch images/ --output report.md

# Interactive mode
python main.py interactive

# Chart-specific analysis
python main.py chart sales_data.png

# UI screenshot analysis
python main.py ui app_screenshot.png
```

### Python API

```python
from src import VisionAgent

# Initialize with Ollama
agent = VisionAgent(
    provider="ollama",
    model="qwen3-vl:8b"
)

# Or with OpenAI
agent = VisionAgent(
    provider="openai",
    model="gpt-4o",
    api_key="your-api-key"
)

# Analyze an image
result = agent.analyze_image(
    "chart.png",
    task="What insights can you extract from this chart?"
)

print(result.text)
print(f"Tokens used: {result.metadata['usage']['total_tokens']}")

# Analyze a PDF
results = agent.analyze_pdf(
    "document.pdf",
    task="Summarize key findings"
)

# Generate report
agent.generate_report(
    results=[result],
    output_path="report.md",
    title="Analysis Report"
)
```

## Project Structure

```
vision-agent-analyst/
├── src/
│   ├── providers/              # LLM provider implementations
│   │   ├── base.py             # Base provider interface
│   │   ├── ollama_provider.py  # Ollama integration
│   │   ├── openai_provider.py  # OpenAI integration
│   │   ├── anthropic_provider.py
│   │   ├── google_provider.py
│   │   ├── azure_provider.py
│   │   └── factory.py          # Provider factory
│   ├── config.py               # Configuration management
│   ├── vision_agent.py         # Main agent logic
│   ├── pdf_processor.py        # PDF handling
│   └── report_generator.py     # Report creation
├── examples/                   # Usage examples
├── app.py                      # Streamlit web UI
├── main.py                     # CLI interface
├── requirements.txt            # Python dependencies
├── Dockerfile                  # Docker configuration
├── docker-compose.yml          # Docker Compose setup
└── .env.example                # Environment template
```

## Docker Deployment

### Using Docker Compose

```bash
# Start all services
docker-compose up -d

# Access web UI at http://localhost:8501
```

### Using Docker

```bash
# Build image
docker build -t vision-agent-analyst .

# Run container
docker run -p 8501:8501 \
  -e LLM_PROVIDER=openai \
  -e LLM_API_KEY=your-key \
  vision-agent-analyst
```

## Advanced Usage

### Switching Providers at Runtime

```python
# Start with Ollama
agent = VisionAgent(provider="ollama")

# Analyze with OpenAI
result = agent.analyze_image(
    "image.png",
    task="Analyze this",
    provider="openai",
    model="gpt-4o",
    api_key="your-key"
)
```

### Custom Analysis Prompts

```python
custom_prompt = """
Analyze this business dashboard and provide:
1. Key performance indicators visible
2. Trend analysis
3. Areas of concern
4. Strategic recommendations
"""

result = agent.analyze_image("dashboard.png", task=custom_prompt)
```

### Batch Processing with Different Providers

```python
files = ["chart1.png", "chart2.png", "report.pdf"]

results = agent.batch_analyze(
    file_paths=files,
    task="Extract key business metrics",
    temperature=0.5,
    max_tokens=1500
)
```

## Provider Comparison

| Provider   | Vision Support | Local | API Key | Cost      | Best For                |
|-----------|---------------|-------|---------|-----------|-------------------------|
| Ollama    | Yes           | Yes   | No      | Free      | Development, privacy    |
| OpenAI    | Yes           | No    | Yes     | Pay-per-use | Production, accuracy |
| Anthropic | Yes           | No    | Yes     | Pay-per-use | Long documents         |
| Google AI | Yes           | No    | Yes     | Pay-per-use | Multimodal tasks       |
| Azure     | Yes           | No    | Yes     | Enterprise | Corporate deployments  |

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Security

For security concerns, please see [SECURITY.md](SECURITY.md).

## License

This project is licensed under the MIT License - see [LICENSE](LICENSE) for details.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history and changes.

## Support

- Documentation: [README.md](README.md), [QUICKSTART.md](QUICKSTART.md)
- Issues: [GitHub Issues](https://github.com/KazKozDev/vision-agent-analyst/issues)
- Discussions: [GitHub Discussions](https://github.com/KazKozDev/vision-agent-analyst/discussions)

## Acknowledgments

- Powered by multiple LLM providers
- Built with Streamlit for the web interface
- PDF processing with PyMuPDF
- Thanks to all contributors
