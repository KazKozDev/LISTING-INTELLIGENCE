# Export Formats Guide

Vision Agent Analyst supports multiple export formats to fit different workflows.

## Available Formats

### 1. JSON Export 📄

**Best for**: 
- API integration
- Programmatic processing
- Data pipelines
- Archival storage

**Structure**:
```json
{
  "filename": "product_screenshot.png",
  "timestamp": "2025-12-06T02:30:00",
  "task": "Analyze this e-commerce product...",
  "analysis": "Full analysis text here...",
  "metadata": {
    "model": "gpt-4o",
    "provider": "openai",
    "usage": {
      "total_tokens": 1234
    }
  }
}
```

**Use cases**:
- Feeding results into other systems
- Building analysis databases
- Machine learning training data
- Long-term storage with full context

---

### 2. CSV Export 📊

**Best for**:
- Spreadsheet analysis (Excel, Google Sheets)
- Data visualization
- Bulk data review
- Reporting dashboards

**Columns**:
- Filename
- Timestamp
- Task
- Analysis
- Model
- Provider
- Tokens Used

**Use cases**:
- Creating pivot tables
- Tracking costs (token usage)
- Comparing analyses across files
- Sharing with non-technical stakeholders

---

### 3. PDF Export 📕

**Best for**:
- Client presentations
- Executive reports
- Archival documentation
- Print-ready documents

**Features**:
- Professional formatting
- Branded layout
- Page numbers
- Table of contents (for batch reports)

**Use cases**:
- Stakeholder presentations
- Compliance documentation
- Portfolio pieces
- Client deliverables

---

## Export Options

### Single File Analysis
After analyzing a file, you'll see three export buttons:
- **📄 JSON** - Download as JSON
- **📊 CSV** - Download as CSV
- **📕 PDF** - Download as PDF

### Batch Export (Analysis History)
In the "Analysis History" tab:
- **📄 Export All (JSON)** - All results in one JSON file
- **📊 Export All (CSV)** - All results in one CSV file
- **🗑️ Clear History** - Remove all stored results

## Workflow Examples

### Workflow 1: E-commerce Product Monitoring
1. Analyze competitor product pages daily
2. Export as **CSV**
3. Import into Google Sheets
4. Track price changes and UI updates over time
5. Create charts showing competitive trends

### Workflow 2: Financial Report Generation
1. Analyze quarterly financial charts
2. Export as **JSON**
3. Extract numerical data programmatically
4. Feed into financial modeling tools
5. Generate automated reports

### Workflow 3: Client Deliverable
1. Analyze client's marketing creatives
2. Export as **PDF**
3. Add to presentation deck
4. Share with client for review
5. Archive for future reference

### Workflow 4: Bulk Document Processing
1. Upload 50 invoices (Batch Analysis)
2. Use "Logistics Document Analysis" template
3. Export all as **CSV**
4. Import into accounting software
5. Automate data entry

## Integration Tips

### Google Sheets Integration
1. Export as CSV
2. Open Google Sheets
3. File → Import → Upload
4. Select your CSV file
5. Use built-in formulas for analysis

### Python Integration
```python
import json

# Load JSON export
with open('analysis_results.json') as f:
    data = json.load(f)

# Process results
for item in data:
    print(f"File: {item['filename']}")
    print(f"Analysis: {item['analysis'][:100]}...")
    print(f"Tokens: {item['metadata']['usage']['total_tokens']}")
```

### Excel Integration
1. Export as CSV
2. Open Excel
3. Data → From Text/CSV
4. Select your file
5. Use Power Query for advanced analysis

## Best Practices

1. **Choose format by use case**:
   - JSON for automation
   - CSV for analysis
   - PDF for presentation

2. **Batch export for efficiency**:
   - Analyze multiple files
   - Export all at once
   - Process in bulk

3. **Preserve metadata**:
   - JSON includes full context
   - CSV includes key metrics
   - PDF includes visual formatting

4. **Regular exports**:
   - Don't rely on browser storage
   - Export important results immediately
   - Clear history periodically

## File Naming Convention

All exports use this pattern:
```
analysis_[filename]_[timestamp].ext
all_analyses_[timestamp].ext
```

Example:
```
analysis_product_screenshot.png_20251206_023000.json
all_analyses_20251206_023000.csv
```

## Troubleshooting

**Q: CSV shows garbled text**
A: Open with UTF-8 encoding in your spreadsheet software

**Q: JSON file is too large**
A: Export individual results instead of batch export

**Q: PDF export not available**
A: Install reportlab: `pip install reportlab`

**Q: Can I customize export format?**
A: Yes, edit `src/utils/export.py` for custom formats
