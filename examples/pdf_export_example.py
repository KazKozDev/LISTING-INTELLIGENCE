"""Example: Exporting analysis results to beautiful PDF reports."""

from pathlib import Path
from src import VisionAgent

def main():
    """Demonstrate PDF export functionality."""
    print("Vision Agent - PDF Export Example")
    print("=" * 50)
    
    # Initialize agent
    agent = VisionAgent()
    
    # Example 1: Analyze an image and export to PDF
    print("\n1. Analyzing image and exporting to PDF...")
    image_path = Path("path/to/your/chart.png")
    
    if image_path.exists():
        result = agent.analyze_image(
            image_path,
            task="Analyze this chart and provide key insights"
        )
        
        # Export single result to PDF
        pdf_path = agent.report_generator.generate_pdf(
            results=[result],
            title="Chart Analysis Report",
            include_metadata=True
        )
        print(f"✓ PDF report generated: {pdf_path}")
    
    # Example 2: Batch analysis with PDF export
    print("\n2. Batch analysis with PDF export...")
    image_dir = Path("path/to/images/")
    
    if image_dir.exists():
        results = []
        for image_file in image_dir.glob("*.png"):
            result = agent.analyze_image(
                image_file,
                task="Analyze this image and provide insights"
            )
            results.append(result)
        
        if results:
            # Generate comprehensive PDF report
            pdf_path = agent.report_generator.generate_pdf(
                results=results,
                title="Batch Analysis Report",
                output_path=Path("outputs/batch_report.pdf")
            )
            print(f"✓ Batch PDF report generated: {pdf_path}")
            print(f"  Total files analyzed: {len(results)}")
    
    # Example 3: PDF document analysis exported to PDF
    print("\n3. Analyzing PDF document and exporting results...")
    pdf_doc = Path("path/to/document.pdf")
    
    if pdf_doc.exists():
        results = agent.analyze_pdf(
            pdf_doc,
            task="Summarize the content of each page"
        )
        
        # Export PDF analysis results to a new PDF report
        report_path = agent.report_generator.generate_pdf(
            results=results,
            title=f"Analysis of {pdf_doc.name}",
            output_path=Path(f"outputs/{pdf_doc.stem}_analysis.pdf")
        )
        print(f"✓ PDF analysis report generated: {report_path}")
        print(f"  Pages analyzed: {len(results)}")
    
    # Example 4: Get PDF as bytes (useful for web applications)
    print("\n4. Generating PDF as bytes for download...")
    if 'results' in locals() and results:
        pdf_bytes = agent.report_generator.generate_pdf_bytes(
            results=results,
            title="Analysis Results"
        )
        print(f"✓ PDF generated as bytes: {len(pdf_bytes)} bytes")
        
        # Save bytes to file (demonstration)
        output_file = Path("outputs/bytes_example.pdf")
        output_file.parent.mkdir(exist_ok=True)
        output_file.write_bytes(pdf_bytes)
        print(f"  Saved to: {output_file}")
    
    print("\n" + "=" * 50)
    print("PDF Export Examples completed!")
    print("\nFeatures of the generated PDFs:")
    print("  • Professional formatting with custom styles")
    print("  • Title page with report metadata")
    print("  • Table of contents")
    print("  • Detailed analysis results")
    print("  • Page numbers and headers")
    print("  • Color-coded sections")
    print("  • Tables for structured information")


if __name__ == "__main__":
    main()
