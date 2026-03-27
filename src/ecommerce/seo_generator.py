"""Backward-compatible SEO content generator wrapper."""

from .listing_service import ListingService


class SEOGenerator(ListingService):
    """Compatibility wrapper around the shared listing service."""

    # Inherits all behavior from ListingService for backward compatibility.
