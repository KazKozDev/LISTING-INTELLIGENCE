# E-Commerce Guide

Listing Intelligence includes specialized tools for e-commerce product photo analysis, SEO optimization, and marketplace compliance.

## Supported Marketplaces

| Marketplace | Min Resolution | Background | Aspect Ratio |
|-------------|---------------|------------|-------------|
| Allegro | 500 px on the longer side | Any clear background | Any ratio |
| Walmart | 1500x1500 minimum for zoom, 2200x2200 preferred | Seamless white (255,255,255) | 1:1 |
| Amazon | 500 px technical minimum, 1000+ recommended for zoom | Pure white (255,255,255) on main image | Not fixed; square common |
| eBay | 500x500 minimum | White/neutral recommended | Not fixed |

## Features

### Product Analysis
Upload a product photo to get:
- Product description and category
- SEO-optimized title (60-80 characters)
- Bullet points and full listing description
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

The Compliance Check flow now uses marketplace-specific requirements collected from:
- Amazon Seller Central Product image guide
- Walmart Marketplace Learn image guidelines
- eBay Picture policy and Seller Center photo requirements
- Allegro Help rules for gallery and description images

### Batch Processing
Analyze multiple product photos at once:
1. Open **Product Analysis**
2. Select target marketplace
3. Upload multiple images in one drop
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
  -F "marketplace=amazon"
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

## Current UI Structure

- Product Analysis: single-item analysis, SEO output, and batch mode in one screen
- Compliance Check: marketplace pass/fail validation using marketplace-specific image rules sourced from official documentation
- Tools: secondary specialized analyses such as compare, improvements, and attribute extraction
