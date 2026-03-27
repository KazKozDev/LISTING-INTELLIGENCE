"""Local Florence-2 image analysis helpers for e-commerce metadata."""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Any

from PIL import Image

from config import Config
from .foreground_masking import ForegroundMaskExtractor

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class FlorenceAnalysisResult:
    """Structured Florence-2 output for product-photo enrichment."""

    caption: str
    seo_title: str
    attributes: list[str] = field(default_factory=list)
    detected_text: str = ""
    model_id: str = "microsoft/Florence-2-base"
    task_prompt: str = "<MORE_DETAILED_CAPTION>"
    warning: str | None = None
    raw_output: str | None = None


class FlorenceAnalyzer:
    """Run Florence-2 tasks against a product image."""

    def __init__(self, config: Config | None = None) -> None:
        self.config = config or Config()
        florence_config = self.config.model_config_data.get("florence2", {})
        self.enabled = bool(florence_config.get("enabled", True))
        self.model_id = str(florence_config.get("model", "microsoft/Florence-2-base"))
        self.device = str(florence_config.get("device", "cpu"))
        self.allow_remote_code = bool(florence_config.get("allow_remote_code", True))
        self.caption_task = str(florence_config.get("caption_task", "<MORE_DETAILED_CAPTION>"))
        self.ocr_task = str(florence_config.get("ocr_task", "<OCR>"))
        self.max_new_tokens = int(florence_config.get("max_new_tokens", 256))
        self.max_ocr_tokens = int(florence_config.get("max_ocr_tokens", 128))
        self.num_beams = int(florence_config.get("num_beams", 3))
        self.max_attributes = int(florence_config.get("max_attributes", 12))

    def analyze(self, image_path: str | Path) -> FlorenceAnalysisResult:
        """Return structured captioning for SEO and attributes."""
        with Image.open(image_path) as img:
            image = img.convert("RGB")

        if not self.enabled:
            return FlorenceAnalysisResult(
                caption="",
                seo_title="",
                model_id=self.model_id,
                task_prompt=self.caption_task,
                warning="Florence-2 analysis is disabled.",
            )

        try:
            processor, model, torch_device, torch_dtype = self._load_model_bundle(
                self.model_id,
                self.device,
                self.allow_remote_code,
            )
        except Exception as exc:
            logger.warning("Florence-2 model unavailable: %s", exc)
            return FlorenceAnalysisResult(
                caption="",
                seo_title="",
                model_id=self.model_id,
                task_prompt=self.caption_task,
                warning=f"Florence-2 model unavailable: {exc}",
            )

        try:
            caption, raw_caption = self._run_task(
                processor,
                model,
                torch_device,
                torch_dtype,
                image,
                self.caption_task,
                self.max_new_tokens,
            )
            detected_text, _ = self._run_task(
                processor,
                model,
                torch_device,
                torch_dtype,
                image,
                self.ocr_task,
                self.max_ocr_tokens,
            )
            attributes = self._derive_attributes(caption, detected_text)
            seo_title = self._build_seo_title(caption, attributes)

            return FlorenceAnalysisResult(
                caption=caption,
                seo_title=seo_title,
                attributes=attributes,
                detected_text=detected_text,
                model_id=self.model_id,
                task_prompt=self.caption_task,
                raw_output=raw_caption,
            )
        except Exception as exc:
            logger.warning("Florence-2 analysis failed: %s", exc)
            return FlorenceAnalysisResult(
                caption="",
                seo_title="",
                model_id=self.model_id,
                task_prompt=self.caption_task,
                warning=f"Florence-2 analysis failed: {exc}",
            )

    def to_dict(self, result: FlorenceAnalysisResult) -> dict[str, Any]:
        """Serialize Florence result to a JSON-safe dict."""
        data: dict[str, Any] = {
            "caption": result.caption,
            "seo_title": result.seo_title,
            "attributes": result.attributes,
            "detected_text": result.detected_text,
            "model_id": result.model_id,
            "task_prompt": result.task_prompt,
        }
        if result.raw_output:
            data["raw_output"] = result.raw_output
        if result.warning:
            data["warning"] = result.warning
        return data

    def _derive_attributes(
        self,
        caption: str,
        detected_text: str,
    ) -> list[str]:
        candidates: list[str] = []
        normalized_seen: set[str] = set()

        def add_candidate(value: str) -> None:
            cleaned = re.sub(r"\s+", " ", value).strip(" ,.;:-")
            cleaned = re.sub(
                r"^(a|an|the)\s+",
                "",
                cleaned,
                flags=re.IGNORECASE,
            )
            if not cleaned:
                return
            lowered = cleaned.lower()
            if lowered in normalized_seen:
                return
            if len(cleaned) < 3 or len(cleaned) > 64:
                return
            normalized_seen.add(lowered)
            candidates.append(cleaned)

        stripped_caption = re.sub(
            (
                r"^(the image shows|the photo shows|this image shows|"
                r"a product photo of|a photo of)\s+"
            ),
            "",
            caption.strip(),
            flags=re.IGNORECASE,
        )
        for part in re.split(r"[,.;]|\band\b", stripped_caption):
            add_candidate(part)

        for token in re.findall(
            r"[A-Za-z0-9][A-Za-z0-9\-+/]{2,}",
            detected_text,
        ):
            add_candidate(token)

        return candidates[: self.max_attributes]

    @staticmethod
    def _build_seo_title(caption: str, attributes: list[str]) -> str:
        if caption:
            title = caption.strip()
        elif attributes:
            title = ", ".join(attributes[:4])
        else:
            return ""

        compact = re.sub(r"\s+", " ", title)
        if len(compact) <= 72:
            return compact
        return compact[:69].rstrip(" ,.;:-") + "..."

    def _run_task(
        self,
        processor,
        model,
        torch_device,
        torch_dtype,
        image: Image.Image,
        task_prompt: str,
        max_new_tokens: int,
    ) -> tuple[str, str]:
        import torch

        model_inputs = processor(
            text=task_prompt,
            images=image,
            return_tensors="pt",
        )
        prepared_inputs: dict[str, Any] = {}
        for key, value in model_inputs.items():
            if not hasattr(value, "to"):
                prepared_inputs[key] = value
                continue
            if torch.is_floating_point(value):
                prepared_inputs[key] = value.to(
                    device=torch_device,
                    dtype=torch_dtype,
                )
            else:
                prepared_inputs[key] = value.to(device=torch_device)

        generated_ids = model.generate(
            **prepared_inputs,
            max_new_tokens=max_new_tokens,
            num_beams=self.num_beams,
            do_sample=False,
        )
        raw_output = processor.batch_decode(
            generated_ids,
            skip_special_tokens=False,
        )[0]
        parsed_text = self._post_process_generation(
            processor,
            raw_output,
            task_prompt,
            image.size,
        )
        return parsed_text, raw_output

    @staticmethod
    def _post_process_generation(
        processor,
        raw_output: str,
        task_prompt: str,
        image_size: tuple[int, int],
    ) -> str:
        try:
            parsed = processor.post_process_generation(
                raw_output,
                task=task_prompt,
                image_size=image_size,
            )
        except Exception:
            cleaned = raw_output.replace(task_prompt, "").strip()
            return re.sub(r"\s+", " ", cleaned)

        if isinstance(parsed, dict):
            value = parsed.get(task_prompt)
            if isinstance(value, str):
                return value.strip()
            if value is not None:
                if isinstance(value, list):
                    parts = [str(item).strip() for item in value if str(item).strip()]
                    return ", ".join(parts)
                return json.dumps(value, ensure_ascii=True)

            for fallback in parsed.values():
                if isinstance(fallback, str) and fallback.strip():
                    return fallback.strip()

        if isinstance(parsed, str):
            return parsed.strip()

        return re.sub(r"\s+", " ", raw_output.replace(task_prompt, "")).strip()

    @staticmethod
    @lru_cache(maxsize=2)
    def _load_model_bundle(
        model_id: str,
        device: str,
        allow_remote_code: bool,
    ):
        import torch
        from transformers import AutoModelForCausalLM, AutoProcessor

        torch_device = ForegroundMaskExtractor._resolve_torch_device(device)
        if torch_device.type == "cuda":
            torch_dtype = torch.float16
        else:
            torch_dtype = torch.float32

        processor = AutoProcessor.from_pretrained(
            model_id,
            trust_remote_code=allow_remote_code,
        )
        model = AutoModelForCausalLM.from_pretrained(
            model_id,
            trust_remote_code=allow_remote_code,
            torch_dtype=torch_dtype,
        )
        model.to(torch_device)
        model.eval()
        return processor, model, torch_device, torch_dtype
