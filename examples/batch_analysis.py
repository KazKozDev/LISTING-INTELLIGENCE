"""Example: Batch analyzing multiple files."""

import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from src import VisionAgent


def main():
    """Batch analysis example."""
    # Initialize the agent
    agent = VisionAgent()

    # Example: Analyze all images in a directory
    image_directory = Path("path/to/your/images/")

    # Collect all image files
    image_files = []
    for ext in [".png", ".jpg", ".jpeg"]:
        image_files.extend(image_directory.glob(f"*{ext}"))

    if not image_files:
        print(f"No images found in {image_directory}")
        return

    print(f"Found {len(image_files)} images to analyze")
    print("=" * 60)

    # Batch analyze
    results = agent.batch_analyze(
        file_paths=image_files,
        task="Describe this image and identify key elements."
    )

    print(f"\n✓ Successfully analyzed {len(results)} files")

    # Display summary
    for result in results[:3]:  # Show first 3
        print(f"\n--- {result.file_path.name} ---")
        print(result.text[:200] + "..." if len(result.text) > 200 else result.text)

    # Generate comprehensive report
    report_path = agent.generate_report(
        results=results,
        title="Batch Analysis Report",
        output_path="outputs/batch_analysis_report.md"
    )

    print(f"\n✓ Complete report saved to: {report_path}")


if __name__ == "__main__":
    main()
