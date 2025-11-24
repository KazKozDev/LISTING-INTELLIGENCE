"""Example: Analyzing a chart or data visualization."""

import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from src import VisionAgent


def main():
    """Analyze a chart example."""
    # Initialize the agent
    agent = VisionAgent(model="qwen3-vl:8b")

    # Example chart path (replace with your actual chart)
    chart_path = "path/to/your/chart.png"

    print("Analyzing chart...")
    print("=" * 60)

    # Analyze the chart
    result = agent.analyze_chart(
        chart_path,
        task="""Analyze this chart and provide:
        1. What type of chart is this?
        2. What are the key data points and trends?
        3. Are there any notable patterns or anomalies?
        4. What insights can be drawn from this data?
        5. Any recommendations based on the findings?
        """
    )

    # Display results
    print("\nChart Analysis Results:")
    print("-" * 60)
    print(result.text)
    print("-" * 60)

    # Generate a report
    report_path = agent.generate_report(
        results=[result],
        title="Chart Analysis Report",
        output_path="outputs/chart_analysis_report.md"
    )

    print(f"\n✓ Report saved to: {report_path}")


if __name__ == "__main__":
    main()
