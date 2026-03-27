"""PDF processing utilities."""

import logging
from pathlib import Path

import fitz  # PyMuPDF

from config import Config

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class PDFProcessor:
    """Process PDF documents for vision analysis."""

    def __init__(self, config: Config | None = None):
        """Initialize PDF processor.

        Args:
            config: Configuration object.
        """
        self.config = config or Config()
        self.temp_dir = self.config.output_dir / "temp"
        self.temp_dir.mkdir(parents=True, exist_ok=True)

    def extract_pages_as_images(
        self, pdf_path: Path, pages: list[int] | None = None, dpi: int | None = None
    ) -> list[tuple[int, Path]]:
        """Extract PDF pages as images.

        Args:
            pdf_path: Path to PDF file.
            pages: Optional list of page numbers (1-indexed). If None, extracts all.
            dpi: Optional DPI for rendering. If None, uses config default.

        Returns:
            List of tuples (page_number, image_path).
        """
        pdf_path = Path(pdf_path)
        dpi = dpi or self.config.pdf_dpi

        if not pdf_path.exists():
            raise FileNotFoundError(f"PDF not found: {pdf_path}")

        logger.info(f"Extracting pages from: {pdf_path}")

        try:
            doc = fitz.open(pdf_path)
            total_pages = len(doc)

            logger.info(f"PDF has {total_pages} pages")

            # Determine which pages to extract
            if pages is None:
                pages_to_extract = range(1, total_pages + 1)
            else:
                pages_to_extract = [p for p in pages if 1 <= p <= total_pages]

            extracted_pages = []

            for page_num in pages_to_extract:
                try:
                    # Get page (0-indexed in PyMuPDF)
                    page = doc[page_num - 1]

                    # Calculate zoom factor for desired DPI
                    # Default is 72 DPI, so zoom = desired_dpi / 72
                    zoom = dpi / 72
                    mat = fitz.Matrix(zoom, zoom)

                    # Render page to pixmap
                    pix = page.get_pixmap(matrix=mat)

                    # Save as PNG
                    image_path = self.temp_dir / f"{pdf_path.stem}_page_{page_num}.png"
                    pix.save(str(image_path))

                    extracted_pages.append((page_num, image_path))
                    logger.info(f"Extracted page {page_num} -> {image_path}")

                except Exception as e:
                    logger.error(f"Error extracting page {page_num}: {e}")
                    continue

            doc.close()

            logger.info(f"Successfully extracted {len(extracted_pages)} pages")
            return extracted_pages

        except Exception as e:
            logger.error(f"Error processing PDF: {e}")
            raise

    def extract_text(self, pdf_path: Path) -> list[tuple[int, str]]:
        """Extract text content from PDF pages.

        Args:
            pdf_path: Path to PDF file.

        Returns:
            List of tuples (page_number, text_content).
        """
        pdf_path = Path(pdf_path)

        if not pdf_path.exists():
            raise FileNotFoundError(f"PDF not found: {pdf_path}")

        logger.info(f"Extracting text from: {pdf_path}")

        try:
            doc = fitz.open(pdf_path)
            text_content = []

            for page_num in range(1, len(doc) + 1):
                page = doc[page_num - 1]
                text = page.get_text()
                text_content.append((page_num, text))

            doc.close()

            logger.info(f"Extracted text from {len(text_content)} pages")
            return text_content

        except Exception as e:
            logger.error(f"Error extracting text: {e}")
            raise

    def get_pdf_info(self, pdf_path: Path) -> dict:
        """Get PDF metadata and information.

        Args:
            pdf_path: Path to PDF file.

        Returns:
            Dictionary with PDF information.
        """
        pdf_path = Path(pdf_path)

        if not pdf_path.exists():
            raise FileNotFoundError(f"PDF not found: {pdf_path}")

        try:
            doc = fitz.open(pdf_path)

            info = {
                "filename": pdf_path.name,
                "pages": len(doc),
                "metadata": doc.metadata,
                "file_size": pdf_path.stat().st_size,
            }

            doc.close()

            return info

        except Exception as e:
            logger.error(f"Error getting PDF info: {e}")
            raise

    def cleanup_temp_files(self) -> None:
        """Clean up temporary image files."""
        try:
            for file in self.temp_dir.glob("*.png"):
                file.unlink()
            logger.info("Cleaned up temporary files")
        except Exception as e:
            logger.error(f"Error cleaning up temp files: {e}")
