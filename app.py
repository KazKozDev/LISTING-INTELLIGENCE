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
from src.providers.factory import ProviderFactory
from src.config import Config

# Page configuration
st.set_page_config(
    page_title="Vision Agent Analyst",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="expanded",
)

# Custom CSS for professional business styling
st.markdown("""
<style>
    .main-header {
        font-size: 2.5rem;
        font-weight: 600;
        color: #1f2937;
        margin-bottom: 0.5rem;
    }
    .sub-header {
        font-size: 1.1rem;
        color: #6b7280;
        margin-bottom: 2rem;
    }
    .metric-card {
        background-color: #f9fafb;
        padding: 1.5rem;
        border-radius: 0.5rem;
        border: 1px solid #e5e7eb;
    }
    .section-header {
        font-size: 1.5rem;
        font-weight: 600;
        color: #374151;
        margin: 2rem 0 1rem 0;
        border-bottom: 2px solid #3b82f6;
        padding-bottom: 0.5rem;
    }
    .info-box {
        background-color: #eff6ff;
        border-left: 4px solid #3b82f6;
        padding: 1rem;
        margin: 1rem 0;
    }
    .success-box {
        background-color: #f0fdf4;
        border-left: 4px solid #10b981;
        padding: 1rem;
        margin: 1rem 0;
    }
    .warning-box {
        background-color: #fffbeb;
        border-left: 4px solid #f59e0b;
        padding: 1rem;
        margin: 1rem 0;
    }
    .stButton>button {
        width: 100%;
        background-color: #3b82f6;
        color: white;
        font-weight: 500;
        padding: 0.5rem 1rem;
        border-radius: 0.375rem;
        border: none;
    }
    .stButton>button:hover {
        background-color: #2563eb;
    }
</style>
""", unsafe_allow_html=True)


def init_session_state():
    """Initialize session state variables."""
    if 'analysis_results' not in st.session_state:
        st.session_state.analysis_results = []
    if 'agent' not in st.session_state:
        st.session_state.agent = None


def render_sidebar():
    """Render sidebar with configuration options."""
    with st.sidebar:
        st.markdown("### Configuration")
        st.markdown("---")

        # Load current config from .env
        from src.config import Config
        default_config = Config()

        st.markdown("**Current settings from .env file:**")
        st.info(
            f"Provider: {default_config.provider}\n\n"
            f"Model: {default_config.model}\n\n"
            f"Base URL: {default_config.base_url or 'Not set'}"
        )

        st.markdown("---")
        st.markdown("**Override settings (optional):**")

        # Allow override
        use_custom = st.checkbox("Use custom settings", value=False)

        if use_custom:
            # Provider selection
            provider_info = ProviderFactory.get_provider_info()
            provider_options = list(provider_info.keys())

            provider = st.selectbox(
                "LLM Provider",
                options=provider_options,
                index=provider_options.index(default_config.provider) if default_config.provider in provider_options else 0,
                format_func=lambda x: provider_info[x]["name"],
                help="Select the AI provider for analysis"
            )

            # Model input
            model = st.text_input(
                "Model",
                value=default_config.model,
                help="Model name or deployment ID"
            )

            # API Key (if required)
            api_key = None
            if provider_info[provider]["requires_api_key"]:
                api_key = st.text_input(
                    "API Key",
                    value=default_config.api_key or "",
                    type="password",
                    help="Your API key for authentication"
                )

            # Base URL (if required)
            base_url = None
            if provider_info[provider]["requires_base_url"]:
                default_url = provider_info[provider].get("default_base_url", "")
                base_url = st.text_input(
                    "Base URL",
                    value=default_config.base_url or default_url,
                    help="API endpoint URL"
                )
        else:
            # Use defaults from config
            provider = default_config.provider
            model = default_config.model
            api_key = default_config.api_key
            base_url = default_config.base_url

        st.markdown("---")

        # Model parameters
        st.markdown("### Model Parameters")

        temperature = st.slider(
            "Temperature",
            min_value=0.0,
            max_value=2.0,
            value=default_config.temperature,
            step=0.1,
            help="Controls randomness in generation"
        )

        max_tokens = st.number_input(
            "Max Tokens",
            min_value=100,
            max_value=4096,
            value=default_config.max_tokens,
            step=100,
            help="Maximum tokens to generate"
        )

        st.markdown("---")

        # Connection test
        if st.button("Test Connection", use_container_width=True):
            with st.spinner("Testing connection..."):
                try:
                    # Create temporary config for testing
                    import os
                    os.environ["LLM_PROVIDER"] = provider
                    os.environ["LLM_MODEL"] = model
                    if api_key:
                        os.environ["LLM_API_KEY"] = api_key
                    if base_url:
                        os.environ["LLM_BASE_URL"] = base_url

                    test_agent = VisionAgent()
                    if test_agent.provider.verify_connection():
                        st.success("Connection successful")
                    else:
                        st.error("Connection failed")
                except Exception as e:
                    st.error(f"Error: {str(e)}")

        return {
            "provider": provider,
            "model": model,
            "api_key": api_key,
            "base_url": base_url,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }


def render_header():
    """Render main header."""
    st.markdown('<div class="main-header">Vision Agent Analyst</div>', unsafe_allow_html=True)
    st.markdown(
        '<div class="sub-header">Professional multimodal analysis for charts, UI screenshots, and documents</div>',
        unsafe_allow_html=True
    )


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
    st.markdown('<div class="section-header">Single File Analysis</div>', unsafe_allow_html=True)

    col1, col2 = st.columns([2, 1])

    with col1:
        uploaded_file = st.file_uploader(
            "Upload File",
            type=["png", "jpg", "jpeg", "pdf", "gif", "bmp", "webp"],
            help="Supported formats: Images (PNG, JPG, GIF, BMP, WebP) and PDF documents"
        )

    with col2:
        analysis_type = st.selectbox(
            "Analysis Type",
            options=["General", "Chart", "UI Screenshot", "Custom"],
            help="Select predefined analysis type or create custom prompt"
        )

    # Custom prompt
    if analysis_type == "Custom":
        task = st.text_area(
            "Custom Prompt",
            height=150,
            placeholder="Enter your custom analysis prompt..."
        )
    else:
        task_templates = {
            "General": "Analyze this file and provide detailed insights.",
            "Chart": "Analyze this chart and provide: 1) Chart type, 2) Key data points and trends, 3) Notable patterns, 4) Insights and conclusions, 5) Recommendations",
            "UI Screenshot": "Analyze this UI and provide: 1) Main UI elements, 2) Layout assessment, 3) UX observations, 4) Accessibility considerations, 5) Improvement suggestions",
        }
        task = task_templates.get(analysis_type, "")
        st.text_area("Analysis Prompt", value=task, height=100, disabled=True)

    # Analyze button
    if uploaded_file and task:
        if st.button("Analyze File", use_container_width=True, type="primary"):
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
    st.markdown('<div class="section-header">Batch Analysis</div>', unsafe_allow_html=True)

    st.markdown('<div class="info-box">Upload multiple files for batch processing. All files will be analyzed with the same prompt.</div>', unsafe_allow_html=True)

    uploaded_files = st.file_uploader(
        "Upload Multiple Files",
        type=["png", "jpg", "jpeg", "pdf", "gif", "bmp", "webp"],
        accept_multiple_files=True,
        help="Select multiple files for batch analysis"
    )

    task = st.text_area(
        "Analysis Prompt",
        value="Analyze this file and provide key insights.",
        height=100
    )

    if uploaded_files and task:
        if st.button("Analyze Batch", use_container_width=True, type="primary"):
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
        report_path = agent.generate_report(
            results=results,
            title="Vision Agent Analysis Report"
        )

        with open(report_path, "r") as f:
            report_content = f.read()

        st.download_button(
            label="Download Report (Markdown)",
            data=report_content,
            file_name=f"report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md",
            mime="text/markdown",
            use_container_width=True
        )

    except Exception as e:
        st.error(f"Error generating report: {str(e)}")


def render_analysis_history():
    """Render analysis history."""
    st.markdown('<div class="section-header">Analysis History</div>', unsafe_allow_html=True)

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
    config = render_sidebar()
    render_analysis_interface(config)


if __name__ == "__main__":
    main()
