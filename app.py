"""
Vision Agent Analyst - Professional Web Interface
Business-grade multimodal analysis tool
"""

import streamlit as st
import tempfile
from pathlib import Path
from datetime import datetime
import json

from src import VisionAgent
from src.llm.factory import ProviderFactory
from config import Config

# Page configuration
st.set_page_config(
    page_title="Vision Agent Analyst",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="collapsed",
)

# CleanMyMac-inspired CSS
st.markdown("""
<style>
    /* Typography - SF Pro style */
    html, body, [class*="css"] {
        font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif;
        -webkit-font-smoothing: antialiased;
    }
    
    /* Main background */
    .stApp {
        background: #f5f7fa;
    }
    
    /* Hide Streamlit branding and toolbar */
    #MainMenu {visibility: hidden !important;}
    footer {visibility: hidden !important;}
    header {visibility: hidden !important;}
    
    /* Remove ALL padding and margins */
    .main .block-container {
        padding-top: 0 !important;
        padding-bottom: 1rem !important;
        padding-left: 1rem !important;
        padding-right: 1rem !important;
        margin-top: 0 !important;
        max-width: 100% !important;
    }
    
    /* Remove padding from all parent containers */
    section.main > div {
        padding-top: 0 !important;
        padding-bottom: 0 !important;
    }
    
    section.main {
        padding-top: 0 !important;
    }
    
    div[data-testid="stAppViewContainer"] {
        padding-top: 0 !important;
    }
    
    div[data-testid="stHeader"] {
        display: none !important;
        height: 0 !important;
    }
    
    /* Force remove ALL spacing */
    .main > div:first-child {
        padding-top: 0 !important;
        margin-top: -3rem !important;
    }
    
    .stApp > header {
        display: none !important;
    }
    
    div[data-testid="stToolbar"] {
        display: none !important;
    }
    
    div[data-testid="stDecoration"] {
        display: none !important;
    }
    
    /* Compact spacing between elements */
    .stSelectbox, .stTextInput, .stTextArea {
        margin-bottom: 0.25rem !important;
    }
    
    div[data-testid="stVerticalBlock"] > div {
        gap: 0.5rem !important;
    }
    
    /* Compact file uploader */
    [data-testid="stFileUploader"] {
        background: white;
        border-radius: 12px;
        padding: 1rem;
        border: 2px dashed #e2e8f0;
        transition: all 0.2s ease;
    }
    
    [data-testid="stFileUploader"]:hover {
        border-color: #667eea;
        background: #fafbff;
    }
    
    [data-testid="stFileUploader"] section {
        padding: 0.5rem !important;
    }
    
    [data-testid="stFileUploader"] small {
        display: none;
    }
    
    /* Headers */
    .main-header {
        font-size: 2.5rem;
        font-weight: 700;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin-bottom: 0.25rem;
        letter-spacing: -0.02em;
        margin-top: -11rem;
    }
    
    .sub-header {
        font-size: 1.125rem;
        color: #8b92a7;
        font-weight: 400;
        margin-bottom: 1.5rem;
        margin-top: 0;
    }

    /* Cards */
    div[data-testid="stMetricValue"] {
        font-size: 2rem;
        font-weight: 700;
        color: #2d3748;
    }

    /* File uploader */
    [data-testid="stFileUploader"] {
        background: white;
        border-radius: 16px;
        padding: 2rem;
        border: 2px dashed #e2e8f0;
        transition: all 0.3s ease;
    }
    
    [data-testid="stFileUploader"]:hover {
        border-color: #667eea;
        background: #fafbff;
    }

    /* Buttons */
    .stButton>button {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        font-weight: 600;
        border-radius: 12px;
        border: none;
        padding: 0.75rem 2rem;
        font-size: 1rem;
        box-shadow: 0 4px 14px 0 rgba(102, 126, 234, 0.39);
        transition: all 0.3s ease;
    }
    
    .stButton>button:hover {
        box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5);
        transform: translateY(-2px);
    }
    
    .stButton>button:active {
        transform: translateY(0);
    }

    /* Tabs */
    .stTabs [data-baseweb="tab-list"] {
        gap: 0.5rem;
        background: white;
        padding: 0.5rem;
        border-radius: 12px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    }

    .stTabs [data-baseweb="tab"] {
        background: transparent;
        border-radius: 8px;
        padding: 0.75rem 1.5rem;
        font-weight: 500;
        color: #718096;
        border: none;
    }

    .stTabs [aria-selected="true"] {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white !important;
    }

    /* Info boxes */
    .info-box { 
        background: linear-gradient(135deg, #e0e7ff 0%, #f3e8ff 100%);
        color: #5a67d8;
        border-radius: 12px;
        padding: 1rem 1.5rem;
        border: none;
        font-weight: 500;
    }
    
    .success-box { 
        background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
        color: #047857;
        border-radius: 12px;
        padding: 1rem 1.5rem;
        border: none;
        font-weight: 500;
    }
    
    .warning-box { 
        background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
        color: #92400e;
        border-radius: 12px;
        padding: 1rem 1.5rem;
        border: none;
        font-weight: 500;
    }

    /* Metrics container */
    [data-testid="stMetricValue"] {
        background: white;
        border-radius: 12px;
        padding: 1rem;
    }

    /* Selectbox & inputs */
    .stSelectbox, .stTextArea, .stTextInput {
        border-radius: 10px;
    }

    /* Expander */
    .streamlit-expanderHeader {
        background: white;
        border-radius: 12px;
        font-weight: 600;
        color: #2d3748;
    }

    /* Divider */
    hr {
        margin: 1.5rem 0;
        border: none;
        height: 1px;
        background: #e2e8f0;
    }
</style>
""", unsafe_allow_html=True)


def init_session_state():
    """Initialize session state variables."""
    if 'analysis_results' not in st.session_state:
        st.session_state.analysis_results = []
    if 'agent' not in st.session_state:
        st.session_state.agent = None


def get_config():
    """Get configuration from environment or session state."""
    from config import Config
    default_config = Config()
    
    return {
        "provider": default_config.provider,
        "model": default_config.model,
        "api_key": default_config.api_key,
        "base_url": default_config.base_url,
        "temperature": default_config.temperature,
        "max_tokens": default_config.max_tokens,
    }


def render_header():
    """Render compact header."""
    from config import Config
    default_config = Config()
    
    st.markdown(f'''
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <div>
                <span class="main-header">Vision Agent Analyst</span>
                <span style="color: #8b92a7; margin-left: 1rem; font-size: 0.9rem;">Charts • UI • Documents</span>
            </div>
            <div style="text-align: right; font-size: 0.85rem; color: #64748b;">
                <span style="background: #f1f5f9; padding: 0.25rem 0.75rem; border-radius: 20px; margin-left: 0.5rem;">
                    🔌 {default_config.provider}
                </span>
                <span style="background: #f1f5f9; padding: 0.25rem 0.75rem; border-radius: 20px; margin-left: 0.5rem;">
                    🤖 {default_config.model}
                </span>
            </div>
        </div>
    ''', unsafe_allow_html=True)


def render_analysis_interface(config):
    """Render main analysis interface."""
    tab1, tab2, tab3 = st.tabs(["Single File Analysis", "Batch Analysis", "Analysis History"])

    with tab1:
        render_single_file_analysis(config)

    with tab2:
        render_batch_analysis(config)

    with tab3:
        render_analysis_history()


def render_single_file_analysis(config):
    """Render single file analysis interface."""
    
    # Load templates from config FIRST
    from config import Config
    cfg = Config()
    industry_templates = cfg.prompts_config.get("industry_templates", {})
    industry_keys = list(industry_templates.keys())
    industry_names = [industry_templates[k]["name"] for k in industry_keys]
    
    # Compact layout: uploader and options side by side
    col_upload, col_options = st.columns([2, 1])
    
    with col_upload:
        uploaded_file = st.file_uploader(
            "📁 Drop file here",
            type=["png", "jpg", "jpeg", "pdf", "gif", "bmp", "webp"],
            help="Images or PDF",
            label_visibility="collapsed"
        )
    
    with col_options:
        analysis_category = st.selectbox(
            "Category",
            options=["Basic", "Industry"],
            label_visibility="collapsed"
        )
        
        if analysis_category == "Basic":
            basic_options = ["General", "Chart", "UI", "Custom"]
            analysis_type = st.selectbox(
                "Type",
                options=basic_options,
                label_visibility="collapsed"
            )
            selected_name = None
        else:
            selected_name = st.selectbox(
                "Industry",
                options=industry_names,
                label_visibility="collapsed"
            )
            analysis_type = "industry"
    
    # Get task based on selection
    if analysis_category == "Basic":
        if analysis_type == "Custom":
            task = st.text_input("✏️ Custom prompt", placeholder="Enter your analysis prompt...")
        else:
            task_templates = {
                "General": "Analyze this file and provide insights.",
                "Chart": cfg.prompts_config.get("templates", {}).get("analyze_chart", "Analyze this chart."),
                "UI": cfg.prompts_config.get("templates", {}).get("analyze_ui", "Analyze this UI."),
            }
            task = task_templates.get(analysis_type, "")
    else:
        selected_key = industry_keys[industry_names.index(selected_name)]
        task = industry_templates[selected_key]["prompt"]
        # Show industry description
        st.info(f"📋 {industry_templates[selected_key]['description']}")
    
    # Show current prompt (truncated)
    if task and analysis_type != "Custom":
        with st.expander("📝 View Prompt", expanded=False):
            st.text(task[:500] + "..." if len(task) > 500 else task)
    
    # Analyze button
    if uploaded_file and task:
        if st.button("🚀 Analyze", type="primary", use_container_width=True):
            analyze_file(uploaded_file, task, config)


def analyze_file(uploaded_file, task, config):
    """Analyze uploaded file."""
    with st.spinner("Analyzing file..."):
        try:
            # Save uploaded file temporarily
            with tempfile.NamedTemporaryFile(delete=False, suffix=Path(uploaded_file.name).suffix) as tmp_file:
                tmp_file.write(uploaded_file.getvalue())
                tmp_path = Path(tmp_file.name)

            # Set environment variables temporarily if custom settings are used
            import os
            original_env = {}
            try:
                if config.get("provider"):
                    original_env["LLM_PROVIDER"] = os.environ.get("LLM_PROVIDER")
                    os.environ["LLM_PROVIDER"] = config["provider"]
                if config.get("model"):
                    original_env["LLM_MODEL"] = os.environ.get("LLM_MODEL")
                    os.environ["LLM_MODEL"] = config["model"]
                if config.get("api_key"):
                    original_env["LLM_API_KEY"] = os.environ.get("LLM_API_KEY")
                    os.environ["LLM_API_KEY"] = config["api_key"]
                if config.get("base_url"):
                    original_env["LLM_BASE_URL"] = os.environ.get("LLM_BASE_URL")
                    os.environ["LLM_BASE_URL"] = config["base_url"]
                if config.get("temperature"):
                    original_env["TEMPERATURE"] = os.environ.get("TEMPERATURE")
                    os.environ["TEMPERATURE"] = str(config["temperature"])
                if config.get("max_tokens"):
                    original_env["MAX_TOKENS"] = os.environ.get("MAX_TOKENS")
                    os.environ["MAX_TOKENS"] = str(config["max_tokens"])

                # Initialize agent with config from environment
                agent = VisionAgent()

                # Analyze based on file type
                if tmp_path.suffix.lower() == ".pdf":
                    results = agent.analyze_pdf(tmp_path, task=task)
                else:
                    result = agent.analyze_image(tmp_path, task=task)
                    results = [result]

                # Store results
                for result in results:
                    st.session_state.analysis_results.append({
                        "filename": uploaded_file.name,
                        "timestamp": datetime.now(),
                        "result": result,
                    })

                # Clean up
                tmp_path.unlink()

                # Display results
                st.markdown('<div class="success-box">Analysis completed successfully</div>', unsafe_allow_html=True)

                for idx, result in enumerate(results):
                    st.markdown(f'<div class="section-header">Result {idx + 1}</div>', unsafe_allow_html=True)

                    # Metadata
                    col1, col2, col3, col4 = st.columns(4)
                    with col1:
                        st.metric("Model", result.metadata.get("model", "N/A"))
                    with col2:
                        st.metric("Provider", result.metadata.get("provider", "N/A"))
                    with col3:
                        tokens = result.metadata.get("usage", {}).get("total_tokens", 0)
                        st.metric("Tokens Used", f"{tokens:,}")
                    with col4:
                        if "page" in result.metadata:
                            st.metric("Page", result.metadata["page"])

                    # Analysis result
                    st.markdown("**Analysis:**")
                    st.markdown(result.text)
                    
                    # Export options
                    st.markdown("**Export:**")
                    col_export1, col_export2, col_export3 = st.columns(3)
                    
                    with col_export1:
                        # JSON export
                        import json
                        json_data = {
                            "filename": uploaded_file.name,
                            "timestamp": datetime.now().isoformat(),
                            "task": result.task,
                            "analysis": result.text,
                            "metadata": result.metadata
                        }
                        st.download_button(
                            label="📄 JSON",
                            data=json.dumps(json_data, indent=2, ensure_ascii=False),
                            file_name=f"analysis_{uploaded_file.name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json",
                            mime="application/json",
                            key=f"json_download_{idx}"
                        )
                    
                    with col_export2:
                        # CSV export
                        import io
                        csv_buffer = io.StringIO()
                        csv_buffer.write("Filename,Timestamp,Task,Analysis,Model,Provider,Tokens\n")
                        csv_buffer.write(f'"{uploaded_file.name}","{datetime.now().isoformat()}","{result.task}","{result.text.replace(chr(34), chr(39))}","{result.metadata.get("model", "")}","{result.metadata.get("provider", "")}","{result.metadata.get("usage", {}).get("total_tokens", 0)}"\n')
                        
                        st.download_button(
                            label="📊 CSV",
                            data=csv_buffer.getvalue(),
                            file_name=f"analysis_{uploaded_file.name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv",
                            mime="text/csv",
                            key=f"csv_download_{idx}"
                        )
                    
                    with col_export3:
                        # PDF export
                        try:
                            pdf_bytes = agent.report_generator.generate_pdf_bytes(
                                results=[result],
                                title=f"Analysis: {uploaded_file.name}"
                            )
                            st.download_button(
                                label="📕 PDF",
                                data=pdf_bytes,
                                file_name=f"analysis_{uploaded_file.name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf",
                                mime="application/pdf",
                                key=f"pdf_download_{idx}"
                            )
                        except ImportError:
                            st.info("PDF export requires reportlab")
                    
                    st.markdown("---")

            finally:
                # Restore original environment variables
                for key, value in original_env.items():
                    if value is None:
                        os.environ.pop(key, None)
                    else:
                        os.environ[key] = value

        except Exception as e:
            st.error(f"Error during analysis: {str(e)}")


def render_batch_analysis(config):
    """Render batch analysis interface."""

    uploaded_files = st.file_uploader(
        "Upload Multiple Files",
        type=["png", "jpg", "jpeg", "pdf", "gif", "bmp", "webp"],
        accept_multiple_files=True,
        help="Select multiple files for batch analysis"
    )

    task = st.text_area(
        "Analysis Prompt",
        value="Analyze this file and provide key insights.",
        height=80
    )

    if uploaded_files and task:
        if st.button("Analyze Batch", type="primary"):
            analyze_batch(uploaded_files, task, config)


def analyze_batch(uploaded_files, task, config):
    """Analyze multiple files in batch."""
    progress_bar = st.progress(0)
    status_text = st.empty()

    total_files = len(uploaded_files)
    completed = 0

    # Set environment variables temporarily
    import os
    original_env = {}
    try:
        if config.get("provider"):
            original_env["LLM_PROVIDER"] = os.environ.get("LLM_PROVIDER")
            os.environ["LLM_PROVIDER"] = config["provider"]
        if config.get("model"):
            original_env["LLM_MODEL"] = os.environ.get("LLM_MODEL")
            os.environ["LLM_MODEL"] = config["model"]
        if config.get("api_key"):
            original_env["LLM_API_KEY"] = os.environ.get("LLM_API_KEY")
            os.environ["LLM_API_KEY"] = config["api_key"]
        if config.get("base_url"):
            original_env["LLM_BASE_URL"] = os.environ.get("LLM_BASE_URL")
            os.environ["LLM_BASE_URL"] = config["base_url"]
        if config.get("temperature"):
            original_env["TEMPERATURE"] = os.environ.get("TEMPERATURE")
            os.environ["TEMPERATURE"] = str(config["temperature"])
        if config.get("max_tokens"):
            original_env["MAX_TOKENS"] = os.environ.get("MAX_TOKENS")
            os.environ["MAX_TOKENS"] = str(config["max_tokens"])

        try:
            # Initialize agent once
            agent = VisionAgent()

            for idx, uploaded_file in enumerate(uploaded_files):
                status_text.text(f"Processing {uploaded_file.name} ({idx + 1}/{total_files})...")

                try:
                    # Save temporarily
                    with tempfile.NamedTemporaryFile(delete=False, suffix=Path(uploaded_file.name).suffix) as tmp_file:
                        tmp_file.write(uploaded_file.getvalue())
                        tmp_path = Path(tmp_file.name)

                    # Analyze
                    if tmp_path.suffix.lower() == ".pdf":
                        results = agent.analyze_pdf(tmp_path, task=task)
                    else:
                        result = agent.analyze_image(tmp_path, task=task)
                        results = [result]

                    # Store results
                    for result in results:
                        st.session_state.analysis_results.append({
                            "filename": uploaded_file.name,
                            "timestamp": datetime.now(),
                            "result": result,
                        })

                    # Clean up
                    tmp_path.unlink()
                    completed += 1

                except Exception as e:
                    st.warning(f"Error processing {uploaded_file.name}: {str(e)}")

                # Update progress
                progress_bar.progress((idx + 1) / total_files)

            status_text.text("")
            st.markdown(f'<div class="success-box">Batch analysis completed: {completed}/{total_files} files processed successfully</div>', unsafe_allow_html=True)

            # Generate report option
            if st.button("Generate Report", use_container_width=True):
                generate_report()

        except Exception as e:
            st.error(f"Error during batch analysis: {str(e)}")

    finally:
        # Restore original environment variables
        for key, value in original_env.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value


def generate_report():
    """Generate and download report."""
    try:
        results = [item["result"] for item in st.session_state.analysis_results]

        if not results:
            st.warning("No results to generate report from")
            return

        # Create agent for report generation
        agent = VisionAgent()
        
        col1, col2 = st.columns(2)
        
        with col1:
            # Markdown report
            report_path = agent.generate_report(
                results=results,
                title="Vision Agent Analysis Report"
            )

            with open(report_path, "r") as f:
                report_content = f.read()

            st.download_button(
                label="📄 Download Report (Markdown)",
                data=report_content,
                file_name=f"report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md",
                mime="text/markdown",
                use_container_width=True
            )
        
        with col2:
            # PDF report
            try:
                pdf_bytes = agent.report_generator.generate_pdf_bytes(
                    results=results,
                    title="Vision Agent Analysis Report"
                )

                st.download_button(
                    label="📕 Download Report (PDF)",
                    data=pdf_bytes,
                    file_name=f"report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf",
                    mime="application/pdf",
                    use_container_width=True
                )
            except ImportError:
                st.info("PDF export requires reportlab. Install it with: pip install reportlab")

    except Exception as e:
        st.error(f"Error generating report: {str(e)}")


def render_analysis_history():
    """Render analysis history."""

    if not st.session_state.analysis_results:
        st.info("No analysis history yet. Start by analyzing some files.")
        return

    # Summary metrics
    col1, col2, col3 = st.columns(3)
    with col1:
        st.metric("Total Analyses", len(st.session_state.analysis_results))
    with col2:
        total_tokens = sum(
            item["result"].metadata.get("usage", {}).get("total_tokens", 0)
            for item in st.session_state.analysis_results
        )
        st.metric("Total Tokens", f"{total_tokens:,}")
    with col3:
        unique_files = len(set(item["filename"] for item in st.session_state.analysis_results))
        st.metric("Unique Files", unique_files)

    st.markdown("---")
    
    # Export all results
    st.markdown("**Export All Results:**")
    col_exp1, col_exp2, col_exp3 = st.columns(3)
    
    with col_exp1:
        # JSON export all
        import json
        all_data = []
        for item in st.session_state.analysis_results:
            result = item["result"]
            all_data.append({
                "filename": item["filename"],
                "timestamp": item["timestamp"].isoformat(),
                "task": result.task,
                "analysis": result.text,
                "metadata": result.metadata
            })
        
        st.download_button(
            label="📄 Export All (JSON)",
            data=json.dumps(all_data, indent=2, ensure_ascii=False),
            file_name=f"all_analyses_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json",
            mime="application/json",
            key="export_all_json"
        )
    
    with col_exp2:
        # CSV export all
        import io
        csv_buffer = io.StringIO()
        csv_buffer.write("Filename,Timestamp,Task,Analysis,Model,Provider,Tokens\n")
        for item in st.session_state.analysis_results:
            result = item["result"]
            csv_buffer.write(
                f'"{item["filename"]}","{item["timestamp"].isoformat()}","{result.task}","{result.text.replace(chr(34), chr(39))}","{result.metadata.get("model", "")}","{result.metadata.get("provider", "")}","{result.metadata.get("usage", {}).get("total_tokens", 0)}"\n'
            )
        
        st.download_button(
            label="📊 Export All (CSV)",
            data=csv_buffer.getvalue(),
            file_name=f"all_analyses_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv",
            mime="text/csv",
            key="export_all_csv"
        )
    
    with col_exp3:
        # Clear history
        if st.button("🗑️ Clear History"):
            st.session_state.analysis_results = []
            st.rerun()

    st.markdown("---")

    # History table
    for idx, item in enumerate(reversed(st.session_state.analysis_results)):
        with st.expander(f"{item['filename']} - {item['timestamp'].strftime('%Y-%m-%d %H:%M:%S')}"):
            result = item["result"]

            st.markdown(f"**Task:** {result.task}")
            st.markdown(f"**Provider:** {result.metadata.get('provider', 'N/A')}")
            st.markdown(f"**Model:** {result.metadata.get('model', 'N/A')}")
            st.markdown(f"**Tokens:** {result.metadata.get('usage', {}).get('total_tokens', 0)}")
            st.markdown("---")
            st.markdown("**Analysis:**")
            st.markdown(result.text)

    # Clear history button
    if st.button("Clear History", use_container_width=True):
        st.session_state.analysis_results = []
        st.rerun()


def main():
    """Main application entry point."""
    init_session_state()

    # Render UI
    render_header()
    config = get_config()
    render_analysis_interface(config)


if __name__ == "__main__":
    main()
