"""Product photo analyzer for e-commerce."""

import logging
from pathlib import Path
from typing import Optional, Dict, Any, Union

from src.vision_agent import VisionAgent, AnalysisResult
from .marketplace_rules import get_marketplace_info, MARKETPLACE_RULES

logger = logging.getLogger(__name__)


class ProductAnalyzer:
    """Analyze product photos for e-commerce marketplaces."""

    def __init__(self, agent: VisionAgent):
        self.agent = agent

    def analyze_product(
        self,
        image_path: Union[str, Path],
        marketplace: str = "general",
    ) -> AnalysisResult:
        """Full product photo analysis with SEO and quality assessment."""
        marketplace_context = ""
        if marketplace != "general" and marketplace in MARKETPLACE_RULES:
            rules = get_marketplace_info(marketplace)
            marketplace_context = f"""
Target marketplace: {rules['name']}
Requirements: min {rules['min_image_width']}x{rules['min_image_height']}px, {rules['required_background']} background.
Forbidden: {', '.join(rules['forbidden_elements'])}
"""

        prompt = f"""**Role**: E-commerce Product Photo Analyst
**Task**: Analyze this product photo for marketplace optimization.
{marketplace_context}
**Provide**:
1. **Product Description**: What is the product? Category, color, material, key features.
2. **SEO Title**: An optimized product title (60-80 chars) with key search terms.
3. **SEO Tags**: 10-15 relevant search tags/keywords.
4. **Photo Quality Score** (1-10): Rate lighting, composition, background, clarity.
5. **Attributes**: Extract visible product attributes (size, color, material, brand).
6. **Improvements**: List 3-5 specific suggestions to improve the photo for better conversion.

**Output Format**: Structured with clear section headers."""

        return self.agent.analyze_image(image_path, task=prompt)

    def check_compliance(
        self,
        image_path: Union[str, Path],
        marketplace: str,
    ) -> AnalysisResult:
        """Check if product photo meets marketplace requirements."""
        rules = get_marketplace_info(marketplace)

        prompt = f"""**Role**: Marketplace Compliance Auditor
**Task**: Check this product photo against {rules['name']} requirements.

**Requirements to verify**:
- Minimum resolution: {rules['min_image_width']}x{rules['min_image_height']} pixels
- Background: {rules['required_background']}
- Aspect ratio: {rules['aspect_ratio']}
- Forbidden elements: {', '.join(rules['forbidden_elements'])}

**Recommendations**: {', '.join(rules['recommendations'])}

**Output**:
1. **Compliance Status**: PASS or FAIL
2. **Issues Found**: List each violation with severity (Critical/Warning/Info)
3. **Recommendations**: Specific steps to fix each issue
4. **Overall Score**: 1-10 compliance rating"""

        return self.agent.analyze_image(image_path, task=prompt)

    def suggest_improvements(
        self,
        image_path: Union[str, Path],
    ) -> AnalysisResult:
        """Suggest improvements for better conversion."""
        prompt = """**Role**: E-commerce Photography Consultant
**Task**: Analyze this product photo and suggest improvements for higher conversion rates.

**Evaluate**:
1. **Lighting**: Is it well-lit, even, no harsh shadows?
2. **Composition**: Product placement, angles, framing
3. **Background**: Clean, professional, appropriate?
4. **Props/Styling**: Context, scale reference, lifestyle elements
5. **Technical Quality**: Focus, resolution, color accuracy

**Output**:
- **Current Score**: 1-10
- **Top 5 Improvements**: Ranked by expected conversion impact
- **Quick Wins**: Changes that require minimal effort
- **Professional Tips**: Advanced techniques for this product type"""

        return self.agent.analyze_image(image_path, task=prompt)

    def compare_with_competitor(
        self,
        product_image: Union[str, Path],
        competitor_image: Union[str, Path],
    ) -> AnalysisResult:
        """Compare product photo with competitor's listing.

        Note: Analyzes product image with context about competitor comparison.
        For true side-by-side, both images should be combined into one.
        """
        prompt = """**Role**: Competitive Intelligence Analyst (E-commerce)
**Task**: Analyze this product image for competitive positioning.

**Evaluate**:
1. **Visual Quality**: Professional appearance, lighting, composition
2. **Information Density**: How much product info is conveyed visually
3. **Brand Perception**: What brand image does this photo convey?
4. **Differentiation**: What makes this product stand out?

**Output**:
- **Strengths**: What this listing does well
- **Weaknesses**: Areas for improvement
- **Competitive Edge**: How to differentiate from competitors
- **Action Items**: 3 specific changes to outperform competition"""

        return self.agent.analyze_image(product_image, task=prompt)

    def extract_attributes(
        self,
        image_path: Union[str, Path],
    ) -> AnalysisResult:
        """Extract product attributes from photo."""
        prompt = """**Role**: Product Data Specialist
**Task**: Extract all visible product attributes from this image.

**Extract**:
- **Category**: Product type/category
- **Brand**: If visible
- **Color(s)**: Primary and secondary colors
- **Material**: If identifiable (leather, cotton, metal, plastic, etc.)
- **Size/Dimensions**: If reference available
- **Condition**: New, used, refurbished
- **Features**: Special features, buttons, ports, attachments
- **Packaging**: Type of packaging if visible
- **Text/Labels**: Any visible text, labels, certifications

**Output Format**: JSON-like structured data with confidence levels (High/Medium/Low) for each attribute."""

        return self.agent.analyze_image(image_path, task=prompt)
