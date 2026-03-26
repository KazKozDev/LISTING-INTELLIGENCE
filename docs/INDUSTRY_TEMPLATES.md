# Templates Guide

Listing Intelligence uses prompt templates defined in [config/prompts.yaml](../config/prompts.yaml).

The current template system covers three broad groups:

- chart analysis
- UI review
- document analysis

These templates are resolved by `template_key` and used by the backend when a request asks for a configured analysis path.

## Template Sources

The repository currently defines:

- base templates under `templates`
- role-specific system prompts under `system_prompts`
- configured template sets under `industry_templates`

## Current Template Families

### Chart Templates

Examples include:

- sales performance
- market trends
- competitive comparison
- KPI dashboard review
- funnel analysis
- SWOT visualization

These templates are designed for screenshots, charts, and dashboard-style visuals where the output should be structured rather than purely descriptive.

### UI Templates

Examples include:

- landing page conversion audit
- mobile app UX review
- dashboard usability review
- e-commerce checkout review
- SaaS workflow review
- accessibility audit

These templates focus on layout, discoverability, friction, clarity, and accessibility.

### Document Templates

Examples include:

- contract review
- technical spec extraction
- policy review

These templates are aimed at structured extraction and summarization rather than free-form commentary.

## How Templates Are Used

Templates are consumed through backend flows that accept `template_key`, including general analysis and listing-analysis routes.

Typical pattern:

1. choose a template key
2. submit a file or listing content
3. let the backend resolve the configured prompt
4. receive a structured analysis response

## Customization

To add or change templates:

1. edit [config/prompts.yaml](../config/prompts.yaml)
2. add or update an entry under `industry_templates`
3. restart the backend if you are running locally

Template shape:

```yaml
your_template_key:
  name: "Template Name"
  description: "Short description"
  prompt: |
    Your analysis instructions here.
```

## Guidance

- Keep template prompts specific to the artifact being analyzed.
- Prefer structured output requests over vague prose requests.
- Do not document templates here that are not present in [config/prompts.yaml](../config/prompts.yaml).
