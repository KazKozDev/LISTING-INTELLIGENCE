"""Shared listing and SEO generation service for e-commerce flows."""

import logging
from pathlib import Path
from typing import Literal

from src.vision_agent import AnalysisResult, VisionAgent

from .marketplace_rules import MARKETPLACE_RULES, get_marketplace_info

logger = logging.getLogger(__name__)

ListingMode = Literal["full", "seo_only"]

MARKETPLACE_LISTING_RULES: dict[str, dict[str, str]] = {
    "amazon": {
        "title": (
            "Keep the title factual, retail-style, and tightly scannable. "
            "Prefer Brand + Product Type + Core Feature + Variant/Size. "
            "Avoid promo language, shipping claims, excessive punctuation, "
            "and repeated keywords."
        ),
        "bullets": (
            "Write exactly 5 bullets. Start each bullet with a buyer-facing "
            "benefit, then support it with visible or safely inferable "
            "product facts. Do not use unverifiable comparative claims."
        ),
        "description": (
            "Use a conversion-oriented but factual retail tone. Focus on "
            "materials, use cases, sizing/variant clarity, and practical "
            "buyer questions. Do not repeat the title verbatim."
        ),
        "search_tags": (
            "Prioritize buyer-intent and feature-based search phrases. "
            "Avoid duplicates, marketplace names, and low-signal filler tags."
        ),
        "backend_keywords": (
            "Exclude exact phrases already used in title and bullets. Add "
            "compact synonym-style search terms, variants, materials, and use "
            "cases without repetition or punctuation spam."
        ),
        "category": (
            "Return the safest valid retail taxonomy path, broad enough to be "
            "credible if the image is ambiguous. Include a short rationale."
        ),
        "product_description": (
            "Separate what is clearly visible from what is only moderately "
            "inferable. Do not invent brand, pack count, or technical specs."
        ),
        "attributes": (
            "Output semi-structured attributes with confidence. Prefer color, "
            "material, form factor, visible size cues, finish, and packaging "
            "visibility."
        ),
        "improvements": (
            "Prioritize marketplace-conversion issues: framing, compliance, "
            "clarity, and missing retail trust signals."
        ),
        "packaging": (
            "Assess whether visible packaging helps trust and conversion, but "
            "note when packaging on the main image could conflict with Amazon "
            "main-image norms."
        ),
        "visual_search": (
            "Provide visual descriptors useful for Lens-style discovery: "
            "shape, finish, material, silhouette, colorway, and "
            "lifestyle-free "
            "alt-text phrasing."
        ),
        "quality": (
            "Score with strong weight on subject fill, white-background "
            "readiness, zoom readiness, and retail clarity."
        ),
    },
    "walmart": {
        "title": (
            "Use a clean big-box retail title. Prefer straightforward product "
            "identification over clever phrasing. Avoid claims, hype, and "
            "non-essential modifiers."
        ),
        "bullets": (
            "Write exactly 4-5 concise bullets. Emphasize practical shopper "
            "benefits, included components, dimensions/fit clues, and "
            "everyday use."
        ),
        "description": (
            "Use a clear catalog tone suitable for mass retail. Keep the copy "
            "easy to scan and centered on what the shopper gets and how it is "
            "used."
        ),
        "search_tags": (
            "Favor high-intent retail queries and common shopper phrasing "
            "over "
            "niche SEO stuffing."
        ),
        "backend_keywords": (
            "Treat this as supplemental search terms. Use short retail search "
            "variants and omit phrases already used in the visible copy."
        ),
        "category": (
            "Choose a practical Walmart-style department path and avoid "
            "overly "
            "narrow taxonomy guesses when certainty is low."
        ),
        "product_description": (
            "Describe the sellable retail item clearly and conservatively. "
            "Keep emphasis on visible item type, construction cues, and "
            "shopper fit."
        ),
        "attributes": (
            "Prioritize retail attributes a catalog team would care about: "
            "color, material, size cues, included accessories, and packaging "
            "state."
        ),
        "improvements": (
            "Prioritize issues that affect shelf clarity, trust, and PDP "
            "image "
            "quality in mass retail."
        ),
        "packaging": (
            "Assess whether packaging improves trust, but flag when it "
            "distracts "
            "from the product or would be weak for a hero image."
        ),
        "visual_search": (
            "Focus on shopper-friendly descriptive phrases that a general "
            "retail "
            "customer would type after seeing similar products."
        ),
        "quality": (
            "Score with strong weight on square framing, clean "
            "white-background "
            "presentation, and broad retail readability."
        ),
    },
    "allegro": {
        "title": (
            "Optimize for practical offer clarity first. Keep the title "
            "readable, "
            "specific, and variant-aware. Avoid spammy repetition and "
            "external "
            "promo language."
        ),
        "bullets": (
            "Write 5 concise bullets that clarify offer contents, key visible "
            "features, and use-case fit. Prioritize concrete listing clarity "
            "over "
            "brand-heavy marketing."
        ),
        "description": (
            "Use a practical marketplace tone that helps the buyer "
            "understand the "
            "exact offer quickly. Emphasize offer clarity, configuration, and "
            "visible differentiators."
        ),
        "search_tags": (
            "Favor clear product and variant terms used by practical "
            "shoppers. "
            "Avoid overloading with near-duplicates."
        ),
        "backend_keywords": (
            "Treat this as supplemental search vocabulary for feed/search "
            "usage. Use concise alternate phrasings and avoid repeating "
            "the visible copy."
        ),
        "category": (
            "Choose the most plausible offer taxonomy path and mention "
            "uncertainty "
            "if the image alone cannot resolve a narrow subcategory."
        ),
        "product_description": (
            "Describe the exact sellable item and visible offer variant. "
            "Avoid "
            "guessing hidden bundle contents or technical specs."
        ),
        "attributes": (
            "Capture visible offer attributes relevant to product matching "
            "and "
            "variant selection, with confidence levels."
        ),
        "improvements": (
            "Prioritize clearer offer presentation, better visual "
            "differentiation, "
            "and stronger listing readability."
        ),
        "packaging": (
            "Evaluate whether visible packaging helps trust and offer "
            "clarity, and "
            "whether it supports marketplace click-through."
        ),
        "visual_search": (
            "Provide discovery phrases that emphasize visible product form, "
            "packaging cues, and practical matching terms."
        ),
        "quality": (
            "Score with weight on product clarity, honest offer "
            "representation, "
            "and readable marketplace presentation rather than strict "
            "white-only "
            "studio norms."
        ),
    },
    "etsy": {
        "title": (
            "Use a readable handmade/boutique listing style when "
            "appropriate for the visible product. Keep it specific and "
            "natural, not keyword-dumped."
        ),
        "bullets": (
            "Write 5 bullets emphasizing craftsmanship, visible materials, "
            "size or "
            "variant cues, gifting/use occasions, and aesthetic "
            "differentiators."
        ),
        "description": (
            "Use a warm but concrete boutique tone where product type allows "
            "it. Highlight visible texture, finish, style cues, and buyer "
            "appeal without "
            "inventing handmade claims."
        ),
        "search_tags": (
            "Favor shopper phrases aligned with style, gifting intent, "
            "material, "
            "and use case. Avoid obvious duplicates and generic filler."
        ),
        "backend_keywords": (
            "Treat this as supplemental discoverability terms rather than "
            "platform native backend fields. Add style synonyms and intent "
            "phrases not already used heavily in the visible copy."
        ),
        "category": (
            "Choose a plausible handmade/boutique taxonomy path and include "
            "a short "
            "reason based on visible style cues."
        ),
        "product_description": (
            "Describe visible aesthetic identity carefully: finish, texture, "
            "color, "
            "shape, and likely use. Do not invent maker/process claims."
        ),
        "attributes": (
            "Capture style and material attributes useful for handcrafted or "
            "design-led "
            "cataloging, with confidence."
        ),
        "improvements": (
            "Prioritize thumbnail readability, aesthetic warmth, and clarity "
            "of unique "
            "visible product character."
        ),
        "packaging": (
            "Evaluate giftability, boutique presentation, and whether "
            "packaging improves "
            "perceived quality."
        ),
        "visual_search": (
            "Provide visually rich descriptors useful for "
            "Pinterest/Etsy-style "
            "discovery: "
            "aesthetic, texture, style family, color palette, and "
            "decor/gift intent."
        ),
        "quality": (
            "Score with strong weight on thumbnail appeal, style clarity, and "
            "the product's "
            "ability to stand out in discovery feeds."
        ),
    },
    "ebay": {
        "title": (
            "Use a straightforward marketplace title with strong product "
            "identification. "
            "Prioritize condition and exact item clarity when visible."
        ),
        "bullets": (
            "Write 5 bullets focused on exact item details, visible condition "
            "cues, and "
            "practical buyer expectations."
        ),
        "description": (
            "Use a pragmatic resale/marketplace tone. Emphasize exact item "
            "identity, visible "
            "condition, and configuration clarity."
        ),
        "search_tags": (
            "Favor exact-match item phrases, common shopper search variants, "
            "and condition-aware "
            "descriptors when visible."
        ),
        "backend_keywords": (
            "Treat this as supplemental item search terms. Prioritize "
            "alternate names, model-family "
            "phrasing, and visible condition descriptors."
        ),
        "category": (
            "Choose a safe resale-market taxonomy path and avoid "
            "overcommitting to narrow categories "
            "without strong visual evidence."
        ),
        "product_description": (
            "Describe the exact visible item conservatively, including "
            "condition clues if present."
        ),
        "attributes": (
            "Capture exact-match resale attributes: color, material, visible "
            "model/style family, "
            "condition clues, and included components."
        ),
        "improvements": (
            "Prioritize exact item clarity, truthful condition presentation, "
            "and better buyer trust."
        ),
        "packaging": (
            "Assess whether packaging helps authenticate the offer or " "clarify what is included."
        ),
        "visual_search": (
            "Provide item-identification descriptors and exact-match visual "
            "cues rather than broad "
            "lifestyle phrasing."
        ),
        "quality": (
            "Score with strong weight on authenticity, condition visibility, "
            "and exact item matching."
        ),
    },
}


def build_marketplace_field_rules(marketplace: str) -> str:
    """Build field-by-field marketplace rules for listing generation."""
    rules = MARKETPLACE_LISTING_RULES.get(marketplace)
    if not rules:
        return ""

    return f"""
**Marketplace-specific field rules**:
- SEO Title: {rules['title']}
- Bullet Points: {rules['bullets']}
- Full Listing Description: {rules['description']}
- Search Tags: {rules['search_tags']}
- Backend Keywords / Supplemental Search Terms: {rules['backend_keywords']}
- Category Suggestion: {rules['category']}
- Product Description: {rules['product_description']}
- Attributes: {rules['attributes']}
- Improvements: {rules['improvements']}
- Packaging Review: {rules['packaging']}
- Visual Search SEO: {rules['visual_search']}
- Photo Quality Score: {rules['quality']}
"""


def build_listing_prompt(
    marketplace: str = "general",
    keywords: str = "",
    mode: ListingMode = "seo_only",
) -> str:
    """Build a shared listing prompt for SEO-only or full-analysis flows."""
    marketplace_context = ""
    marketplace_field_rules = build_marketplace_field_rules(marketplace)
    if marketplace != "general" and marketplace in MARKETPLACE_RULES:
        rules = get_marketplace_info(marketplace)
        marketplace_context = (
            f"\nTarget marketplace: {rules['name']}. "
            "Optimize for this platform's search algorithm."
        )
        if mode == "full":
            marketplace_context += (
                "\nRequirements: min "
                f"{rules['min_image_width']}x{rules['min_image_height']}px, "
                f"{rules['required_background']} background."
                f"\nForbidden: {', '.join(rules['forbidden_elements'])}"
            )

    keyword_context = f"\nTarget keywords to include: {keywords}" if keywords.strip() else ""

    if mode == "full":
        return f"""**Role**: E-commerce Product Analyst & SEO Copywriter
**Task**: Analyze this product photo and generate complete marketplace
listing content.
{marketplace_context}{keyword_context}
{marketplace_field_rules}

**Global generation rules**:
- Adapt every section to the selected marketplace, not just the SEO fields.
- Use only what is visible in the image plus safe, conservative inferences.
- Do not invent hidden specs, unsupported claims, certifications,
    bundle contents, materials, or brand names.
- If a detail is uncertain, phrase it conservatively or mark it as
    low confidence.
- Keep the copy marketplace-native in tone and structure.

**Provide ALL of the following**:

1. **Product Description**: What is the product? Category, color, material,
    key features.
2. **Photo Quality Score** (1-10): Rate lighting, composition, background,
    clarity.
3. **Attributes**: Extract visible product attributes (size, color,
    material, brand).
4. **Improvements**: List 3-5 specific suggestions to improve the photo for
    better conversion.
5. **SEO Title** (60-80 chars): Include main keyword, brand, key feature,
    size/color. Front-load important keywords.
6. **Bullet Points** (5 items): Each starts with a BENEFIT, then feature
    detail. Each covers a unique selling point.
7. **Full Listing Description** (150-200 words): Engaging, keyword-rich,
    scannable. Answer common buyer questions.
8. **Search Tags** (15 tags): Mix of broad and long-tail keywords.
9. **Backend Keywords**: Additional search terms not in title/bullets.
10. **Category Suggestion**: Best product category for this item.
11. **Packaging Review**: Evaluate shelf appeal, packaging clarity,
    premium feel, and trust/conversion impact from what is visible.
12. **Visual Search SEO**: Provide Lens/Pinterest-friendly descriptors,
    alt-text style phrasing, and visual attributes that should be
    emphasized for image discovery.

**SEO Rules**: No keyword stuffing — natural language. Front-load important
keywords in title.
**Output Format**: Structured with clear numbered section headers.

For Product Description, Attributes, and Category Suggestion, include a short
confidence note whenever certainty is limited by the image alone."""

    return f"""**Role**: E-commerce SEO Copywriter
**Task**: Generate a complete marketplace listing from this product image.
{marketplace_context}{keyword_context}
{marketplace_field_rules}

**Global generation rules**:
- Adapt every field to the selected marketplace's listing style.
- Use only visible evidence plus safe, conservative inferences.
- Do not repeat the same keyword unnaturally across title, bullets, and tags.
- If a platform does not naturally use backend keywords, treat that section as
    supplemental search terms rather than fabricating a platform feature.

**Generate**:
1. **SEO Title** (60-80 chars): Include main keyword, brand, key feature,
   size/color
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


class ListingService:
    """Generate SEO-only or full listing content from product images."""

    def __init__(self, agent: VisionAgent):
        self.agent = agent

    def generate_listing(
        self,
        image_path: str | Path,
        marketplace: str = "general",
        keywords: str = "",
        mode: ListingMode = "seo_only",
    ) -> AnalysisResult:
        """Generate listing content from a product image."""
        prompt = build_listing_prompt(
            marketplace=marketplace,
            keywords=keywords,
            mode=mode,
        )
        return self.agent.analyze_image(image_path, task=prompt)

    def generate_title(
        self,
        image_path: str | Path,
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
        image_path: str | Path,
        count: int = 15,
    ) -> AnalysisResult:
        """Generate search tags and keywords for the product."""
        prompt = f"""**Role**: Keyword Research Specialist
**Task**: Generate {count} search keywords/tags for this product.

**Categories**:
- 3-4 broad keywords (high volume)
- 5-6 specific keywords (medium volume)
- 4-5 long-tail keywords (high intent)
- 2-3 trending/seasonal keywords

**Output**: Numbered list with estimated search intent
(Informational/Commercial/Transactional) for each."""

        return self.agent.analyze_image(image_path, task=prompt)
