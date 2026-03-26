"""PDF export functionality for analysis reports."""

import logging
from datetime import datetime
from io import BytesIO
from pathlib import Path
from typing import Any

try:
    from reportlab.lib import colors
    from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
    from reportlab.lib.pagesizes import A4, letter
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import cm, inch
    from reportlab.platypus import Image as RLImage
    from reportlab.platypus import (
        PageBreak,
        Paragraph,
        SimpleDocTemplate,
        Spacer,
        Table,
        TableStyle,
    )
    REPORTLAB_AVAILABLE = True
except ImportError:
    REPORTLAB_AVAILABLE = False

logger = logging.getLogger(__name__)


class PDFExporter:
    """Export analysis reports to beautifully formatted PDF files."""

    def __init__(self):
        """Initialize PDF exporter."""
        if not REPORTLAB_AVAILABLE:
            raise ImportError(
                "reportlab is required for PDF export. "
                "Install it with: pip install reportlab"
            )

    def export(
        self,
        results: list[Any],
        output_path: Path | None = None,
        title: str = "Vision Agent Analysis Report",
        include_metadata: bool = True,
        **kwargs
    ) -> Path:
        """Export analysis results to PDF.

        Args:
            results: List of AnalysisResult objects.
            output_path: Optional output path. If None, auto-generates.
            title: Report title.
            include_metadata: Whether to include metadata.
            **kwargs: Additional parameters.

        Returns:
            Path to the generated PDF file.
        """
        if not results:
            raise ValueError("No results to export")

        # Auto-generate output path if not provided
        if output_path is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_path = Path(f"report_{timestamp}.pdf")
        else:
            output_path = Path(output_path)

        output_path.parent.mkdir(parents=True, exist_ok=True)

        logger.info(f"Generating PDF report: {output_path}")

        # Create PDF
        doc = SimpleDocTemplate(
            str(output_path),
            pagesize=A4,
            rightMargin=2*cm,
            leftMargin=2*cm,
            topMargin=2*cm,
            bottomMargin=2*cm,
        )

        # Build content
        story = []
        styles = self._create_styles()

        # Title page
        story.extend(self._create_title_page(title, results, include_metadata, styles))

        # Table of contents
        story.extend(self._create_toc(results, styles))

        # Analysis results
        story.extend(self._create_results_section(results, styles))

        # Build PDF
        doc.build(story, onFirstPage=self._add_page_number, onLaterPages=self._add_page_number)

        logger.info(f"PDF report generated successfully: {output_path}")
        return output_path

    def _create_styles(self) -> dict:
        """Create custom paragraph styles.

        Returns:
            Dictionary of styles.
        """
        styles = getSampleStyleSheet()

        # Custom styles
        styles.add(ParagraphStyle(
            name='CustomTitle',
            parent=styles['Heading1'],
            fontSize=28,
            textColor=colors.HexColor('#1f2937'),
            spaceAfter=30,
            alignment=TA_CENTER,
            fontName='Helvetica-Bold',
        ))

        styles.add(ParagraphStyle(
            name='CustomSubtitle',
            parent=styles['Normal'],
            fontSize=12,
            textColor=colors.HexColor('#6b7280'),
            spaceAfter=20,
            alignment=TA_CENTER,
        ))

        styles.add(ParagraphStyle(
            name='SectionHeader',
            parent=styles['Heading1'],
            fontSize=18,
            textColor=colors.HexColor('#1f2937'),
            spaceAfter=12,
            spaceBefore=20,
            fontName='Helvetica-Bold',
            borderWidth=0,
            borderColor=colors.HexColor('#3b82f6'),
            borderPadding=5,
            leftIndent=0,
        ))

        styles.add(ParagraphStyle(
            name='SubsectionHeader',
            parent=styles['Heading2'],
            fontSize=14,
            textColor=colors.HexColor('#374151'),
            spaceAfter=8,
            spaceBefore=12,
            fontName='Helvetica-Bold',
        ))

        styles.add(ParagraphStyle(
            name='BodyText',
            parent=styles['Normal'],
            fontSize=10,
            textColor=colors.HexColor('#1f2937'),
            spaceAfter=8,
            alignment=TA_JUSTIFY,
            leading=14,
        ))

        styles.add(ParagraphStyle(
            name='Metadata',
            parent=styles['Normal'],
            fontSize=9,
            textColor=colors.HexColor('#6b7280'),
            spaceAfter=6,
        ))

        styles.add(ParagraphStyle(
            name='Code',
            parent=styles['Code'],
            fontSize=9,
            textColor=colors.HexColor('#1f2937'),
            backColor=colors.HexColor('#f3f4f6'),
            borderWidth=1,
            borderColor=colors.HexColor('#d1d5db'),
            borderPadding=5,
        ))

        return styles

    def _create_title_page(
        self,
        title: str,
        results: list[Any],
        include_metadata: bool,
        styles: dict
    ) -> list:
        """Create title page content.

        Args:
            title: Report title.
            results: List of results.
            include_metadata: Whether to include metadata.
            styles: Paragraph styles.

        Returns:
            List of flowables for title page.
        """
        story = []

        # Add some space
        story.append(Spacer(1, 2*inch))

        # Title
        story.append(Paragraph(title, styles['CustomTitle']))
        story.append(Spacer(1, 0.3*inch))

        # Subtitle
        subtitle = "Professional Multimodal Analysis Report"
        story.append(Paragraph(subtitle, styles['CustomSubtitle']))
        story.append(Spacer(1, 1*inch))

        # Metadata
        if include_metadata:
            metadata_data = [
                ['Report Information', ''],
                ['Generated:', datetime.now().strftime('%Y-%m-%d %H:%M:%S')],
                ['Total Files:', str(len(results))],
                ['Analysis Type:', 'Multimodal (Images & Documents)'],
            ]

            # Add provider info if available
            if results and results[0].metadata:
                provider = results[0].metadata.get('provider', 'N/A')
                model = results[0].metadata.get('model', 'N/A')
                metadata_data.append(['Provider:', provider])
                metadata_data.append(['Model:', model])

            metadata_table = Table(metadata_data, colWidths=[4*cm, 10*cm])
            metadata_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#3b82f6')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 11),
                ('FONTNAME', (0, 1), (0, -1), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 1), (-1, -1), 9),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
                ('TOPPADDING', (0, 0), (-1, -1), 8),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#d1d5db')),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f9fafb')]),
            ]))
            story.append(metadata_table)

        story.append(PageBreak())
        return story

    def _create_toc(self, results: list[Any], styles: dict) -> list:
        """Create table of contents.

        Args:
            results: List of results.
            styles: Paragraph styles.

        Returns:
            List of flowables for TOC.
        """
        story = []

        story.append(Paragraph("Table of Contents", styles['SectionHeader']))
        story.append(Spacer(1, 0.2*inch))

        toc_data = [['#', 'File Name', 'Type']]
        for idx, result in enumerate(results, 1):
            file_name = result.file_path.name
            file_type = result.file_type.capitalize()
            toc_data.append([str(idx), file_name, file_type])

        toc_table = Table(toc_data, colWidths=[1*cm, 11*cm, 3*cm])
        toc_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#3b82f6')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (0, -1), 'CENTER'),
            ('ALIGN', (1, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('FONTSIZE', (0, 1), (-1, -1), 9),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#d1d5db')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f9fafb')]),
        ]))
        story.append(toc_table)

        story.append(PageBreak())
        return story

    def _create_results_section(self, results: list[Any], styles: dict) -> list:
        """Create analysis results section.

        Args:
            results: List of results.
            styles: Paragraph styles.

        Returns:
            List of flowables for results section.
        """
        story = []

        story.append(Paragraph("Analysis Results", styles['SectionHeader']))
        story.append(Spacer(1, 0.2*inch))

        for idx, result in enumerate(results, 1):
            # File header
            file_name = result.file_path.name
            story.append(Paragraph(
                f"{idx}. {self._escape_html(file_name)}",
                styles['SubsectionHeader']
            ))

            # File information table
            info_data = [
                ['File Path:', self._escape_html(str(result.file_path))],
                ['File Type:', result.file_type.capitalize()],
                ['Analyzed:', result.timestamp.strftime('%Y-%m-%d %H:%M:%S')],
            ]

            if result.metadata:
                if 'page' in result.metadata:
                    info_data.append(['Page:', str(result.metadata['page'])])
                if 'duration_ms' in result.metadata:
                    duration = result.metadata['duration_ms']
                    info_data.append(['Processing Time:', f"{duration:.2f}ms"])
                if 'usage' in result.metadata and 'total_tokens' in result.metadata['usage']:
                    tokens = result.metadata['usage']['total_tokens']
                    info_data.append(['Tokens Used:', f"{tokens:,}"])

            info_table = Table(info_data, colWidths=[3.5*cm, 11*cm])
            info_table.setStyle(TableStyle([
                ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 8),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
                ('TOPPADDING', (0, 0), (-1, -1), 4),
                ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f9fafb')),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e5e7eb')),
            ]))
            story.append(info_table)
            story.append(Spacer(1, 0.15*inch))

            # Analysis task
            story.append(Paragraph("<b>Analysis Task:</b>", styles['BodyText']))
            story.append(Paragraph(
                self._escape_html(result.task),
                styles['Metadata']
            ))
            story.append(Spacer(1, 0.1*inch))

            # Analysis results
            story.append(Paragraph("<b>Analysis Results:</b>", styles['BodyText']))
            story.append(Spacer(1, 0.05*inch))

            # Format result text with proper line breaks
            result_paragraphs = result.text.split('\n')
            for para in result_paragraphs:
                if para.strip():
                    story.append(Paragraph(
                        self._escape_html(para),
                        styles['BodyText']
                    ))

            # Separator
            if idx < len(results):
                story.append(Spacer(1, 0.2*inch))
                story.append(Paragraph(
                    "<hr width='100%' color='#e5e7eb' size='1'/>",
                    styles['BodyText']
                ))
                story.append(Spacer(1, 0.2*inch))

        return story

    def _add_page_number(self, canvas, doc):
        """Add page number to each page.

        Args:
            canvas: Canvas object.
            doc: Document object.
        """
        page_num = canvas.getPageNumber()
        text = f"Page {page_num}"
        canvas.saveState()
        canvas.setFont('Helvetica', 9)
        canvas.setFillColor(colors.HexColor('#6b7280'))
        canvas.drawRightString(A4[0] - 2*cm, 1.5*cm, text)
        canvas.drawString(2*cm, 1.5*cm, "Vision Agent Analyst")
        canvas.restoreState()

    def _escape_html(self, text: str) -> str:
        """Escape HTML special characters.

        Args:
            text: Text to escape.

        Returns:
            Escaped text.
        """
        text = str(text)
        text = text.replace('&', '&amp;')
        text = text.replace('<', '&lt;')
        text = text.replace('>', '&gt;')
        return text

    def export_to_bytes(
        self,
        results: list[Any],
        title: str = "Vision Agent Analysis Report",
        include_metadata: bool = True,
        **kwargs
    ) -> bytes:
        """Export analysis results to PDF as bytes.

        Args:
            results: List of AnalysisResult objects.
            title: Report title.
            include_metadata: Whether to include metadata.
            **kwargs: Additional parameters.

        Returns:
            PDF content as bytes.
        """
        if not results:
            raise ValueError("No results to export")

        buffer = BytesIO()

        # Create PDF
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=2*cm,
            leftMargin=2*cm,
            topMargin=2*cm,
            bottomMargin=2*cm,
        )

        # Build content
        story = []
        styles = self._create_styles()

        # Title page
        story.extend(self._create_title_page(title, results, include_metadata, styles))

        # Table of contents
        story.extend(self._create_toc(results, styles))

        # Analysis results
        story.extend(self._create_results_section(results, styles))

        # Build PDF
        doc.build(story, onFirstPage=self._add_page_number, onLaterPages=self._add_page_number)

        pdf_bytes = buffer.getvalue()
        buffer.close()

        return pdf_bytes
