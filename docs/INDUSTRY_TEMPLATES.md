# Industry-Specific Templates

Vision Agent Analyst includes pre-built analysis templates optimized for specific industries and use cases.

## Available Templates

### 1. E-commerce Product Analysis
**Use Case**: Analyze product cards, listings, and marketplace screenshots

**What it analyzes**:
- Pricing and discount presentation
- Visual hierarchy and layout
- Product information clarity
- UX assessment
- Competitive positioning

**Best for**: Marketplace sellers, e-commerce managers, conversion optimization specialists

---

### 2. Financial Chart Analysis
**Use Case**: Extract data from financial charts and dashboards

**What it analyzes**:
- Numerical data extraction
- Chart structure and type
- Trend analysis
- Key metrics identification
- Structured data output (tables)

**Best for**: Financial analysts, traders, investment researchers

---

### 3. Medical Image Review
**Use Case**: Describe medical images and scans (educational purposes only)

**Disclaimer**: For educational and documentation purposes only. Not for medical diagnosis.

**What it analyzes**:
- Image type and quality
- Visible anatomical structures
- Technical details
- Objective observations

**Best for**: Medical educators, documentation specialists, researchers

---

### 4. Real Estate Floor Plan Analysis
**Use Case**: Evaluate property layouts and floor plans

**What it analyzes**:
- Layout overview and room count
- Space efficiency
- Functional assessment
- Ergonomics and livability
- Market positioning

**Best for**: Real estate agents, property developers, interior designers

---

### 5. Marketing Creative Analysis
**Use Case**: Analyze ads, banners, and marketing materials

**What it analyzes**:
- Visual impact
- Messaging effectiveness
- Design elements
- Target audience fit
- Conversion optimization
- Competitive benchmarking

**Best for**: Marketing managers, creative directors, growth marketers

---

### 6. Logistics Document Analysis
**Use Case**: Analyze shipping documents, invoices, and package labels

**What it analyzes**:
- Document type identification
- Shipment details
- Item information
- Financial data
- Condition assessment
- Compliance verification

**Best for**: Logistics coordinators, warehouse managers, supply chain analysts

---

### 7. Educational Content Analysis
**Use Case**: Analyze diagrams, textbook pages, and learning materials

**What it analyzes**:
- Content type and level
- Learning objectives
- Visual pedagogy
- Accessibility
- Engagement factors

**Best for**: Teachers, instructional designers, educational publishers

## How to Use

1. **Upload your file** (image or PDF)
2. **Select "Industry-Specific"** from Analysis Category
3. **Choose your industry template** from the dropdown
4. **Review the prompt** (optional - click "View Prompt Template")
5. **Click "Analyze File"**

## Export Options

All analysis results can be exported in multiple formats:

- **JSON**: Structured data with full metadata
- **CSV**: Tabular format for spreadsheet import
- **PDF**: Professional formatted report

## Custom Templates

To add your own industry template:

1. Edit `config/prompts.yaml`
2. Add a new entry under `industry_templates`:

```yaml
your_industry:
  name: "Your Industry Name"
  description: "Brief description of what this analyzes"
  prompt: |
    Your detailed analysis prompt here...
    
    1. Section 1
    2. Section 2
    etc.
```

3. Restart the application

## Best Practices

1. **Choose the right template**: Select the template that best matches your use case
2. **Review the prompt**: Click "View Prompt Template" to understand what will be analyzed
3. **Export strategically**: 
   - Use JSON for programmatic processing
   - Use CSV for data analysis in Excel/Sheets
   - Use PDF for sharing with stakeholders
4. **Batch processing**: For multiple similar files, use the Batch Analysis tab with your chosen template

## Examples

### E-commerce Example
Upload a product screenshot from Amazon/eBay and get:
- Price positioning analysis
- CTA button effectiveness
- Trust signal assessment
- Conversion optimization tips

### Finance Example
Upload a stock chart and get:
- Extracted numerical data in table format
- Trend direction and volatility
- Key support/resistance levels
- Actionable insights

### Real Estate Example
Upload a floor plan and get:
- Room count and dimensions
- Traffic flow assessment
- Privacy and noise considerations
- Target demographic fit
