"""SEO content generator for e-commerce products."""

import logging
from typing import Union
from pathlib import Path

from src.vision_agent import VisionAgent, AnalysisResult
from .marketplace_rules import get_marketplace_info, MARKETPLACE_RULES

logger = logging.getLogger(__name__)


class SEOGenerator:
    """Generate SEO-optimized content for product listings."""

    def __init__(self, agent: VisionAgent):
        self.agent = agent

    def generate_listing(
        self,
        image_path: Union[str, Path],
        marketplace: str = "general",
        keywords: str = "",
    ) -> AnalysisResult:
        """Generate complete SEO listing content from product image."""
        marketplace_context = ""
        if marketplace != "general" and marketplace in MARKETPLACE_RULES:
            rules = get_marketplace_info(marketplace)
            marketplace_context = f"\nTarget marketplace: {rules['name']}. Optimize for this platform's search algorithm."

        keyword_context = ""
        if keywords:
            keyword_context = f"\nTarget keywords to include: {keywords}"

        prompt = f"""**Role**: E-commerce SEO Copywriter
**Task**: Generate a complete marketplace listing from this product image.
{marketplace_context}{keyword_context}

**Generate**:
1. **SEO Title** (60-80 chars): Include main keyword, brand, key feature, size/color
2. **Bullet Points** (5 items): Each starts with a BENEFIT, then feature detail
3. **Product Description** (150-200 words): Engaging, keyword-rich, scannable
4. **Search Tags** (15 tags): Mix of broad and long-tail keywords
5. **Backend Keywords**: Additional search terms not in title/bullets
6. **Category Suggestion**: Best product category for this item

**SEO Rules**:
- No keyword stuffing — natural language
- Front-load important keywords in title
- Each bullet point covers a unique selling point
- Description should answer common buyer questions"""

        return self.agent.analyze_image(image_path, task=prompt)

    def generate_title(
        self,
        image_path: Union[str, Path],
        marketplace: str = "general",
    ) -> AnalysisResult:
        """Generate optimized product title."""
        prompt = """**Role**: SEO Title Specialist
**Task**: Generate 3 optimized product title variants from this image.

**Format**: [Brand] + [Product Type] + [Key Feature] + [Size/Color/Variant]

**Rules**:
- 60-80 characters each
- Front-load the most searched keyword
- Include differentiating attribute
- No ALL CAPS, no special characters

**Output**: 3 title options ranked by expected search performance."""

        return self.agent.analyze_image(image_path, task=prompt)

    def generate_tags(
        self,
        image_path: Union[str, Path],
        count: int = 15,
    ) -> AnalysisResult:
        """Generate search tags/keywords for the product."""
        prompt = f"""**Role**: Keyword Research Specialist
**Task**: Generate {count} search keywords/tags for this product.

**Categories**:
- 3-4 broad keywords (high volume)
- 5-6 specific keywords (medium volume)
- 4-5 long-tail keywords (high intent)
- 2-3 trending/seasonal keywords

**Output**: Numbered list with estimated search intent (Informational/Commercial/Transactional) for each."""

        return self.agent.analyze_image(image_path, task=prompt)
