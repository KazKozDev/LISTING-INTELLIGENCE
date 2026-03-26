"""Tests for marketplace-aware listing prompt generation."""

from src.ecommerce.listing_service import build_listing_prompt


class TestBuildListingPrompt:
    """Tests for field-specific marketplace prompt rules."""

    def test_full_prompt_includes_marketplace_field_rules_for_amazon(self):
        prompt = build_listing_prompt(
            marketplace="amazon",
            keywords="wireless headphones",
            mode="full",
        )

        assert "**Marketplace-specific field rules**:" in prompt
        assert "SEO Title: Keep the title factual, retail-style" in prompt
        assert "Bullet Points: Write exactly 5 bullets." in prompt
        assert "Backend Keywords / Supplemental Search Terms:" in prompt
        assert "Adapt every section to the selected marketplace" in prompt
        assert "Do not invent hidden specs" in prompt
        assert "confidence note" in prompt.lower()

    def test_full_prompt_includes_etsy_specific_tone_guidance(self):
        prompt = build_listing_prompt(
            marketplace="etsy",
            keywords="ceramic mug gift",
            mode="full",
        )

        assert "handmade/boutique listing style" in prompt
        assert "Pinterest/Etsy-style discovery" in prompt
        assert "thumbnail appeal" in prompt

    def test_general_prompt_does_not_include_marketplace_specific_rules(self):
        prompt = build_listing_prompt(
            marketplace="general",
            keywords="desk lamp",
            mode="full",
        )

        assert "**Marketplace-specific field rules**:" not in prompt
        assert "Adapt every section to the selected marketplace" in prompt

    def test_seo_only_prompt_includes_marketplace_adaptation_rules(self):
        prompt = build_listing_prompt(
            marketplace="walmart",
            keywords="storage basket",
            mode="seo_only",
        )

        assert "**Marketplace-specific field rules**:" in prompt
        assert "Use a clean big-box retail title" in prompt
        assert (
            "Adapt every field to the selected marketplace's listing style."
            in prompt
        )
        assert "supplemental search terms" in prompt.lower()
