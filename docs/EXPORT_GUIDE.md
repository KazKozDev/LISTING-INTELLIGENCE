# Export Guide

Listing Intelligence supports export paths for both individual runs and saved history.

## Available Formats

### JSON

Best for:

- automation
- data pipelines
- preserving full metadata

Typical contents:

- filename
- timestamp
- prompt or task context
- analysis text
- provider and model metadata
- token usage

### CSV

Best for:

- spreadsheet workflows
- bulk review
- simple reporting

Typical columns:

- filename
- timestamp
- task
- analysis
- model
- provider
- token count

### Markdown

Best for:

- readable text reports
- internal notes
- lightweight sharing

The frontend history view exports Markdown for both single runs and combined history archives.

## Where Export Happens

### Single Saved Run

In Run History, each saved entry can be exported as:

- JSON
- CSV
- Markdown

### Full Run History

Run History also supports archive export for all saved entries as:

- JSON
- CSV
- Markdown

## File Naming

Current frontend export naming patterns:

```text
analysis_<filename>_<date>.json
analysis_<filename>_<date>.csv
analysis_<filename>_<date>.md
all_analyses_<date>.json
all_analyses_<date>.csv
all_analyses_<date>.md
```

## Practical Use

### Use JSON when

- another service will consume the output
- metadata and token usage need to be retained
- results should be stored in structured form

### Use CSV when

- results need to be reviewed in Excel or Google Sheets
- multiple runs should be compared quickly
- token usage or model usage should be summarized

### Use Markdown when

- a readable narrative export is preferred
- analysis needs to be copied into docs, tickets, or reports
- a lightweight combined archive is enough

## Related Notes

- The frontend history system stores previous runs locally and exposes export from that archive.
- Backend report generation also exists in the Python codebase, but the current frontend history UX exports JSON, CSV, and Markdown.
- If you need API-facing output formats, use the REST endpoints documented in [API.md](API.md).
