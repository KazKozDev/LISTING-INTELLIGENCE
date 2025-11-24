"""Example: Custom analysis with specific prompts."""

import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from src import VisionAgent


def analyze_medical_chart(agent, chart_path):
    """Example: Analyze a medical chart."""
    custom_prompt = """You are a medical data analyst. Analyze this medical chart:
    1. What type of medical data is shown?
    2. Identify any trends in the patient's vitals or lab results
    3. Are there any values that appear outside normal ranges?
    4. What patterns emerge over time?
    5. Note any missing data points
    """

    result = agent.analyze_image(chart_path, task=custom_prompt)
    return result


def analyze_financial_dashboard(agent, dashboard_path):
    """Example: Analyze a financial dashboard."""
    custom_prompt = """You are a financial analyst. Analyze this dashboard:
    1. What financial metrics are displayed?
    2. What is the overall financial health indicated?
    3. Identify any concerning trends
    4. What are the key performance indicators shown?
    5. Provide strategic recommendations
    """

    result = agent.analyze_image(dashboard_path, task=custom_prompt)
    return result


def analyze_scientific_graph(agent, graph_path):
    """Example: Analyze a scientific graph."""
    custom_prompt = """You are a research scientist. Analyze this scientific graph:
    1. What type of scientific data is represented?
    2. What is the relationship between variables?
    3. Are there any statistical anomalies?
    4. What conclusions can be drawn?
    5. Suggest further experiments or analysis
    """

    result = agent.analyze_image(graph_path, task=custom_prompt)
    return result


def main():
    """Custom analysis examples."""
    # Initialize the agent
    agent = VisionAgent()

    print("Custom Analysis Examples")
    print("=" * 60)

    # Example 1: Medical chart (replace with actual path)
    # medical_result = analyze_medical_chart(agent, "medical_chart.png")

    # Example 2: Financial dashboard (replace with actual path)
    # financial_result = analyze_financial_dashboard(agent, "dashboard.png")

    # Example 3: Scientific graph (replace with actual path)
    # scientific_result = analyze_scientific_graph(agent, "graph.png")

    # Example 4: Custom temperature and parameters
    result = agent.analyze_image(
        "your_image.png",
        task="Analyze this image with focus on colors and composition",
        temperature=0.5,  # Lower temperature for more focused responses
        max_tokens=1500
    )

    print("\nAnalysis with custom parameters:")
    print("-" * 60)
    print(result.text)

    print("\n✓ Custom analysis completed")


if __name__ == "__main__":
    main()
