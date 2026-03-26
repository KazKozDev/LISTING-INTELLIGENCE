"""Main Vision Agent for multimodal analysis."""

import logging
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

from config import Config
from src.llm.base import BaseLLMProvider
from src.llm.factory import ProviderFactory

from .pdf_processor import PDFProcessor
from .report_generator import ReportGenerator
from .utils.cache import Cache
from .utils.rate_limiter import RateLimiter
from .utils.token_counter import TokenCounter

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class AnalysisResult:
    """Container for analysis results."""

    file_path: Path
    file_type: str
    task: str
    text: str
    metadata: dict[str, Any]
    timestamp: datetime = None

    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.now()

    def to_dict(self) -> dict[str, Any]:
        """Convert result to dictionary."""
        return {
            "file_path": str(self.file_path),
            "file_type": self.file_type,
            "task": self.task,
            "text": self.text,
            "metadata": self.metadata,
            "timestamp": self.timestamp.isoformat(),
        }


class VisionAgent:
    """Main agent for analyzing images, charts, and documents."""

    SUPPORTED_IMAGE_FORMATS = {".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp"}
    SUPPORTED_DOC_FORMATS = {".pdf"}

    def __init__(self, config: Config | None = None):
        """Initialize Vision Agent.

        All configuration is loaded from the config object, which reads from .env file.
        To change provider or model, update your .env file.

        Args:
            config: Configuration object. If None, creates new Config() which loads from .env

        Example:
            # Default: uses settings from .env file
            agent = VisionAgent()

            # Custom config
            custom_config = Config()
            agent = VisionAgent(config=custom_config)
        """
        self.config = config or Config()

        # Create provider instance using config
        provider_config = self.config.get_provider_config()

        self.provider: BaseLLMProvider = ProviderFactory.create(
            provider_name=self.config.provider,
            model=self.config.model,
            api_key=self.config.api_key,
            base_url=self.config.base_url,
            **provider_config
        )

        self.pdf_processor = PDFProcessor(self.config)
        self.report_generator = ReportGenerator(self.config)

        # Initialize utilities
        cache_config = self.config.model_config.get("cache", {})
        cache_enabled = cache_config.get("enabled", True)
        cache_ttl = cache_config.get("ttl_seconds", 3600)
        self.cache = Cache(
            cache_dir=self.config.output_dir / ".cache",
            ttl_seconds=cache_ttl,
        ) if cache_enabled else None

        rate_config = self.config.model_config.get("rate_limits", {})
        rpm = rate_config.get("requests_per_minute", 60)
        self.rate_limiter = RateLimiter(requests_per_minute=rpm)

        self.token_counter = TokenCounter(model=self.config.model)

        logger.info(
            f"Initialized VisionAgent: provider={self.config.provider}, "
            f"model={self.config.model}"
        )

    def analyze_image(
        self,
        image_path: str | Path,
        task: str = "Analyze this image and provide detailed insights.",
        **kwargs
    ) -> AnalysisResult:
        """Analyze a single image.

        Args:
            image_path: Path to the image file.
            task: Analysis task/question.
            **kwargs: Additional parameters for the model.

        Returns:
            AnalysisResult object.
        """
        image_path = Path(image_path)

        if not image_path.exists():
            raise FileNotFoundError(f"Image not found: {image_path}")

        if image_path.suffix.lower() not in self.SUPPORTED_IMAGE_FORMATS:
            raise ValueError(
                f"Unsupported image format: {image_path.suffix}. "
                f"Supported: {self.SUPPORTED_IMAGE_FORMATS}"
            )

        logger.info(f"Analyzing image: {image_path}")

        # Extract parameters
        temperature = kwargs.pop("temperature", self.config.temperature)
        max_tokens = kwargs.pop("max_tokens", self.config.max_tokens)

        # Check cache
        cache_key_data = f"{image_path}:{task}:{self.config.model}"
        if self.cache:
            cached = self.cache.get(cache_key_data, self.config.model)
            if cached:
                logger.info("Cache hit — returning cached result")
                return AnalysisResult(
                    file_path=image_path,
                    file_type="image",
                    task=task,
                    text=cached["text"],
                    metadata=cached["metadata"],
                )

        # Rate limit
        self.rate_limiter.acquire()

        # Call provider to analyze the image
        response = self.provider.analyze_image(
            image_path=image_path,
            prompt=task,
            temperature=temperature,
            max_tokens=max_tokens,
            **kwargs
        )

        total_tokens = response.usage.get("total_tokens", 0)

        result = AnalysisResult(
            file_path=image_path,
            file_type="image",
            task=task,
            text=response.text,
            metadata={
                "model": response.model,
                "usage": response.usage,
                "provider": self.provider.provider_name,
                "prompt_tokens": self.token_counter.count(task),
                **response.metadata,
            },
        )

        # Store in cache
        if self.cache:
            self.cache.set(
                cache_key_data,
                self.config.model,
                {"text": response.text, "metadata": result.metadata},
            )

        logger.info(f"Analysis completed. Tokens used: {total_tokens}")
        return result

    def analyze_chart(
        self,
        chart_path: str | Path,
        task: str | None = None,
        **kwargs
    ) -> AnalysisResult:
        """Analyze a chart or data visualization.

        Args:
            chart_path: Path to the chart image.
            task: Optional custom task. If None, uses default chart analysis.
            **kwargs: Additional parameters.

        Returns:
            AnalysisResult object.
        """
        if task is None:
            task = """Analyze this chart/visualization and provide:
1. Chart type and what it represents
2. Key data points and trends
3. Notable patterns or anomalies
4. Insights and conclusions
5. Any recommendations based on the data"""

        return self.analyze_image(chart_path, task, **kwargs)

    def analyze_ui_screenshot(
        self,
        screenshot_path: str | Path,
        task: str | None = None,
        **kwargs
    ) -> AnalysisResult:
        """Analyze a UI screenshot.

        Args:
            screenshot_path: Path to the screenshot.
            task: Optional custom task.
            **kwargs: Additional parameters.

        Returns:
            AnalysisResult object.
        """
        if task is None:
            task = """Analyze this UI screenshot and provide:
1. Main UI elements and their purpose
2. Layout and design assessment
3. User experience observations
4. Accessibility considerations
5. Suggestions for improvement"""

        return self.analyze_image(screenshot_path, task, **kwargs)

    def analyze_pdf(
        self,
        pdf_path: str | Path,
        task: str = "Summarize and analyze this document.",
        pages: list[int] | None = None,
        **kwargs
    ) -> list[AnalysisResult]:
        """Analyze a PDF document.

        Args:
            pdf_path: Path to the PDF file.
            task: Analysis task.
            pages: Optional list of page numbers to analyze. If None, analyzes all.
            **kwargs: Additional parameters.

        Returns:
            List of AnalysisResult objects, one per page.
        """
        pdf_path = Path(pdf_path)

        if not pdf_path.exists():
            raise FileNotFoundError(f"PDF not found: {pdf_path}")

        if pdf_path.suffix.lower() != ".pdf":
            raise ValueError("File must be a PDF")

        logger.info(f"Processing PDF: {pdf_path}")

        # Extract images from PDF pages
        page_images = self.pdf_processor.extract_pages_as_images(
            pdf_path,
            pages=pages
        )

        results = []

        # Extract parameters
        temperature = kwargs.pop("temperature", self.config.temperature)
        max_tokens = kwargs.pop("max_tokens", self.config.max_tokens)

        for page_num, image_path in page_images:
            logger.info(f"Analyzing page {page_num}...")

            page_task = f"[Page {page_num}] {task}"

            try:
                response = self.provider.analyze_image(
                    image_path=image_path,
                    prompt=page_task,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    **kwargs
                )

                result = AnalysisResult(
                    file_path=pdf_path,
                    file_type="pdf",
                    task=page_task,
                    text=response.text,
                    metadata={
                        "page": page_num,
                        "model": response.model,
                        "usage": response.usage,
                        "provider": self.provider.provider_name,
                        **response.metadata
                    }
                )

                results.append(result)

            except Exception as e:
                logger.error(f"Error analyzing page {page_num}: {e}")
                continue

        logger.info(f"PDF analysis completed: {len(results)} pages processed")
        return results

    def batch_analyze(
        self,
        file_paths: list[str | Path],
        task: str = "Analyze this file.",
        **kwargs
    ) -> list[AnalysisResult]:
        """Analyze multiple files in batch.

        Args:
            file_paths: List of file paths.
            task: Analysis task.
            **kwargs: Additional parameters.

        Returns:
            List of AnalysisResult objects.
        """
        results = []

        for file_path in file_paths:
            file_path = Path(file_path)

            try:
                if file_path.suffix.lower() in self.SUPPORTED_IMAGE_FORMATS:
                    result = self.analyze_image(file_path, task, **kwargs)
                    results.append(result)

                elif file_path.suffix.lower() in self.SUPPORTED_DOC_FORMATS:
                    pdf_results = self.analyze_pdf(file_path, task, **kwargs)
                    results.extend(pdf_results)

                else:
                    logger.warning(f"Unsupported file format: {file_path}")

            except Exception as e:
                logger.error(f"Error analyzing {file_path}: {e}")
                continue

        return results

    def generate_report(
        self,
        results: list[AnalysisResult],
        output_path: str | Path | None = None,
        title: str = "Vision Agent Analysis Report",
        **kwargs
    ) -> Path:
        """Generate a report from analysis results.

        Args:
            results: List of AnalysisResult objects.
            output_path: Optional output path. If None, auto-generates.
            title: Report title.
            **kwargs: Additional report parameters.

        Returns:
            Path to the generated report.
        """
        return self.report_generator.generate(
            results=results,
            output_path=output_path,
            title=title,
            **kwargs
        )

    def interactive_analyze(self, file_path: str | Path) -> None:
        """Interactive analysis mode.

        Args:
            file_path: Path to the file to analyze.
        """
        file_path = Path(file_path)

        print(f"\n{'='*60}")
        print(f"Interactive Analysis: {file_path.name}")
        print(f"{'='*60}\n")

        while True:
            task = input("\nEnter your question (or 'quit' to exit): ").strip()

            if task.lower() in ["quit", "exit", "q"]:
                break

            if not task:
                continue

            try:
                if file_path.suffix.lower() in self.SUPPORTED_IMAGE_FORMATS:
                    result = self.analyze_image(file_path, task)
                elif file_path.suffix.lower() in self.SUPPORTED_DOC_FORMATS:
                    results = self.analyze_pdf(file_path, task)
                    result = results[0] if results else None
                else:
                    print(f"Unsupported file format: {file_path.suffix}")
                    continue

                if result:
                    print(f"\n{'-'*60}")
                    print("Analysis Result:")
                    print(f"{'-'*60}")
                    print(result.text)
                    print(f"{'-'*60}\n")

            except Exception as e:
                print(f"Error: {e}")
