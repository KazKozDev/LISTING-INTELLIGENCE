# Test Fixtures

Minimal fixture files used by the test suite. Every file is under 1 KB.

## Files

| File                  | Format | Description                                         |
|-----------------------|--------|-----------------------------------------------------|
| `test_product.png`    | PNG    | 10x10 solid **red** image (RGB 255, 0, 0)           |
| `test_competitor.png` | PNG    | 10x10 solid **blue** image (RGB 0, 0, 255)          |
| `test_document.pdf`   | PDF    | Single-page PDF containing the text "Test Document" |

## Regenerating

If you need to regenerate the fixture files, run:

```bash
python tests/fixtures/generate_fixtures.py
```

The script uses only the Python standard library (`struct`, `zlib`) for PNG
generation and writes a minimal raw PDF 1.4 file -- no third-party packages
are required.
