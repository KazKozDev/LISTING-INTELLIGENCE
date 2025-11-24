# Contributing to Vision Agent Analyst

Thank you for your interest in contributing to Vision Agent Analyst. This document provides guidelines for contributing to the project.

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct (see CODE_OF_CONDUCT.md).

## How to Contribute

### Reporting Bugs

Before creating bug reports, please check existing issues to avoid duplicates. When creating a bug report, include:

- A clear and descriptive title
- Detailed steps to reproduce the issue
- Expected behavior vs actual behavior
- System information (OS, Python version, etc.)
- Relevant logs or error messages

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, include:

- A clear and descriptive title
- Detailed description of the proposed functionality
- Explanation of why this enhancement would be useful
- Possible implementation approach (if applicable)

### Pull Requests

1. Fork the repository
2. Create a new branch for your feature (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Write or update tests as needed
5. Update documentation as needed
6. Commit your changes (`git commit -m 'Add amazing feature'`)
7. Push to your branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

#### Pull Request Guidelines

- Follow the existing code style
- Write clear, descriptive commit messages
- Include tests for new functionality
- Update documentation for user-facing changes
- Keep pull requests focused on a single feature or fix
- Reference related issues in your PR description

## Development Setup

### Prerequisites

- Python 3.8+
- pip or conda for package management

### Setup Steps

1. Clone your fork:
   ```bash
   git clone https://github.com/your-username/vision-agent-analyst.git
   cd vision-agent-analyst
   ```

2. Create a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Copy environment configuration:
   ```bash
   cp .env.example .env
   ```

5. Configure your LLM provider in `.env`

### Running Tests

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=src tests/

# Run specific test file
pytest tests/test_providers.py
```

### Code Style

We follow PEP 8 guidelines. Please ensure your code:

- Uses 4 spaces for indentation
- Has maximum line length of 100 characters
- Includes docstrings for functions and classes
- Uses type hints where appropriate

Format code before committing:
```bash
# Install formatting tools
pip install black isort flake8

# Format code
black src/
isort src/

# Check style
flake8 src/
```

## Project Structure

```
vision-agent-analyst/
├── src/
│   ├── providers/          # LLM provider implementations
│   ├── config.py           # Configuration management
│   ├── vision_agent.py     # Main agent logic
│   ├── pdf_processor.py    # PDF handling
│   └── report_generator.py # Report generation
├── examples/               # Usage examples
├── tests/                  # Test suite
├── app.py                  # Web UI
└── main.py                 # CLI interface
```

## Adding a New LLM Provider

To add support for a new LLM provider:

1. Create a new file in `src/providers/` (e.g., `newprovider_provider.py`)
2. Implement the `BaseLLMProvider` interface
3. Register the provider in `src/providers/factory.py`
4. Add configuration in `src/config.py`
5. Update documentation
6. Add tests

Example template:

```python
from .base import BaseLLMProvider, ProviderResponse

class NewProvider(BaseLLMProvider):
    def __init__(self, model, api_key, base_url, **kwargs):
        super().__init__(model, api_key, base_url, **kwargs)
        # Initialize provider client

    def verify_connection(self) -> bool:
        # Implement connection verification
        pass

    def analyze_image(self, image_path, prompt, temperature, max_tokens, **kwargs):
        # Implement image analysis
        pass

    def chat(self, messages, temperature, max_tokens, **kwargs):
        # Implement chat completion
        pass

    # ... implement other required methods
```

## Documentation

- Update README.md for user-facing changes
- Update docstrings for code changes
- Add examples for new features
- Update CHANGELOG.md for notable changes

## Questions?

Feel free to open an issue for questions about contributing.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
