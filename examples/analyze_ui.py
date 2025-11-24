"""Example: Analyzing a UI screenshot."""

import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from src import VisionAgent


def main():
    """Analyze a UI screenshot example."""
    # Initialize the agent
    agent = VisionAgent(model="qwen3-vl:8b")

    # Example screenshot path (replace with your actual screenshot)
    screenshot_path = "path/to/your/screenshot.png"

    print("Analyzing UI screenshot...")
    print("=" * 60)

    # Analyze the UI
    result = agent.analyze_ui_screenshot(
        screenshot_path,
        task="""Analyze this UI screenshot and provide:
        1. What are the main UI elements visible?
        2. What is the purpose of this interface?
        3. How is the layout organized?
        4. Are there any UX/usability issues?
        5. What improvements would you suggest?
        6. Is the interface accessible?
        """
    )

    # Display results
    print("\nUI Analysis Results:")
    print("-" * 60)
    print(result.text)
    print("-" * 60)

    # Save metadata
    print(f"\nProcessing time: {result.metadata['duration_ms']:.2f}ms")
    print(f"Model: {result.metadata['model']}")

    # Generate a report
    report_path = agent.generate_report(
        results=[result],
        title="UI Screenshot Analysis Report",
        output_path="outputs/ui_analysis_report.md"
    )

    print(f"\n✓ Report saved to: {report_path}")


if __name__ == "__main__":
    main()
