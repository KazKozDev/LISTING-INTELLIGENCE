"""Marketplace-specific rules and requirements for product photos."""

from typing import Any

MARKETPLACE_RULES: dict[str, dict[str, Any]] = {
    "allegro": {
        "id": "allegro",
        "name": "Allegro",
        "min_image_width": 500,
        "min_image_height": 500,
        "recommended_image_width": 2560,
        "recommended_image_height": 2560,
        "max_file_size_mb": 26,
        "required_background": (
            "any background allowed if the product is presented clearly"
        ),
        "aspect_ratio": "any ratio allowed",
        "allowed_formats": [
            "JPG",
            "JPEG",
            "PNG",
            "WEBP via API/file feed",
        ],
        "forbidden_elements": [
            "store text overlays",
            "store logos",
            "contact details",
            "advertising that redirects outside Allegro",
            "photos that do not show the offered product or correct variant",
        ],
        "main_image_rules": [
            (
                "The image should accurately present the exact product being "
                "sold."
            ),
            "Store-added text and logos are not allowed.",
            (
                "Graphic annotations such as numbers, close-ups, arrows, "
                "certificates, and color markings can be used."
            ),
            (
                "Brand and technology logos visible on the product or "
                "packaging are allowed."
            ),
            (
                "Regular accounts can upload up to 10 gallery images; "
                "business accounts up to 16 in most categories."
            ),
        ],
        "recommendations": [
            "Use sRGB to preserve color fidelity.",
            (
                "Keep the longer side at 500 px or more; Allegro scales down "
                "anything above 2560 px per side."
            ),
            (
                "Use multiple angles and packaging shots when they help "
                "represent the offer."
            ),
            (
                "Avoid descriptive text blocks even when graphical callouts "
                "are permitted."
            ),
        ],
        "sources": [
            {
                "label": (
                    "Allegro Help: Rules for images in the gallery and in "
                    "descriptions"
                ),
                "url": (
                    "https://help.allegro.com/en/sell/a/"
                    "rules-for-images-in-the-gallery-and-in-"
                    "descriptions-8dvWB8Y2PIq"
                ),
            },
            {
                "label": (
                    "Allegro Help: When we can remove a photo from an offer"
                ),
                "url": (
                    "https://help.allegro.com/en/sell/a/"
                    "when-we-can-remove-a-photo-from-an-offer-aMloBWa7wu5"
                ),
            },
        ],
        "notes": (
            "Some category-specific or distributor-specific exceptions may "
            "apply on Allegro."
        ),
    },
    "walmart": {
        "id": "walmart",
        "name": "Walmart",
        "min_image_width": 1500,
        "min_image_height": 1500,
        "recommended_image_width": 2200,
        "recommended_image_height": 2200,
        "max_file_size_mb": 5,
        "required_background": "seamless white (RGB 255,255,255)",
        "aspect_ratio": "1:1 square",
        "allowed_formats": ["JPEG", "JPG", "PNG", "BMP"],
        "forbidden_elements": [
            "watermarks",
            "seller name or seller logo on main image",
            "claims or promotional language",
            "Walmart or other retailer logos",
            "languages other than English",
            "accessories or props not included with the item",
            "sold out or out of stock messages",
        ],
        "main_image_rules": [
            (
                "Main images should feature the item on a seamless white "
                "background."
            ),
            (
                "Crop the product close to the frame and avoid excessive "
                "empty background."
            ),
            "Larger items may appear in an expected environment.",
            (
                "Images must correspond to the product name, type, and key "
                "attributes."
            ),
        ],
        "recommendations": [
            "Upload at least four images per listing.",
            "Keep all images in focus and professionally lit.",
            (
                "Use 2200x2200 px where possible; 1500x1500 px is the "
                "minimum for zoom."
            ),
            (
                "Use RGB color mode and square aspect ratio for best "
                "compatibility."
            ),
        ],
        "sources": [
            {
                "label": (
                    "Walmart Marketplace Learn: Product detail page image "
                    "guidelines and requirements"
                ),
                "url": (
                    "https://marketplacelearn.walmart.com/guides/"
                    "Item%20setup/Item%20content,%20imagery,%20and%20media/"
                    "Product-detail-page:-Image-guidelines-%26-requirements"
                ),
            }
        ],
        "notes": (
            "Walmart notes that some categories have additional image "
            "requirements."
        ),
    },
    "amazon": {
        "id": "amazon",
        "name": "Amazon",
        "min_image_width": 500,
        "min_image_height": 500,
        "recommended_image_width": 1000,
        "recommended_image_height": 1000,
        "max_file_size_mb": 10,
        "required_background": (
            "pure white (RGB 255,255,255) for the main image"
        ),
        "aspect_ratio": "not fixed; square is common",
        "allowed_formats": ["JPEG", "PNG", "TIFF", "non-animated GIF"],
        "forbidden_elements": [
            "text overlays",
            "logos",
            "borders or color blocks",
            "watermarks",
            "badges or Amazon-style badges",
            "placeholder images",
            "props or accessories not included with the product",
            "packaging unless it is an important included feature",
        ],
        "main_image_rules": [
            "The main image must show the product on a pure white background.",
            "The product should occupy at least 85% of the frame.",
            "Show the entire product and only one unit of it.",
            (
                "Do not crop the product, duplicate it, or show front and "
                "back in one image."
            ),
            (
                "If there is no compliant main image, Amazon may suppress "
                "the listing from search."
            ),
        ],
        "recommendations": [
            "Amazon recommends at least six images plus one video.",
            (
                "Use 1000 px or more on the longest side to enable zoom, "
                "even though the technical minimum is 500 px."
            ),
            (
                "Keep secondary images accurate and free from Amazon logos "
                "or seller-specific claims."
            ),
            (
                "Review category-specific rules for clothing, footwear, and "
                "multipacks where applicable."
            ),
        ],
        "sources": [
            {
                "label": "Amazon Seller Central: Product image guide",
                "url": (
                    "https://sellercentral.amazon.com/help/hub/reference/"
                    "external/G1881?locale=en-US"
                ),
            }
        ],
        "notes": (
            "Amazon has category-specific image rules beyond the general "
            "product image guide."
        ),
    },
    "ebay": {
        "id": "ebay",
        "name": "eBay",
        "min_image_width": 500,
        "min_image_height": 500,
        "recommended_image_width": 1600,
        "recommended_image_height": 1600,
        "max_file_size_mb": 12,
        "required_background": (
            "white or neutral background recommended, not strictly required"
        ),
        "aspect_ratio": "not fixed",
        "allowed_formats": ["JPG", "PNG", "GIF", "BMP", "TIFF"],
        "forbidden_elements": [
            "stock photos for used, damaged, or defective items",
            "added borders",
            "added text or marketing artwork",
            "contact details",
            "watermarks",
        ],
        "main_image_rules": [
            "Photos should represent the actual item and its real condition.",
            (
                "Used-item listings should show flaws instead of relying on "
                "stock imagery."
            ),
            (
                "Images 500 px or larger on the longest side meet eBay's "
                "minimum; 1600 px is commonly recommended for better detail."
            ),
            "Better-performing images on eBay avoid added text and graphics.",
        ],
        "recommendations": [
            "Use your own photos for used, damaged, or defective items.",
            "Show multiple angles and any defects clearly.",
            "Prefer high-resolution images without enlarging small originals.",
            (
                "Keep overlays and decorative frames out of the main listing "
                "photos."
            ),
        ],
        "sources": [
            {
                "label": "eBay Help: Picture policy",
                "url": (
                    "https://www.ebay.com/help/policies/listing-policies/"
                    "picture-policy?id=4370"
                ),
            },
            {
                "label": "eBay Seller Center: Photo quality requirements",
                "url": (
                    "http://ebaysc.liveplatform.com/m/how-to-take-product-"
                    "photos/ebay-photo-requirements"
                ),
            },
        ],
        "notes": (
            "eBay image restrictions are less rigid on background, but "
            "stricter on authenticity for used-item photos."
        ),
    },
    "etsy": {
        "id": "etsy",
        "name": "Etsy",
        "min_image_width": 570,
        "min_image_height": 456,
        "recommended_image_width": 2000,
        "recommended_image_height": 1600,
        "max_file_size_mb": 10,
        "required_background": (
            "no strict white-background requirement; the first image should "
            "present the item clearly"
        ),
        "aspect_ratio": "4:3 horizontal recommended",
        "allowed_formats": ["JPG", "PNG", "GIF"],
        "forbidden_elements": [
            "heavy watermarks",
            "misleading text overlays",
            "graphics that obscure the product",
            "cluttered hero images that hide item detail",
        ],
        "main_image_rules": [
            (
                "The first listing photo should clearly show the product and "
                "read well in search results."
            ),
            (
                "Etsy listing photos are commonly prepared in a 4:3 "
                "horizontal ratio."
            ),
            (
                "Lifestyle backgrounds are allowed, but the item should "
                "remain the focal point."
            ),
            (
                "Avoid crowded compositions that make the product hard to "
                "identify in thumbnails."
            ),
        ],
        "recommendations": [
            "Use 2000 px width for sharp zoomable listing images.",
            "Keep the first image clean and readable at thumbnail size.",
            "Use supporting images for scale, detail, and alternate angles.",
            "Leave enough breathing room for Etsy thumbnail crops.",
        ],
        "sources": [
            {
                "label": (
                    "Etsy Seller Handbook: Product photography and listing "
                    "presentation guidance"
                ),
                "url": "https://www.etsy.com/seller-handbook",
            },
            {
                "label": "Etsy Help: Creating a listing",
                "url": (
                    "https://help.etsy.com/hc/en-us/sections/"
                    "360000066268-Creating-a-Listing?segment=selling"
                ),
            },
        ],
        "notes": (
            "Etsy is more flexible on backgrounds than Amazon or Walmart, "
            "but thumbnail readability and horizontal framing matter more."
        ),
    },
}


def get_marketplace_info(marketplace_id: str) -> dict[str, Any]:
    """Get marketplace rules by ID (case-insensitive)."""
    key = marketplace_id.lower()
    if key not in MARKETPLACE_RULES:
        raise ValueError(
            f"Unknown marketplace: {marketplace_id}. "
            f"Supported: {list(MARKETPLACE_RULES.keys())}"
        )
    return MARKETPLACE_RULES[key]


def list_marketplaces() -> list[dict[str, Any]]:
    """Return list of all supported marketplaces with their rules."""
    return list(MARKETPLACE_RULES.values())
