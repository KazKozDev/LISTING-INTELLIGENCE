# E-Commerce Guide

Vision Agent Analyst includes specialized tools for e-commerce product photo analysis, SEO optimization, and marketplace compliance.

## Supported Marketplaces

| Marketplace | Min Resolution | Background | Aspect Ratio |
|-------------|---------------|------------|-------------|
| Wildberries | 900x1200 | White/transparent | 3:4 |
| Ozon | 200x200 (900x1200 recommended) | White preferred | 1:1 or 3:4 |
| Amazon | 1000x1000 | Pure white (255,255,255) | 1:1 |
| eBay | 500x500 | White/neutral preferred | 1:1 |

## Features

### Product Analysis
Upload a product photo to get:
- Product description and category
- SEO-optimized title (60-80 characters)
- 10-15 search tags/keywords
- Photo quality score (1-10)
- Extracted product attributes
- Improvement suggestions

### Compliance Check
Verify that your product photo meets marketplace requirements:
- Resolution check
- Background validation
- Forbidden elements detection (watermarks, text overlays, etc.)
- Compliance score with specific violation details

### SEO Generator
Generate marketplace-optimized listing content:
- SEO title with key search terms
- 5 benefit-focused bullet points
- Product description (150-200 words)
- 15 search tags (broad + long-tail)
- Backend keywords
- Category suggestion

### Batch Processing
Analyze multiple product photos at once:
1. Go to **E-commerce > Bulk Upload**
2. Select target marketplace
3. Upload multiple images
4. Download results as CSV

## API Usage

### Analyze Product
```bash
curl -X POST http://localhost:8000/api/ecommerce/analyze-product \
  -F "file=@product.jpg" \
  -F "marketplace=amazon"
```

### Check Compliance
```bash
curl -X POST http://localhost:8000/api/ecommerce/compliance-check \
  -F "file=@product.jpg" \
  -F "marketplace=wildberries"
```

### Generate SEO
```bash
curl -X POST http://localhost:8000/api/ecommerce/generate-seo \
  -F "file=@product.jpg" \
  -F "marketplace=ozon" \
  -F "keywords=wireless headphones bluetooth"
```

### List Marketplaces
```bash
curl http://localhost:8000/api/ecommerce/marketplaces
```
