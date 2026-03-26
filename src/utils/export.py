"""Export utilities for analysis results."""

import csv
import json
from datetime import datetime
from pathlib import Path
from typing import Any


def export_to_json(results: list[Any], output_path: Path) -> Path:
    """Export analysis results to JSON.

    Args:
        results: List of AnalysisResult objects.
        output_path: Path to save JSON file.

    Returns:
        Path to saved file.
    """
    data = []
    for result in results:
        if hasattr(result, 'to_dict'):
            data.append(result.to_dict())
        else:
            data.append({
                "file_path": str(getattr(result, 'file_path', '')),
                "text": getattr(result, 'text', ''),
                "metadata": getattr(result, 'metadata', {}),
                "timestamp": getattr(result, 'timestamp', datetime.now()).isoformat()
            })

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    return output_path


def export_to_csv(results: list[Any], output_path: Path) -> Path:
    """Export analysis results to CSV.

    Args:
        results: List of AnalysisResult objects.
        output_path: Path to save CSV file.

    Returns:
        Path to saved file.
    """
    if not results:
        return output_path

    # Determine fields
    fieldnames = ['filename', 'timestamp', 'task', 'analysis', 'model', 'provider', 'tokens_used']

    with open(output_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()

        for result in results:
            row = {
                'filename': Path(getattr(result, 'file_path', '')).name,
                'timestamp': getattr(result, 'timestamp', datetime.now()).isoformat(),
                'task': getattr(result, 'task', ''),
                'analysis': getattr(result, 'text', ''),
                'model': getattr(result, 'metadata', {}).get('model', ''),
                'provider': getattr(result, 'metadata', {}).get('provider', ''),
                'tokens_used': getattr(result, 'metadata', {}).get('usage', {}).get('total_tokens', 0)
            }
            writer.writerow(row)

    return output_path


def extract_structured_data(text: str) -> dict[str, Any]:
    """Attempt to extract structured data from analysis text.
    
    Looks for tables, lists, and key-value pairs in the text.

    Args:
        text: Analysis text.

    Returns:
        Dictionary with extracted structured data.
    """
    structured = {
        "raw_text": text,
        "tables": [],
        "key_values": {},
        "lists": []
    }

    lines = text.split('\n')

    # Simple extraction logic (can be enhanced)
    current_section = None
    for line in lines:
        line = line.strip()

        # Detect key-value pairs (e.g., "Price: $99.99")
        if ':' in line and len(line.split(':')) == 2:
            key, value = line.split(':', 1)
            structured["key_values"][key.strip()] = value.strip()

        # Detect list items
        if line.startswith('-') or line.startswith('•') or line.startswith('*'):
            structured["lists"].append(line.lstrip('-•* '))

    return structured


def export_to_structured_json(results: list[Any], output_path: Path) -> Path:
    """Export with structured data extraction.

    Args:
        results: List of AnalysisResult objects.
        output_path: Path to save JSON file.

    Returns:
        Path to saved file.
    """
    data = []
    for result in results:
        text = getattr(result, 'text', '')
        structured = extract_structured_data(text)

        entry = {
            "file": str(getattr(result, 'file_path', '')),
            "timestamp": getattr(result, 'timestamp', datetime.now()).isoformat(),
            "task": getattr(result, 'task', ''),
            "raw_analysis": text,
            "structured_data": structured,
            "metadata": getattr(result, 'metadata', {})
        }
        data.append(entry)

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    return output_path
