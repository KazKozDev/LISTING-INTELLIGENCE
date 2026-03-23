"""Batch processor for multiple product images."""

import io
import csv
import logging
import tempfile
import zipfile
from pathlib import Path
from typing import List, Dict, Any, Optional, Callable, Union

from src.vision_agent import VisionAgent
from .product_analyzer import ProductAnalyzer

logger = logging.getLogger(__name__)

SUPPORTED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp"}


class BatchProcessor:
    """Process multiple product images from ZIP or file list."""

    def __init__(self, agent: VisionAgent):
        self.agent = agent
        self.analyzer = ProductAnalyzer(agent)

    def process_zip(
        self,
        zip_path: Union[str, Path],
        marketplace: str = "general",
        progress_callback: Optional[Callable[[int, int, str], None]] = None,
    ) -> List[Dict[str, Any]]:
        """Extract and analyze all images from a ZIP archive.

        Args:
            zip_path: Path to the ZIP file.
            marketplace: Target marketplace for analysis.
            progress_callback: Optional callback(current, total, filename).

        Returns:
            List of analysis result dicts.
        """
        zip_path = Path(zip_path)
        results = []

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir)

            with zipfile.ZipFile(zip_path, "r") as zf:
                image_names = [
                    name
                    for name in zf.namelist()
                    if not name.startswith("__MACOSX")
                    and Path(name).suffix.lower() in SUPPORTED_EXTENSIONS
                ]

                zf.extractall(tmp_path, members=image_names)

            total = len(image_names)
            for i, name in enumerate(image_names):
                image_path = tmp_path / name
                if progress_callback:
                    progress_callback(i, total, Path(name).name)

                try:
                    result = self.analyzer.analyze_product(image_path, marketplace)
                    results.append(
                        {
                            "filename": Path(name).name,
                            "analysis": result.text,
                            "metadata": result.metadata,
                            "success": True,
                        }
                    )
                except Exception as e:
                    logger.error(f"Failed to analyze {name}: {e}")
                    results.append(
                        {
                            "filename": Path(name).name,
                            "analysis": "",
                            "metadata": {},
                            "success": False,
                            "error": str(e),
                        }
                    )

                if progress_callback:
                    progress_callback(i + 1, total, Path(name).name)

        return results

    def process_files(
        self,
        file_paths: List[Union[str, Path]],
        marketplace: str = "general",
        progress_callback: Optional[Callable[[int, int, str], None]] = None,
    ) -> List[Dict[str, Any]]:
        """Analyze a list of image files.

        Args:
            file_paths: List of image paths.
            marketplace: Target marketplace.
            progress_callback: Optional callback(current, total, filename).

        Returns:
            List of analysis result dicts.
        """
        results = []
        total = len(file_paths)

        for i, fp in enumerate(file_paths):
            fp = Path(fp)
            if progress_callback:
                progress_callback(i, total, fp.name)

            try:
                result = self.analyzer.analyze_product(fp, marketplace)
                results.append(
                    {
                        "filename": fp.name,
                        "analysis": result.text,
                        "metadata": result.metadata,
                        "success": True,
                    }
                )
            except Exception as e:
                logger.error(f"Failed to analyze {fp.name}: {e}")
                results.append(
                    {
                        "filename": fp.name,
                        "analysis": "",
                        "metadata": {},
                        "success": False,
                        "error": str(e),
                    }
                )

            if progress_callback:
                progress_callback(i + 1, total, fp.name)

        return results

    @staticmethod
    def results_to_csv(results: List[Dict[str, Any]]) -> str:
        """Convert batch results to CSV string."""
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(
            ["Filename", "Success", "Analysis", "Model", "Provider", "Tokens"]
        )

        for r in results:
            meta = r.get("metadata", {})
            usage = meta.get("usage", {})
            writer.writerow(
                [
                    r.get("filename", ""),
                    r.get("success", False),
                    r.get("analysis", "").replace("\n", " "),
                    meta.get("model", ""),
                    meta.get("provider", ""),
                    usage.get("total_tokens", 0),
                ]
            )

        return output.getvalue()
