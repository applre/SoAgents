---
name: summarize
description: Summarize content from files, URLs, or clipboard text into concise structured notes
user-invocable: true
argument-hint: <file path, URL, or paste text>
---

# Summarize

Generate a concise, well-structured summary of the provided content.

## Behavior

1. **Identify the source**: Determine if the input is a file path, URL, or inline text.
   - If a file path is provided, read the file content.
   - If a URL is provided, fetch the web page content.
   - If inline text is provided, use it directly.

2. **Analyze the content**: Identify key themes, main arguments, important details, and conclusions.

3. **Generate summary** using this structure:

   ### Overview
   A 1-2 sentence high-level summary of what the content is about.

   ### Key Points
   - Bullet points of the most important information
   - Focus on actionable insights and critical details
   - Keep each point concise (1-2 sentences max)

   ### Details
   Expand on any complex topics that need more context. Only include this section if the content is sufficiently complex.

   ### Takeaways
   - 2-3 actionable takeaways or conclusions

## Guidelines

- Keep the summary to ~20% of the original content length
- Preserve technical accuracy — do not hallucinate or add information not in the source
- Use the same language as the source content
- For code files: focus on architecture, key functions, and design patterns rather than line-by-line description
- For articles/docs: focus on main arguments, evidence, and conclusions
