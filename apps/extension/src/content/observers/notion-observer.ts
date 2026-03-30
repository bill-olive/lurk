// ---------------------------------------------------------------------------
// Notion Observer — Captures page content from notion.so
// ---------------------------------------------------------------------------

import { BaseObserver } from './base-observer';

export class NotionObserver extends BaseObserver {
  constructor() {
    super({
      debounceMs: 3000,
      minCaptureIntervalMs: 15000,
      observeSelectors: ['.notion-page-content'],
      ignoreSelectors: [
        'script', 'style', 'noscript', 'svg',
        '.notion-overlay-container',
        '.notion-peek-renderer',
        '.notion-sidebar',
      ],
    });
  }

  get name(): string {
    return 'notion';
  }

  get sourceApp(): string {
    return 'chrome:notion';
  }

  shouldActivate(): boolean {
    return (
      window.location.hostname === 'www.notion.so' ||
      window.location.hostname === 'notion.so'
    );
  }

  extractTitle(): string {
    // Notion page title is in a specific placeholder div or heading
    const titleEl = document.querySelector(
      '.notion-page-content .notion-page-block .notranslate [data-root="true"]'
    );
    if (titleEl?.textContent?.trim()) return titleEl.textContent.trim();

    // Try the header placeholder
    const headerTitle = document.querySelector(
      '.notion-page-content [placeholder="Untitled"]'
    );
    if (headerTitle?.textContent?.trim()) return headerTitle.textContent.trim();

    // Try breadcrumb
    const breadcrumb = document.querySelector('.notion-topbar .notion-record-icon + div');
    if (breadcrumb?.textContent?.trim()) return breadcrumb.textContent.trim();

    // Fallback to page title
    return document.title.replace(' - Notion', '').trim() || 'Untitled';
  }

  extractContent(): string {
    const pageContent = document.querySelector('.notion-page-content');
    if (!pageContent) return '';

    const parts: string[] = [];

    // Title
    const title = this.extractTitle();
    if (title && title !== 'Untitled') {
      parts.push(`# ${title}`);
    }

    // Walk through content blocks
    const blocks = pageContent.querySelectorAll('[data-block-id]');
    blocks.forEach((block) => {
      const blockContent = this.extractBlockContent(block);
      if (blockContent) {
        parts.push(blockContent);
      }
    });

    return parts.join('\n\n');
  }

  getArtifactType(): string {
    return 'document:notion';
  }

  extractMetadata(): Record<string, unknown> {
    const metadata: Record<string, unknown> = {};

    // Page ID from URL
    const pathParts = window.location.pathname.split('-');
    const pageId = pathParts[pathParts.length - 1];
    if (pageId && pageId.length >= 32) {
      metadata.notionPageId = pageId;
    }

    // Workspace
    const workspaceEl = document.querySelector('.notion-sidebar-switcher');
    metadata.workspace = workspaceEl?.textContent?.trim() ?? null;

    // Page icon
    const iconEl = document.querySelector('.notion-page-content .notion-record-icon');
    metadata.pageIcon = iconEl?.textContent?.trim() ?? null;

    // Properties (if database page)
    const properties = document.querySelectorAll('.notion-page-content .notion-collection_view-block .notion-table-view');
    metadata.hasDatabase = properties.length > 0;

    // Block count
    const blocks = document.querySelectorAll('.notion-page-content [data-block-id]');
    metadata.blockCount = blocks.length;

    // Last edited info from header
    const lastEdited = document.querySelector('.notion-topbar-more-button');
    metadata.lastEditedVisible = !!lastEdited;

    // Word count
    const content = this.extractContent();
    metadata.wordCount = content.split(/\s+/).filter(Boolean).length;

    return metadata;
  }

  // ---- Private helpers ------------------------------------------------------

  private extractBlockContent(block: Element): string {
    const blockType = this.detectBlockType(block);

    switch (blockType) {
      case 'heading1': {
        const text = this.getBlockText(block);
        return text ? `## ${text}` : '';
      }

      case 'heading2': {
        const text = this.getBlockText(block);
        return text ? `### ${text}` : '';
      }

      case 'heading3': {
        const text = this.getBlockText(block);
        return text ? `#### ${text}` : '';
      }

      case 'bulleted_list': {
        const text = this.getBlockText(block);
        return text ? `- ${text}` : '';
      }

      case 'numbered_list': {
        const text = this.getBlockText(block);
        return text ? `1. ${text}` : '';
      }

      case 'toggle': {
        const text = this.getBlockText(block);
        return text ? `> ${text}` : '';
      }

      case 'code': {
        const text = this.getBlockText(block);
        return text ? `\`\`\`\n${text}\n\`\`\`` : '';
      }

      case 'quote': {
        const text = this.getBlockText(block);
        return text ? `> ${text}` : '';
      }

      case 'divider':
        return '---';

      case 'callout': {
        const text = this.getBlockText(block);
        return text ? `> [!NOTE] ${text}` : '';
      }

      case 'todo': {
        const checkbox = block.querySelector('input[type="checkbox"]');
        const checked = checkbox ? (checkbox as HTMLInputElement).checked : false;
        const text = this.getBlockText(block);
        return text ? `- [${checked ? 'x' : ' '}] ${text}` : '';
      }

      default: {
        const text = this.getBlockText(block);
        return text || '';
      }
    }
  }

  private detectBlockType(block: Element): string {
    const classes = block.className;

    if (classes.includes('notion-header-block')) return 'heading1';
    if (classes.includes('notion-sub_header-block')) return 'heading2';
    if (classes.includes('notion-sub_sub_header-block')) return 'heading3';
    if (classes.includes('notion-bulleted_list-block')) return 'bulleted_list';
    if (classes.includes('notion-numbered_list-block')) return 'numbered_list';
    if (classes.includes('notion-toggle-block')) return 'toggle';
    if (classes.includes('notion-code-block')) return 'code';
    if (classes.includes('notion-quote-block')) return 'quote';
    if (classes.includes('notion-divider-block')) return 'divider';
    if (classes.includes('notion-callout-block')) return 'callout';
    if (classes.includes('notion-to_do-block')) return 'todo';
    if (classes.includes('notion-text-block')) return 'text';

    return 'text';
  }

  private getBlockText(block: Element): string {
    // Notion stores text in contenteditable spans
    const editableEl = block.querySelector('[contenteditable="true"]');
    if (editableEl) {
      return editableEl.textContent?.trim() ?? '';
    }

    // Fallback: get visible text from the block, excluding nested blocks
    const textContent = block.querySelector('[data-content-editable-leaf="true"]');
    if (textContent) {
      return textContent.textContent?.trim() ?? '';
    }

    return this.extractVisibleText(block);
  }
}
