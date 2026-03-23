"""Marketplace-specific rules and requirements for product photos."""

from typing import Dict, Any, List


MARKETPLACE_RULES: Dict[str, Dict[str, Any]] = {
    "wildberries": {
        "id": "wildberries",
        "name": "Wildberries",
        "min_image_width": 900,
        "min_image_height": 1200,
        "max_file_size_mb": 10,
        "required_background": "white or transparent",
        "aspect_ratio": "3:4",
        "forbidden_elements": [
            "watermarks",
            "promotional text on main image",
            "collages on main image",
            "logos of other brands",
            "price tags",
        ],
        "recommendations": [
            "Use at least 4-6 images per product",
            "First image must be on white background",
            "Include size/scale reference",
            "Show product from multiple angles",
        ],
    },
    "ozon": {
        "id": "ozon",
        "name": "Ozon",
        "min_image_width": 200,
        "min_image_height": 200,
        "max_file_size_mb": 10,
        "required_background": "white preferred",
        "aspect_ratio": "1:1 or 3:4",
        "forbidden_elements": [
            "watermarks",
            "contact information",
            "external URLs",
            "price comparisons",
            "competitor logos",
        ],
        "recommendations": [
            "Recommended resolution: 900x1200 or higher",
            "Use infographics for secondary images",
            "Include lifestyle shots",
            "Show packaging if relevant",
        ],
    },
    "amazon": {
        "id": "amazon",
        "name": "Amazon",
        "min_image_width": 1000,
        "min_image_height": 1000,
        "max_file_size_mb": 10,
        "required_background": "pure white (RGB 255,255,255)",
        "aspect_ratio": "1:1",
        "forbidden_elements": [
            "text overlays on main image",
            "badges or logos",
            "borders or frames",
            "promotional stickers",
            "placeholder or generic images",
            "watermarks",
        ],
        "recommendations": [
            "Product must fill 85% of image frame",
            "Use 7-9 images including infographics",
            "Include A+ Content images",
            "Add lifestyle and in-use shots",
        ],
    },
    "ebay": {
        "id": "ebay",
        "name": "eBay",
        "min_image_width": 500,
        "min_image_height": 500,
        "max_file_size_mb": 12,
        "required_background": "white or neutral preferred",
        "aspect_ratio": "1:1",
        "forbidden_elements": [
            "stock photos for used items",
            "borders or frames",
            "text that obscures the product",
            "watermarks",
        ],
        "recommendations": [
            "Use up to 12 images",
            "Show item condition clearly",
            "Include measurements where relevant",
            "Photograph any defects for used items",
        ],
    },
}


def get_marketplace_info(marketplace_id: str) -> Dict[str, Any]:
    """Get marketplace rules by ID (case-insensitive)."""
    key = marketplace_id.lower()
    if key not in MARKETPLACE_RULES:
        raise ValueError(
            f"Unknown marketplace: {marketplace_id}. "
            f"Supported: {list(MARKETPLACE_RULES.keys())}"
        )
    return MARKETPLACE_RULES[key]


def list_marketplaces() -> List[Dict[str, Any]]:
    """Return list of all supported marketplaces with their rules."""
    return list(MARKETPLACE_RULES.values())
