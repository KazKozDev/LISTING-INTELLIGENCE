# Vision Agent Analyst

Multimodal AI agent for analyzing charts, UI screenshots, and PDFs using Ollama with qwen3-vl:8b model.

## Features

- 📊 **Chart Analysis**: Analyze data visualizations and extract insights
- 🖼️ **Screenshot Analysis**: Understand UI elements and layouts
- 📄 **PDF Processing**: Extract and analyze content from PDF documents
- 📝 **Report Generation**: Create comprehensive markdown reports
- 🤖 **Powered by Ollama**: Uses qwen3-vl:8b vision language model

## Prerequisites

1. **Install Ollama**: Download from [ollama.ai](https://ollama.ai)
2. **Pull the model**:
   ```bash
   ollama pull qwen3-vl:8b
   ```

## Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd vision-agent-analyst

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

## Usage

### Command Line Interface

```bash
# Analyze a single image
python main.py analyze image.png --task "Describe this chart"

# Analyze a PDF
python main.py analyze document.pdf --task "Summarize this document"

# Batch analysis
python main.py batch images/ --output reports/

# Interactive mode
python main.py interactive
```

### Python API

```python
from vision_agent import VisionAgent

# Initialize agent
agent = VisionAgent(model="qwen3-vl:8b")

# Analyze an image
result = agent.analyze_image(
    "chart.png",
    task="What insights can you extract from this chart?"
)

print(result.text)
print(result.report)

# Analyze a PDF
pdf_results = agent.analyze_pdf(
    "document.pdf",
    task="Summarize key findings"
)

# Generate report
agent.generate_report(
    results=[result],
    output_path="report.md"
)
```

## Configuration

Create a `.env` file for configuration:

```env
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=qwen3-vl:8b
MAX_TOKENS=2048
TEMPERATURE=0.7
```

## Project Structure

```
vision-agent-analyst/
├── src/
│   ├── __init__.py
│   ├── ollama_client.py    # Ollama API integration
│   ├── vision_agent.py     # Main agent logic
│   ├── pdf_processor.py    # PDF handling
│   ├── report_generator.py # Report creation
│   └── config.py           # Configuration
├── examples/
│   ├── analyze_chart.py
│   ├── analyze_ui.py
│   └── analyze_pdf.py
├── main.py                 # CLI entry point
├── requirements.txt
└── README.md
```

## Examples

### Analyzing a Chart

```python
from vision_agent import VisionAgent

agent = VisionAgent()
result = agent.analyze_image(
    "sales_chart.png",
    task="Analyze this sales chart and identify trends"
)
```

### Analyzing UI Screenshots

```python
result = agent.analyze_image(
    "app_screenshot.png",
    task="Describe the UI elements and suggest improvements"
)
```

### Processing PDFs

```python
results = agent.analyze_pdf(
    "report.pdf",
    task="Extract key metrics and findings"
)
```

## Advanced Usage

### Custom Prompts

```python
custom_task = """
Analyze this image and provide:
1. Main elements identified
2. Data insights
3. Recommendations
"""

result = agent.analyze_image("image.png", task=custom_task)
```

### Batch Processing

```python
import os
from pathlib import Path

image_dir = Path("images/")
results = []

for img_path in image_dir.glob("*.png"):
    result = agent.analyze_image(
        str(img_path),
        task="Analyze this image"
    )
    results.append(result)

agent.generate_report(results, "batch_report.md")
```

## Troubleshooting

### Ollama Connection Issues

```bash
# Check if Ollama is running
ollama list

# Start Ollama service
ollama serve
```

### Model Not Found

```bash
# Pull the required model
ollama pull qwen3-vl:8b

# Verify installation
ollama list | grep qwen3-vl
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License

## Acknowledgments

- Powered by [Ollama](https://ollama.ai)
- Uses Qwen3-VL multimodal model
