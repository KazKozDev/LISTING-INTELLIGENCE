# Quick Start: New Features

## Industry Templates (2 minutes)

1. **Launch the app**:
   ```bash
   streamlit run app.py
   ```

2. **Upload a file** (e.g., product screenshot from Amazon)

3. **Select "Industry-Specific"** from Analysis Category

4. **Choose "E-commerce Product Analysis"**

5. **Click "🚀 Analyze File"**

6. **Get detailed analysis** covering:
   - Pricing strategy
   - Visual hierarchy
   - UX assessment
   - Conversion optimization tips

---

## Export Results (30 seconds)

After analysis completes:

1. **Click 📄 JSON** to download structured data
2. **Click 📊 CSV** to open in Excel/Sheets
3. **Click 📕 PDF** for professional report

---

## Batch Export (1 minute)

1. Analyze multiple files
2. Go to **"Analysis History"** tab
3. Click **"📄 Export All (JSON)"** or **"📊 Export All (CSV)"**
4. Import into your workflow

---

## Example Workflows

### E-commerce Monitoring
```
1. Screenshot competitor products daily
2. Use "E-commerce Product Analysis" template
3. Export as CSV
4. Track price changes in Google Sheets
```

### Financial Analysis
```
1. Upload stock charts
2. Use "Financial Chart Analysis" template
3. Export as JSON
4. Extract data programmatically
5. Feed into financial models
```

### Real Estate Evaluation
```
1. Upload floor plans
2. Use "Real Estate Floor Plan Analysis" template
3. Export as PDF
4. Share with clients
```

---

## Customization

### Add Your Own Template

Edit `config/prompts.yaml`:

```yaml
industry_templates:
  your_industry:
    name: "Your Industry Name"
    description: "What this analyzes"
    prompt: |
      Your analysis instructions here...
```

Restart app to see new template.

---

## Tips

✅ **Use the right template** - Each is optimized for specific use cases
✅ **Preview prompts** - Click "View Prompt Template" to see what will be analyzed
✅ **Export early** - Don't rely on browser storage
✅ **Batch process** - Analyze similar files together for efficiency

---

## Need Help?

- **Templates**: See `docs/INDUSTRY_TEMPLATES.md`
- **Export**: See `docs/EXPORT_GUIDE.md`
- **Full docs**: See `README.md`
