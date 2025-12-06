"""Token counting utility."""

from typing import Optional
import tiktoken

class TokenCounter:
    """Token counter using tiktoken."""

    def __init__(self, model: str = "gpt-4"):
        """Initialize token counter.

        Args:
            model: Model name to use for encoding.
        """
        self.model = model
        try:
            self.encoding = tiktoken.encoding_for_model(model)
        except KeyError:
            # Fallback to cl100k_base for newer/unknown models
            self.encoding = tiktoken.get_encoding("cl100k_base")

    def count(self, text: str) -> int:
        """Count tokens in text.

        Args:
            text: Input text.

        Returns:
            Number of tokens.
        """
        if not text:
            return 0
        return len(self.encoding.encode(text))

    def truncate(self, text: str, max_tokens: int) -> str:
        """Truncate text to fit within max_tokens.

        Args:
            text: Input text.
            max_tokens: Maximum tokens allowed.

        Returns:
            Truncated text.
        """
        tokens = self.encoding.encode(text)
        if len(tokens) <= max_tokens:
            return text
        
        return self.encoding.decode(tokens[:max_tokens])
