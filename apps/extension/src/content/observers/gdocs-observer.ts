// ---------------------------------------------------------------------------
// Google Docs Observer — Captures document content from docs.google.com
// ---------------------------------------------------------------------------

import { BaseObserver } from './base-observer';

export class GDocsObserver extends BaseObserver {
  constructor() {
    super({
      debounceMs: 3000,
      minCaptureIntervalMs: 15000,
      observeSelectors: ['.kix-appview-editor'],
      ignoreSelectors: [
        'script', 'style', 'noscript', 'svg',
        '.docs-explore-widget',
        '.docs-butterbar-container',
        '.docs-companion-app-container',
      ],
    });
  }

  get name(): string {
    return 'gdocs';
  }

  get sourceApp(): string {
    return 'chrome:gdocs';
  }

  shouldActivate(): boolean {
    return (
      window.location.hostname === 'docs.google.com' &&
      window.location.pathname.includes('/document/d/')
    );
  }

  extractTitle(): string {
    // Google Docs title is in an input element or the page title
    const titleInput = document.querySelector<HTMLInputElement>('.docs-title-input');
    if (titleInput?.value) return titleInput.value;

    const titleEl = document.querySelector('.docs-title-widget .docs-title-input-label-inner');
    if (titleEl?.textContent) return titleEl.textContent.trim();

    // Fallback to page title minus " - Google Docs"
    const pageTitle = document.title.replace(/\s*-\s*Google Docs\s*$/, '');
    return pageTitle || 'Untitled Document';
  }

  extractContent(): string {
    // Google Docs renders content in .kix-appview-editor
    const editor = document.querySelector('.kix-appview-editor');
    if (!editor) return '';

    // Extract paragraphs from the editor content
    const paragraphs = editor.querySelectorAll('.kix-paragraphrenderer');
    const textParts: string[] = [];

    paragraphs.forEach((para) => {
      const lineContainers = para.querySelectorAll('.kix-lineview');
      const paraText: string[] = [];

      lineContainers.forEach((line) => {
        // Each line has word groups
        const wordGroups = line.querySelectorAll('.kix-wordhtmlgenerator-word-node');
        wordGroups.forEach((wordGroup) => {
          const text = wordGroup.textContent;
          if (text) paraText.push(text);
        });
      });

      const fullText = paraText.join('');
      if (fullText.trim()) {
        textParts.push(fullText.trim());
      }
    });

    return textParts.join('\n\n');
  }

  getArtifactType(): string {
    return 'document:gdoc';
  }

  extractMetadata(): Record<string, unknown> {
    const metadata: Record<string, unknown> = {};

    // Document ID from URL
    const match = window.location.pathname.match(/\/document\/d\/([^/]+)/);
    if (match) {
      metadata.googleDocId = match[1];
    }

    // Last edited info
    const lastEditEl = document.querySelector('.docs-title-save-label-text');
    if (lastEditEl?.textContent) {
      metadata.lastEditStatus = lastEditEl.textContent.trim();
    }

    // Count headings for structure info
    const headings = document.querySelectorAll(
      '.kix-paragraphrenderer [style*="font-size: 20px"], ' +
      '.kix-paragraphrenderer [style*="font-size: 16px"], ' +
      '.kix-paragraphrenderer [style*="font-size: 14px"]'
    );
    metadata.headingCount = headings.length;

    // Word count estimate
    const content = this.extractContent();
    metadata.wordCount = content.split(/\s+/).filter(Boolean).length;

    // Detect collaborators (if sharing info visible)
    const collaborators = document.querySelectorAll('.docs-presence-plus-collab-widget-avatar');
    metadata.activeCollaborators = collaborators.length;

    return metadata;
  }
}
