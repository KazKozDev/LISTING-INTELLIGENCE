# Quick Start Guide

## 1. Setup Ollama

First, install and setup Ollama with the qwen3-vl:8b model:

```bash
# Install Ollama (if not already installed)
# Visit: https://ollama.ai

# Pull the model
ollama pull qwen3-vl:8b

# Start Ollama (if not running)
ollama serve
```

## 2. Install Dependencies

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install requirements
pip install -r requirements.txt
```

## 3. Basic Usage

### Analyze an Image

```bash
# Simple analysis
python main.py analyze image.png

# With custom task
python main.py analyze chart.png --task "Extract data from this chart"

# Save report
python main.py analyze screenshot.png --output report.md
```

### Analyze a PDF

```bash
python main.py analyze document.pdf --task "Summarize this document"
```

### Batch Analysis

```bash
# Analyze all images in a directory
python main.py batch images/ --output batch_report.md
```

### Interactive Mode

```bash
# Start interactive session
python main.py interactive

# Or with a specific file
python main.py interactive myfile.png
```

### Specialized Analysis

```bash
# Chart analysis with default prompts
python main.py chart sales_data.png

# UI analysis with default prompts
python main.py ui app_screenshot.png
```

## 4. Python API Usage

```python
from src import VisionAgent

# Initialize
agent = VisionAgent(model="qwen3-vl:8b")

# Analyze image
result = agent.analyze_image("chart.png", task="Describe this chart")
print(result.text)

# Generate report
agent.generate_report([result], output_path="report.md")
```

## 5. Configuration

Create a `.env` file (copy from `.env.example`):

```env
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=qwen3-vl:8b
MAX_TOKENS=2048
TEMPERATURE=0.7
OUTPUT_DIR=outputs
```

## 6. Examples

Check the `examples/` directory for detailed usage examples:

- `analyze_chart.py` - Chart analysis
- `analyze_ui.py` - UI screenshot analysis
- `analyze_pdf.py` - PDF document analysis
- `batch_analysis.py` - Batch processing
- `custom_analysis.py` - Custom analysis prompts

## Troubleshooting

### Connection Error

```bash
# Make sure Ollama is running
ollama serve

# Check if model is available
ollama list | grep qwen3-vl
```

### Model Not Found

```bash
# Pull the model
ollama pull qwen3-vl:8b
```

### Import Errors

```bash
# Make sure you're in the virtual environment
source venv/bin/activate

# Reinstall dependencies
pip install -r requirements.txt
```

## Next Steps

- Read the full [README.md](README.md) for detailed documentation
- Explore example scripts in `examples/`
- Customize analysis prompts for your specific use case
- Integrate into your own applications using the Python API
