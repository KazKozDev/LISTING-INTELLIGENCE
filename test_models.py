import os
os.environ["PYTORCH_ENABLE_MPS_FALLBACK"] = "1"
from src.ecommerce.quality_scorer import QualityScorer
from src.ecommerce.object_detector import ObjectDetector
from src.ecommerce.text_detector import TextDetector

print("\n--- Testing ObjectDetector ---")
od = ObjectDetector()
res_od = od.detect("tests/__init__.py")  # using a dummy path to see if model loads before failing on image reading
print("YOLO Load Status:", res_od)

print("\n--- Testing QualityScorer ---")
qs = QualityScorer()
res_qs = qs.score("tests/__init__.py")
print("MUSIQ Load Status:", res_qs)

print("\n--- Testing TextDetector ---")
td = TextDetector()
res_td = td.detect("tests/__init__.py")
print("EasyOCR Load Status:", res_td)
