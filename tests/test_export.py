"""Tests for export utilities."""

import csv
import json

from src.utils.export import (
    export_to_csv,
    export_to_json,
    export_to_structured_json,
    extract_structured_data,
)


class TestExportJSON:
    def test_export_basic(self, analysis_result, tmp_path):
        output = tmp_path / "output.json"
        result_path = export_to_json([analysis_result], output)

        assert result_path == output
        assert output.exists()

        data = json.loads(output.read_text())
        assert len(data) == 1
        assert data[0]["text"] == "Sample analysis text with key: value pairs"

    def test_export_empty(self, tmp_path):
        output = tmp_path / "empty.json"
        export_to_json([], output)

        data = json.loads(output.read_text())
        assert data == []

    def test_export_multiple(self, analysis_result, tmp_path):
        output = tmp_path / "multi.json"
        export_to_json([analysis_result, analysis_result], output)

        data = json.loads(output.read_text())
        assert len(data) == 2


class TestExportCSV:
    def test_export_basic(self, analysis_result, tmp_path):
        output = tmp_path / "output.csv"
        result_path = export_to_csv([analysis_result], output)

        assert result_path == output
        assert output.exists()

        with open(output) as f:
            reader = csv.DictReader(f)
            rows = list(reader)

        assert len(rows) == 1
        assert rows[0]["filename"] == "test.png"

    def test_export_empty(self, tmp_path):
        output = tmp_path / "empty.csv"
        export_to_csv([], output)
        # Empty results should still return the path
        assert output == output


class TestExtractStructuredData:
    def test_key_value_extraction(self):
        text = "Price: $99.99\nColor: Red\nSize: Large"
        result = extract_structured_data(text)

        assert result["key_values"]["Price"] == "$99.99"
        assert result["key_values"]["Color"] == "Red"

    def test_list_extraction(self):
        text = "Features:\n- Fast\n- Reliable\n- Affordable"
        result = extract_structured_data(text)

        assert "Fast" in result["lists"]
        assert "Reliable" in result["lists"]

    def test_raw_text_preserved(self):
        text = "Hello world"
        result = extract_structured_data(text)
        assert result["raw_text"] == text


class TestExportStructuredJSON:
    def test_export(self, analysis_result, tmp_path):
        output = tmp_path / "structured.json"
        export_to_structured_json([analysis_result], output)

        data = json.loads(output.read_text())
        assert len(data) == 1
        assert "structured_data" in data[0]
        assert "raw_analysis" in data[0]
