"""Tests for PDF processor."""

import pytest
from pathlib import Path
from unittest.mock import patch, MagicMock, PropertyMock


class TestPDFProcessorInit:
    def test_init_default(self, test_config):
        from src.pdf_processor import PDFProcessor

        processor = PDFProcessor(config=test_config)
        assert processor.config == test_config
        assert processor.temp_dir.exists()

    def test_init_creates_temp_dir(self, test_config, tmp_path):
        test_config.output_dir = tmp_path / "test_output"
        from src.pdf_processor import PDFProcessor

        processor = PDFProcessor(config=test_config)
        assert processor.temp_dir.exists()
        assert processor.temp_dir == test_config.output_dir / "temp"


class TestExtractPagesAsImages:
    def test_file_not_found(self, test_config):
        from src.pdf_processor import PDFProcessor

        processor = PDFProcessor(config=test_config)
        with pytest.raises(FileNotFoundError, match="PDF not found"):
            processor.extract_pages_as_images(Path("/nonexistent/file.pdf"))

    @patch("src.pdf_processor.fitz")
    def test_extract_all_pages(self, mock_fitz, test_config, tmp_path):
        from src.pdf_processor import PDFProcessor

        # Create fake PDF file
        pdf_path = tmp_path / "test.pdf"
        pdf_path.write_bytes(b"%PDF-1.4 fake")

        # Mock fitz document
        mock_page = MagicMock()
        mock_pixmap = MagicMock()
        mock_page.get_pixmap.return_value = mock_pixmap

        mock_doc = MagicMock()
        mock_doc.__len__ = lambda self: 3
        mock_doc.__getitem__ = lambda self, idx: mock_page
        mock_fitz.open.return_value = mock_doc
        mock_fitz.Matrix = MagicMock()

        processor = PDFProcessor(config=test_config)
        result = processor.extract_pages_as_images(pdf_path)

        assert len(result) == 3
        assert all(isinstance(r, tuple) and len(r) == 2 for r in result)
        assert result[0][0] == 1  # page numbers start at 1
        assert result[1][0] == 2
        assert result[2][0] == 3
        assert mock_pixmap.save.call_count == 3
        mock_doc.close.assert_called_once()

    @patch("src.pdf_processor.fitz")
    def test_extract_specific_pages(self, mock_fitz, test_config, tmp_path):
        from src.pdf_processor import PDFProcessor

        pdf_path = tmp_path / "test.pdf"
        pdf_path.write_bytes(b"%PDF-1.4 fake")

        mock_page = MagicMock()
        mock_pixmap = MagicMock()
        mock_page.get_pixmap.return_value = mock_pixmap

        mock_doc = MagicMock()
        mock_doc.__len__ = lambda self: 5
        mock_doc.__getitem__ = lambda self, idx: mock_page
        mock_fitz.open.return_value = mock_doc
        mock_fitz.Matrix = MagicMock()

        processor = PDFProcessor(config=test_config)
        result = processor.extract_pages_as_images(pdf_path, pages=[1, 3])

        assert len(result) == 2
        assert result[0][0] == 1
        assert result[1][0] == 3

    @patch("src.pdf_processor.fitz")
    def test_extract_pages_filters_invalid(self, mock_fitz, test_config, tmp_path):
        from src.pdf_processor import PDFProcessor

        pdf_path = tmp_path / "test.pdf"
        pdf_path.write_bytes(b"%PDF-1.4 fake")

        mock_page = MagicMock()
        mock_pixmap = MagicMock()
        mock_page.get_pixmap.return_value = mock_pixmap

        mock_doc = MagicMock()
        mock_doc.__len__ = lambda self: 2
        mock_doc.__getitem__ = lambda self, idx: mock_page
        mock_fitz.open.return_value = mock_doc
        mock_fitz.Matrix = MagicMock()

        processor = PDFProcessor(config=test_config)
        # Page 0 and 99 are out of range for a 2-page PDF
        result = processor.extract_pages_as_images(pdf_path, pages=[0, 1, 2, 99])

        assert len(result) == 2  # Only pages 1 and 2 are valid

    @patch("src.pdf_processor.fitz")
    def test_extract_custom_dpi(self, mock_fitz, test_config, tmp_path):
        from src.pdf_processor import PDFProcessor

        pdf_path = tmp_path / "test.pdf"
        pdf_path.write_bytes(b"%PDF-1.4 fake")

        mock_page = MagicMock()
        mock_pixmap = MagicMock()
        mock_page.get_pixmap.return_value = mock_pixmap

        mock_doc = MagicMock()
        mock_doc.__len__ = lambda self: 1
        mock_doc.__getitem__ = lambda self, idx: mock_page
        mock_fitz.open.return_value = mock_doc
        mock_fitz.Matrix = MagicMock()

        processor = PDFProcessor(config=test_config)
        processor.extract_pages_as_images(pdf_path, dpi=300)

        # Matrix should be called with zoom = 300/72
        mock_fitz.Matrix.assert_called_with(300 / 72, 300 / 72)

    @patch("src.pdf_processor.fitz")
    def test_extract_page_error_continues(self, mock_fitz, test_config, tmp_path):
        from src.pdf_processor import PDFProcessor

        pdf_path = tmp_path / "test.pdf"
        pdf_path.write_bytes(b"%PDF-1.4 fake")

        call_count = 0

        def side_effect(self_doc, idx):
            nonlocal call_count
            call_count += 1
            if call_count == 2:
                raise RuntimeError("page rendering error")
            page = MagicMock()
            pixmap = MagicMock()
            page.get_pixmap.return_value = pixmap
            return page

        mock_doc = MagicMock()
        mock_doc.__len__ = lambda self: 3
        mock_doc.__getitem__ = side_effect
        mock_fitz.open.return_value = mock_doc
        mock_fitz.Matrix = MagicMock()

        processor = PDFProcessor(config=test_config)
        result = processor.extract_pages_as_images(pdf_path)

        # Page 2 failed, but pages 1 and 3 should succeed
        assert len(result) == 2


class TestExtractText:
    def test_text_file_not_found(self, test_config):
        from src.pdf_processor import PDFProcessor

        processor = PDFProcessor(config=test_config)
        with pytest.raises(FileNotFoundError, match="PDF not found"):
            processor.extract_text(Path("/nonexistent/file.pdf"))

    @patch("src.pdf_processor.fitz")
    def test_extract_text(self, mock_fitz, test_config, tmp_path):
        from src.pdf_processor import PDFProcessor

        pdf_path = tmp_path / "test.pdf"
        pdf_path.write_bytes(b"%PDF-1.4 fake")

        mock_page1 = MagicMock()
        mock_page1.get_text.return_value = "Hello World"
        mock_page2 = MagicMock()
        mock_page2.get_text.return_value = "Second page text"

        pages = [mock_page1, mock_page2]

        mock_doc = MagicMock()
        mock_doc.__len__ = lambda self: 2
        mock_doc.__getitem__ = lambda self, idx: pages[idx]
        mock_fitz.open.return_value = mock_doc

        processor = PDFProcessor(config=test_config)
        result = processor.extract_text(pdf_path)

        assert len(result) == 2
        assert result[0] == (1, "Hello World")
        assert result[1] == (2, "Second page text")
        mock_doc.close.assert_called_once()


class TestGetPDFInfo:
    def test_info_file_not_found(self, test_config):
        from src.pdf_processor import PDFProcessor

        processor = PDFProcessor(config=test_config)
        with pytest.raises(FileNotFoundError, match="PDF not found"):
            processor.get_pdf_info(Path("/nonexistent/file.pdf"))

    @patch("src.pdf_processor.fitz")
    def test_get_info(self, mock_fitz, test_config, tmp_path):
        from src.pdf_processor import PDFProcessor

        pdf_path = tmp_path / "test.pdf"
        pdf_path.write_bytes(b"%PDF-1.4 fake content")

        mock_doc = MagicMock()
        mock_doc.__len__ = lambda self: 5
        mock_doc.metadata = {"title": "Test Doc", "author": "Test Author"}
        mock_fitz.open.return_value = mock_doc

        processor = PDFProcessor(config=test_config)
        info = processor.get_pdf_info(pdf_path)

        assert info["filename"] == "test.pdf"
        assert info["pages"] == 5
        assert info["metadata"]["title"] == "Test Doc"
        assert info["file_size"] > 0
        mock_doc.close.assert_called_once()


class TestCleanup:
    def test_cleanup_temp_files(self, test_config, tmp_path):
        from src.pdf_processor import PDFProcessor

        test_config.output_dir = tmp_path / "output"
        processor = PDFProcessor(config=test_config)

        # Create some temp PNG files
        (processor.temp_dir / "page_1.png").write_bytes(b"fake png")
        (processor.temp_dir / "page_2.png").write_bytes(b"fake png")
        assert len(list(processor.temp_dir.glob("*.png"))) == 2

        processor.cleanup_temp_files()
        assert len(list(processor.temp_dir.glob("*.png"))) == 0
