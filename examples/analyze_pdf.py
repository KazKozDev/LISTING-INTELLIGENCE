"""Example: Analyzing a PDF document."""

import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from src import VisionAgent


def main():
    """Analyze a PDF document example."""
    # Initialize the agent
    agent = VisionAgent(model="qwen3-vl:8b")

    # Example PDF path (replace with your actual PDF)
    pdf_path = "path/to/your/document.pdf"

    print("Analyzing PDF document...")
    print("=" * 60)

    # Option 1: Analyze all pages
    results = agent.analyze_pdf(
        pdf_path,
        task="Summarize the content of this page and extract key information."
    )

    # Display results for each page
    for result in results:
        page_num = result.metadata['page']
        print(f"\n--- Page {page_num} ---")
        print(result.text)
        print("-" * 60)

    # Option 2: Analyze specific pages only
    print("\n\nAnalyzing specific pages (1, 3, 5)...")
    specific_results = agent.analyze_pdf(
        pdf_path,
        task="Extract the main points from this page.",
        pages=[1, 3, 5]
    )

    # Generate a comprehensive report
    report_path = agent.generate_report(
        results=results,
        title="PDF Document Analysis Report",
        output_path="outputs/pdf_analysis_report.md"
    )

    print(f"\n✓ Complete report saved to: {report_path}")

    # Also generate JSON output
    json_path = agent.report_generator.generate_json(
        results=results,
        output_path="outputs/pdf_analysis_report.json"
    )

    print(f"✓ JSON report saved to: {json_path}")


if __name__ == "__main__":
    main()
