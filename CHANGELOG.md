# Changelog

All notable changes to Vision Agent Analyst.

## [Unreleased]

### Added
- **Industry-Specific Templates**: 7 pre-built analysis templates
  - E-commerce Product Analysis
  - Financial Chart Analysis
  - Medical Image Review
  - Real Estate Floor Plan Analysis
  - Marketing Creative Analysis
  - Logistics Document Analysis
  - Educational Content Analysis
- **Multi-Format Export**: Export results as JSON, CSV, and PDF
  - Single result export (3 formats)
  - Batch export for all analysis history
  - Structured data extraction
- **CleanMyMac-inspired UI**: Modern, premium design
  - Gradient headers and buttons
  - Rounded corners and glassmorphism effects
  - Improved typography and spacing
- **Documentation**: Comprehensive guides
  - Industry Templates Guide
  - Export Formats Guide
  - Quick Start Guide
  - New Features Summary

### Changed
- Simplified UI layout (collapsed sidebar by default)
- Improved file upload interface
- Enhanced analysis result display
- Updated README with new features

### Technical
- Added `src/utils/export.py` for export utilities
- Extended `config/prompts.yaml` with industry templates
- Updated Streamlit theme configuration
- Improved project structure per GenAI standards

## [0.1.0] - Initial Release

### Added
- Multi-provider LLM support (Ollama, OpenAI, Anthropic, Google, Azure)
- Image and PDF analysis capabilities
- Batch processing
- Report generation (Markdown, PDF)
- Web UI (Streamlit)
- CLI interface
- Docker support
