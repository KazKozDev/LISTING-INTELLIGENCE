#!/usr/bin/env python3
"""Command-line interface for Vision Agent Analyst."""

import argparse
import logging
import sys
from pathlib import Path
from typing import List

from src import VisionAgent
from src.config import Config

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


def analyze_command(args):
    """Handle the analyze command."""
    try:
        agent = VisionAgent(model=args.model)
        file_path = Path(args.file)

        if not file_path.exists():
            print(f"Error: File not found: {file_path}")
            return 1

        print(f"\n{'='*60}")
        print(f"Analyzing: {file_path.name}")
        print(f"{'='*60}\n")

        # Determine file type and analyze
        if file_path.suffix.lower() in agent.SUPPORTED_IMAGE_FORMATS:
            result = agent.analyze_image(
                file_path,
                task=args.task,
                temperature=args.temperature
            )
            results = [result]

        elif file_path.suffix.lower() in agent.SUPPORTED_DOC_FORMATS:
            results = agent.analyze_pdf(
                file_path,
                task=args.task,
                temperature=args.temperature
            )

        else:
            print(f"Error: Unsupported file format: {file_path.suffix}")
            return 1

        # Display results
        for result in results:
            print(f"\n{'-'*60}")
            if result.file_type == "pdf":
                print(f"Page {result.metadata['page']}:")
            print(f"{'-'*60}")
            print(result.text)
            print(f"{'-'*60}\n")

        # Generate report if requested
        if args.output:
            output_path = agent.generate_report(
                results,
                output_path=args.output,
                title=f"Analysis: {file_path.name}"
            )
            print(f"\n✓ Report saved to: {output_path}")

        return 0

    except Exception as e:
        logger.error(f"Error during analysis: {e}")
        print(f"\nError: {e}")
        return 1


def batch_command(args):
    """Handle the batch command."""
    try:
        agent = VisionAgent(model=args.model)
        input_path = Path(args.input)

        if not input_path.exists():
            print(f"Error: Directory not found: {input_path}")
            return 1

        # Collect files
        file_paths: List[Path] = []

        if input_path.is_dir():
            # Get all supported files from directory
            for ext in agent.SUPPORTED_IMAGE_FORMATS:
                file_paths.extend(input_path.glob(f"*{ext}"))
            for ext in agent.SUPPORTED_DOC_FORMATS:
                file_paths.extend(input_path.glob(f"*{ext}"))
        else:
            file_paths = [input_path]

        if not file_paths:
            print(f"No supported files found in: {input_path}")
            return 1

        print(f"\n{'='*60}")
        print(f"Batch Analysis: {len(file_paths)} files")
        print(f"{'='*60}\n")

        # Analyze files
        results = agent.batch_analyze(
            file_paths,
            task=args.task,
            temperature=args.temperature
        )

        print(f"\n✓ Analyzed {len(results)} files successfully")

        # Generate report
        if args.output:
            output_path = Path(args.output)
        else:
            output_path = agent.config.output_dir / "batch_report.md"

        report_path = agent.generate_report(
            results,
            output_path=output_path,
            title="Batch Analysis Report"
        )

        print(f"✓ Report saved to: {report_path}")

        return 0

    except Exception as e:
        logger.error(f"Error during batch analysis: {e}")
        print(f"\nError: {e}")
        return 1


def interactive_command(args):
    """Handle the interactive command."""
    try:
        agent = VisionAgent(model=args.model)

        if args.file:
            file_path = Path(args.file)
            if not file_path.exists():
                print(f"Error: File not found: {file_path}")
                return 1
            agent.interactive_analyze(file_path)
        else:
            print("\nInteractive mode")
            print("Enter file path to analyze, or 'quit' to exit.\n")

            while True:
                file_input = input("File path: ").strip()

                if file_input.lower() in ["quit", "exit", "q"]:
                    break

                file_path = Path(file_input)

                if not file_path.exists():
                    print(f"Error: File not found: {file_path}")
                    continue

                agent.interactive_analyze(file_path)

        return 0

    except KeyboardInterrupt:
        print("\n\nInterrupted by user")
        return 0
    except Exception as e:
        logger.error(f"Error in interactive mode: {e}")
        print(f"\nError: {e}")
        return 1


def chart_command(args):
    """Handle the chart analysis command."""
    try:
        agent = VisionAgent(model=args.model)
        file_path = Path(args.file)

        if not file_path.exists():
            print(f"Error: File not found: {file_path}")
            return 1

        print(f"\n{'='*60}")
        print(f"Analyzing Chart: {file_path.name}")
        print(f"{'='*60}\n")

        result = agent.analyze_chart(
            file_path,
            task=args.task,
            temperature=args.temperature
        )

        print(f"\n{'-'*60}")
        print("Chart Analysis:")
        print(f"{'-'*60}")
        print(result.text)
        print(f"{'-'*60}\n")

        if args.output:
            output_path = agent.generate_report(
                [result],
                output_path=args.output,
                title=f"Chart Analysis: {file_path.name}"
            )
            print(f"\n✓ Report saved to: {output_path}")

        return 0

    except Exception as e:
        logger.error(f"Error analyzing chart: {e}")
        print(f"\nError: {e}")
        return 1


def ui_command(args):
    """Handle the UI screenshot analysis command."""
    try:
        agent = VisionAgent(model=args.model)
        file_path = Path(args.file)

        if not file_path.exists():
            print(f"Error: File not found: {file_path}")
            return 1

        print(f"\n{'='*60}")
        print(f"Analyzing UI Screenshot: {file_path.name}")
        print(f"{'='*60}\n")

        result = agent.analyze_ui_screenshot(
            file_path,
            task=args.task,
            temperature=args.temperature
        )

        print(f"\n{'-'*60}")
        print("UI Analysis:")
        print(f"{'-'*60}")
        print(result.text)
        print(f"{'-'*60}\n")

        if args.output:
            output_path = agent.generate_report(
                [result],
                output_path=args.output,
                title=f"UI Analysis: {file_path.name}"
            )
            print(f"\n✓ Report saved to: {output_path}")

        return 0

    except Exception as e:
        logger.error(f"Error analyzing UI: {e}")
        print(f"\nError: {e}")
        return 1


def main():
    """Main CLI entry point."""
    parser = argparse.ArgumentParser(
        description="Vision Agent Analyst - Multimodal analysis with Ollama",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Analyze a single image
  python main.py analyze chart.png --task "Analyze this chart"

  # Analyze a PDF
  python main.py analyze document.pdf

  # Batch analyze a directory
  python main.py batch images/ --output reports/batch.md

  # Interactive mode
  python main.py interactive

  # Analyze a chart with custom task
  python main.py chart sales.png --task "Extract key metrics"

  # Analyze UI screenshot
  python main.py ui screenshot.png
        """
    )

    parser.add_argument(
        "--model",
        default="qwen3-vl:8b",
        help="Ollama model to use (default: qwen3-vl:8b)"
    )

    subparsers = parser.add_subparsers(dest="command", help="Command to execute")

    # Analyze command
    analyze_parser = subparsers.add_parser("analyze", help="Analyze a single file")
    analyze_parser.add_argument("file", help="Path to file to analyze")
    analyze_parser.add_argument(
        "--task",
        default="Analyze this file and provide detailed insights.",
        help="Analysis task/question"
    )
    analyze_parser.add_argument("--output", "-o", help="Output report path")
    analyze_parser.add_argument(
        "--temperature",
        type=float,
        default=0.7,
        help="Model temperature (default: 0.7)"
    )
    analyze_parser.set_defaults(func=analyze_command)

    # Batch command
    batch_parser = subparsers.add_parser("batch", help="Batch analyze files")
    batch_parser.add_argument("input", help="Input directory or file pattern")
    batch_parser.add_argument("--output", "-o", help="Output report path")
    batch_parser.add_argument(
        "--task",
        default="Analyze this file.",
        help="Analysis task"
    )
    batch_parser.add_argument(
        "--temperature",
        type=float,
        default=0.7,
        help="Model temperature"
    )
    batch_parser.set_defaults(func=batch_command)

    # Interactive command
    interactive_parser = subparsers.add_parser(
        "interactive",
        help="Interactive analysis mode"
    )
    interactive_parser.add_argument(
        "file",
        nargs="?",
        help="Optional file to analyze"
    )
    interactive_parser.set_defaults(func=interactive_command)

    # Chart command
    chart_parser = subparsers.add_parser("chart", help="Analyze a chart/visualization")
    chart_parser.add_argument("file", help="Path to chart image")
    chart_parser.add_argument("--task", help="Custom analysis task")
    chart_parser.add_argument("--output", "-o", help="Output report path")
    chart_parser.add_argument("--temperature", type=float, default=0.7)
    chart_parser.set_defaults(func=chart_command)

    # UI command
    ui_parser = subparsers.add_parser("ui", help="Analyze a UI screenshot")
    ui_parser.add_argument("file", help="Path to screenshot")
    ui_parser.add_argument("--task", help="Custom analysis task")
    ui_parser.add_argument("--output", "-o", help="Output report path")
    ui_parser.add_argument("--temperature", type=float, default=0.7)
    ui_parser.set_defaults(func=ui_command)

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return 0

    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
