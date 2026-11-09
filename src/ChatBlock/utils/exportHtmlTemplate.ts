/**
 * Escapes HTML special characters for safe inclusion in exported markup.
 */
export function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export interface RenderHtmlTemplateParams {
  title: string;
  dateFormatted: string;
  turnCounter: number;
  turnsHtml: string;
}

/**
 * Returns a self-contained, clean EEA-branded white paper HTML document.
 */
export function renderHtmlWhitePaper({
  title,
  dateFormatted,
  turnCounter,
  turnsHtml,
}: RenderHtmlTemplateParams): string {
  const safeTitle = escapeHtml(title);
  const safeDate = escapeHtml(dateFormatted);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeTitle} - European Environment Agency</title>
  <style>
    :root {
      --eea-blue: #004b87;
      --eea-dark-blue: #003661;
      --eea-light-blue: #f0f7fc;
      --eea-text: #1e293b;
      --eea-text-muted: #64748b;
      --eea-border: #e2e8f0;
      --eea-card-bg: #ffffff;
      --eea-user-bg: #f8fafc;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: var(--eea-text);
      background-color: #f1f5f9;
      line-height: 1.6;
      padding: 2rem 1rem;
    }

    .document-container {
      max-width: 840px;
      margin: 0 auto;
      background: var(--eea-card-bg);
      border: 1px solid var(--eea-border);
      border-radius: 12px;
      box-shadow: 0 4px 16px -2px rgba(0, 75, 135, 0.06);
      padding: 3rem 2.5rem;
    }

    .document-header {
      border-bottom: 2px solid var(--eea-blue);
      padding-bottom: 1.5rem;
      margin-bottom: 2rem;
    }

    .eea-emblem {
      display: inline-block;
      color: var(--eea-blue);
      font-size: 0.85rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin-bottom: 0.5rem;
    }

    .document-title {
      font-size: 1.85rem;
      font-weight: 800;
      color: var(--eea-dark-blue);
      line-height: 1.25;
      margin-bottom: 0.75rem;
    }

    .document-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 1.25rem;
      font-size: 0.85rem;
      color: var(--eea-text-muted);
    }

    .meta-item strong {
      color: var(--eea-text);
    }

    .turn-wrapper {
      margin-bottom: 2rem;
      padding: 1.5rem;
      border-radius: 8px;
      border: 1px solid var(--eea-border);
    }

    .turn-user {
      background: var(--eea-user-bg);
      border-left: 4px solid var(--eea-blue);
    }

    .turn-assistant {
      background: var(--eea-card-bg);
      border-left: 4px solid #10b981;
    }

    .turn-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.75rem;
    }

    .role-badge {
      display: inline-block;
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 2px 8px;
      border-radius: 4px;
    }

    .role-user {
      background: #e0f2fe;
      color: #0369a1;
    }

    .role-assistant {
      background: #dcfce7;
      color: #15803d;
    }

    .turn-number {
      font-size: 0.8rem;
      color: var(--eea-text-muted);
      font-weight: 600;
    }

    .user-text {
      font-size: 1.05rem;
      font-weight: 600;
      color: var(--eea-dark-blue);
    }

    .markdown-body {
      font-size: 0.95rem;
      color: #334155;
    }

    .markdown-body h1,
    .markdown-body h2,
    .markdown-body h3,
    .markdown-body h4 {
      color: var(--eea-dark-blue);
      margin-top: 1.25rem;
      margin-bottom: 0.5rem;
      font-weight: 700;
    }

    .markdown-body p {
      margin-bottom: 0.85rem;
    }

    .markdown-body p:last-child {
      margin-bottom: 0;
    }

    .markdown-body ul,
    .markdown-body ol {
      margin: 0.75rem 0 0.85rem 1.5rem;
    }

    .markdown-body li {
      margin-bottom: 0.35rem;
    }

    .markdown-body table {
      width: 100%;
      border-collapse: collapse;
      margin: 1rem 0;
      font-size: 0.9rem;
    }

    .markdown-body th,
    .markdown-body td {
      border: 1px solid var(--eea-border);
      padding: 0.5rem 0.75rem;
      text-align: left;
    }

    .markdown-body th {
      background: #f8fafc;
      font-weight: 700;
      color: var(--eea-dark-blue);
    }

    .markdown-body code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.85em;
      background: #f1f5f9;
      padding: 0.15em 0.35em;
      border-radius: 4px;
    }

    .markdown-body pre {
      background: #0f172a;
      color: #f8fafc;
      padding: 1rem;
      border-radius: 6px;
      overflow-x: auto;
      margin: 1rem 0;
    }

    .markdown-body pre code {
      background: transparent;
      padding: 0;
      color: inherit;
    }

    .sources-section {
      margin-top: 1.5rem;
      padding-top: 1rem;
      border-top: 1px solid var(--eea-border);
    }

    .sources-heading {
      font-size: 0.8rem;
      font-weight: 700;
      color: var(--eea-blue);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.5rem;
    }

    .sources-list {
      list-style: none;
      padding: 0;
    }

    .source-item {
      font-size: 0.85rem;
      margin-bottom: 0.4rem;
      display: flex;
      align-items: baseline;
      gap: 0.5rem;
    }

    .source-index {
      color: var(--eea-blue);
      font-weight: 700;
      flex-shrink: 0;
    }

    .source-item a {
      color: var(--eea-blue);
      text-decoration: underline;
      text-underline-offset: 2px;
    }

    .source-item a:hover {
      color: var(--eea-dark-blue);
    }

    .document-footer {
      border-top: 1px solid var(--eea-border);
      padding-top: 1.5rem;
      margin-top: 2.5rem;
      font-size: 0.8rem;
      color: var(--eea-text-muted);
      display: flex;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 0.75rem;
    }

    @media print {
      body {
        background: #ffffff;
        padding: 0;
      }
      .document-container {
        box-shadow: none;
        border: none;
        padding: 0;
        max-width: 100%;
      }
      .turn-wrapper {
        break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="document-container">
    <header class="document-header">
      <div class="eea-emblem">European Environment Agency</div>
      <h1 class="document-title">${safeTitle}</h1>
      <div class="document-meta">
        <span class="meta-item">Exported: <strong>${safeDate}</strong></span>
        <span class="meta-item">Questions: <strong>${turnCounter}</strong></span>
      </div>
    </header>

    <main class="document-content">
      ${turnsHtml}
    </main>

    <footer class="document-footer">
      <span>Generated by European Environment Agency AI Assistant</span>
      <span>www.eea.europa.eu</span>
    </footer>
  </div>
</body>
</html>`;
}
