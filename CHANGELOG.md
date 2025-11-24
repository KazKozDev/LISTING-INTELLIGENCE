# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Multi-provider LLM support (Ollama, OpenAI, Anthropic, Google, Azure)
- Professional business web UI with Streamlit
- Provider abstraction layer for easy provider switching
- Comprehensive configuration system with environment variables
- Support for multiple vision-capable models
- Batch processing capabilities
- Analysis history tracking
- Report generation in Markdown and JSON formats
- CLI interface with multiple commands
- Interactive analysis mode
- Specialized analysis for charts and UI screenshots
- PDF document analysis with page-by-page processing

### Changed
- Refactored codebase to use provider abstraction
- Improved configuration management
- Enhanced error handling and logging

## [0.1.0] - 2024-11-24

### Added
- Initial release
- Basic Ollama integration with qwen3-vl:8b
- Image analysis capabilities
- PDF processing
- Report generation
- CLI interface
- Example scripts
- Comprehensive documentation

[Unreleased]: https://github.com/KazKozDev/vision-agent-analyst/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/KazKozDev/vision-agent-analyst/releases/tag/v0.1.0
