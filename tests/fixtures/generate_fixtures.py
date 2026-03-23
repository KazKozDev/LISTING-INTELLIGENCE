#!/usr/bin/env python3
"""Generate minimal test fixture files using only the standard library.

Creates:
  - test_product.png    : 10x10 solid red PNG  (< 1 KB)
  - test_competitor.png : 10x10 solid blue PNG (< 1 KB)
  - test_document.pdf   : single-page PDF with the text "Test Document" (< 1 KB)

PNG generation uses struct + zlib (no Pillow needed).
PDF generation writes a minimal hand-crafted PDF 1.4 file.
"""

from __future__ import annotations

import struct
import zlib
from pathlib import Path

FIXTURES_DIR = Path(__file__).resolve().parent


# ---------------------------------------------------------------------------
# PNG helpers
# ---------------------------------------------------------------------------

def _make_chunk(chunk_type: bytes, data: bytes) -> bytes:
    """Build a single PNG chunk: length + type + data + CRC."""
    raw = chunk_type + data
    return (
        struct.pack(">I", len(data))
        + raw
        + struct.pack(">I", zlib.crc32(raw) & 0xFFFFFFFF)
    )


def create_png(
    path: Path, r: int, g: int, b: int, width: int = 10, height: int = 10
) -> None:
    """Write a minimal solid-colour PNG file.

    Each row is: filter-byte (0x00) + width * (R, G, B).
    The IDAT payload is the zlib-compressed scanline data.
    """
    # IHDR: width, height, bit-depth=8, colour-type=2 (RGB),
    #       compression=0, filter=0, interlace=0
    ihdr_data = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)

    # Raw scanline data (no filter)
    row = b"\x00" + bytes([r, g, b]) * width
    raw_image = row * height
    compressed = zlib.compress(raw_image)

    with open(path, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n")           # PNG signature
        f.write(_make_chunk(b"IHDR", ihdr_data))
        f.write(_make_chunk(b"IDAT", compressed))
        f.write(_make_chunk(b"IEND", b""))


# ---------------------------------------------------------------------------
# PDF helper
# ---------------------------------------------------------------------------

def create_pdf(path: Path, text: str = "Test Document") -> None:
    """Write a minimal single-page PDF 1.4 file (< 1 KB).

    Structure:
      obj 1 - Catalog
      obj 2 - Pages
      obj 3 - Page
      obj 4 - Font (Helvetica)
      obj 5 - Content stream
    """
    # Content stream: place text near top-left
    stream_body = f"BT /F1 12 Tf 72 720 Td ({text}) Tj ET".encode()
    stream_obj = (
        f"5 0 obj\n<< /Length {len(stream_body)} >>\nstream\n".encode()
        + stream_body
        + b"\nendstream\nendobj\n"
    )

    objects: list[bytes] = [
        # 1 - Catalog
        b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
        # 2 - Pages
        b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
        # 3 - Page
        b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]"
        b" /Contents 5 0 R /Resources << /Font << /F1 4 0 R >> >> >>\nendobj\n",
        # 4 - Font
        b"4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
        # 5 - Content stream
        stream_obj,
    ]

    body = b""
    offsets: list[int] = []
    header = b"%PDF-1.4\n"
    pos = len(header)
    for obj in objects:
        offsets.append(pos)
        body += obj
        pos += len(obj)

    # Cross-reference table
    xref_offset = pos
    xref = f"xref\n0 {len(objects) + 1}\n".encode()
    xref += b"0000000000 65535 f \n"
    for off in offsets:
        xref += f"{off:010d} 00000 n \n".encode()

    trailer = (
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\n"
        f"startxref\n{xref_offset}\n%%EOF\n"
    ).encode()

    with open(path, "wb") as f:
        f.write(header + body + xref + trailer)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    FIXTURES_DIR.mkdir(parents=True, exist_ok=True)

    red_path = FIXTURES_DIR / "test_product.png"
    create_png(red_path, r=255, g=0, b=0)
    print(f"Created {red_path}  ({red_path.stat().st_size} bytes)")

    blue_path = FIXTURES_DIR / "test_competitor.png"
    create_png(blue_path, r=0, g=0, b=255)
    print(f"Created {blue_path}  ({blue_path.stat().st_size} bytes)")

    pdf_path = FIXTURES_DIR / "test_document.pdf"
    create_pdf(pdf_path)
    print(f"Created {pdf_path}  ({pdf_path.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
