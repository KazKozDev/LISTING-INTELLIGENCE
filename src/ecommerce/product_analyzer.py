"""Product photo analyzer for e-commerce."""

import logging
from pathlib import Path

from PIL import Image

from src.vision_agent import AnalysisResult, VisionAgent

from .listing_service import ListingService
from .marketplace_rules import MARKETPLACE_RULES, get_marketplace_info

logger = logging.getLogger(__name__)


class ProductAnalyzer:
    """Analyze product photos for e-commerce marketplaces."""

    def __init__(self, agent: VisionAgent):
        self.agent = agent

    def analyze_product(
        self,
        image_path: str | Path,
        marketplace: str = "general",
    ) -> AnalysisResult:
        """Full product photo analysis with SEO and quality assessment."""
        marketplace_context = ""
        if marketplace != "general" and marketplace in MARKETPLACE_RULES:
            rules = get_marketplace_info(marketplace)
            marketplace_context = f"""
Target marketplace: {rules['name']}
Requirements: min {rules['min_image_width']}x{rules['min_image_height']}px,
{rules['required_background']} background.
Forbidden: {', '.join(rules['forbidden_elements'])}
"""

        prompt = f"""**Role**: E-commerce Product Photo Analyst
**Task**: Analyze this product photo for marketplace optimization.
{marketplace_context}
**Provide**:
1. **Product Description**: What is the product? Category, color, material,
    key features.
2. **SEO Title**: An optimized product title (60-80 chars) with key search
    terms.
3. **SEO Tags**: 10-15 relevant search tags/keywords.
4. **Photo Quality Score** (1-10): Rate lighting, composition, background,
    clarity.
5. **Attributes**: Extract visible product attributes (size, color,
    material, brand).
6. **Improvements**: List 3-5 specific suggestions to improve the photo for
    better conversion.

**Output Format**: Structured with clear section headers."""

        return self.agent.analyze_image(image_path, task=prompt)

    def analyze_product_full(
        self,
        image_path: str | Path,
        marketplace: str = "general",
        keywords: str = "",
    ) -> AnalysisResult:
        """Complete product analysis + SEO listing in a single LLM call.

        Combines photo quality analysis with SEO content generation
        to save tokens by avoiding duplicate API calls.
        """
        return ListingService(self.agent).generate_listing(
            image_path,
            marketplace=marketplace,
            keywords=keywords,
            mode="full",
        )

    def check_compliance(
        self,
        image_path: str | Path,
        marketplace: str,
    ) -> AnalysisResult:
        """Check if product photo meets marketplace requirements."""
        image_path = Path(image_path)
        rules = get_marketplace_info(marketplace)
        image_facts = self._collect_image_facts(image_path)

        main_image_rules = "\n".join(f"- {rule}" for rule in rules.get("main_image_rules", []))
        recommendations = "\n".join(f"- {item}" for item in rules.get("recommendations", []))
        sources = "\n".join(
            f"- {source['label']}: {source['url']}" for source in rules.get("sources", [])
        )
        allowed_formats = ", ".join(rules.get("allowed_formats", []))
        preferred_width = rules.get("recommended_image_width", rules["min_image_width"])
        preferred_height = rules.get("recommended_image_height", rules["min_image_height"])
        image_usage_guidance = (
            "Treat the uploaded image as the marketplace primary listing "
            "image unless the image itself clearly looks like a gallery "
            "or detail shot."
        )

        prompt = f"""**Role**: Marketplace Compliance Auditor
**Task**: Check this product photo against {rules['name']} requirements.

**Known measured file facts**:
- Trust these facts and do not estimate them visually.
- File format: {image_facts['format']}
- File size: {image_facts['file_size_mb']:.2f} MB
- Pixel dimensions: {image_facts['width']}x{image_facts['height']}
- Aspect ratio: {image_facts['aspect_ratio']}
- Color mode: {image_facts['color_mode']}

**Requirements to verify**:
- Minimum resolution: {rules['min_image_width']}x{rules['min_image_height']}
    pixels
- Preferred target resolution: {preferred_width}x{preferred_height} pixels
- Background: {rules['required_background']}
- Aspect ratio: {rules['aspect_ratio']}
- Allowed formats: {allowed_formats}
- Forbidden elements: {', '.join(rules['forbidden_elements'])}

**Main image / gallery rules**:
{main_image_rules}

**Marketplace recommendations**:
{recommendations}

**Verified sources**:
{sources}

**Notes**: {rules.get('notes', 'No additional notes.')}
**Usage guidance**: {image_usage_guidance}

**Grounding rules**:
- Base every finding only on the visible pixels in the image and the
    measured file facts above.
- Do not guess hidden metadata, off-frame content, or seller intent.
- Do not invent text, watermarks, logos, props, or background details
    that are not clearly visible.
- If a criterion cannot be verified from a single image, say
    "Not verifiable from this image" instead of assuming.
- Resolution, aspect ratio, file size, and format must be judged from
    the measured file facts above, not estimated visually.
- Each issue must cite the exact visible evidence or measured fact
    that triggered it.

**Output**:
1. **Compliance Status**: PASS or FAIL
2. **Issues Found**: List each violation with severity
     (Critical/Warning/Info) and a short evidence note
3. **Recommendations**: Specific steps to fix each issue
4. **Overall Score**: 1-10 compliance rating
5. **Unverifiable Checks**: Criteria that cannot be confirmed from
     this single image"""

        return self.agent.analyze_image(image_path, task=prompt)

    @staticmethod
    def _collect_image_facts(image_path: Path) -> dict[str, str | int | float]:
        """Collect deterministic image facts for compliance prompts."""
        with Image.open(image_path) as image:
            width, height = image.size
            image_format = image.format or image_path.suffix.replace(".", "").upper()
            color_mode = image.mode

        file_size_mb = image_path.stat().st_size / (1024 * 1024)
        aspect_ratio = f"{width}:{height} (~{width / max(height, 1):.3f}:1)"

        return {
            "format": image_format,
            "file_size_mb": file_size_mb,
            "width": width,
            "height": height,
            "aspect_ratio": aspect_ratio,
            "color_mode": color_mode,
        }

    def suggest_improvements(
        self,
        image_path: str | Path,
    ) -> AnalysisResult:
        """Suggest improvements for better conversion."""
        prompt = """**Role**: E-commerce Photography Consultant
**Task**: Analyze this product photo and suggest improvements for higher
conversion rates.

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
        product_image: str | Path,
        competitor_image: str | Path,
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
        image_path: str | Path,
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

**Output Format**: JSON-like structured data with confidence levels
(High/Medium/Low) for each attribute."""

        return self.agent.analyze_image(image_path, task=prompt)
