// ---------------------------------------------------------------------------
// Figma Observer — Captures design file viewing from figma.com
// ---------------------------------------------------------------------------

import { BaseObserver } from './base-observer';

export class FigmaObserver extends BaseObserver {
  constructor() {
    super({
      debounceMs: 5000,
      minCaptureIntervalMs: 30000,
      observeSelectors: [],
      ignoreSelectors: ['script', 'style', 'noscript', 'svg'],
      observeBody: true,
    });
  }

  get name(): string {
    return 'figma';
  }

  get sourceApp(): string {
    return 'chrome:figma';
  }

  shouldActivate(): boolean {
    return (
      (window.location.hostname === 'www.figma.com' ||
        window.location.hostname === 'figma.com') &&
      (window.location.pathname.includes('/design/') ||
        window.location.pathname.includes('/file/') ||
        window.location.pathname.includes('/proto/') ||
        window.location.pathname.includes('/board/'))
    );
  }

  extractTitle(): string {
    // Figma file name is typically in the tab or a header element
    const fileNameEl = document.querySelector(
      '[data-testid="filename-input"], .filename_view--filenameInput--N4lqe'
    );
    if (fileNameEl?.textContent?.trim()) return fileNameEl.textContent.trim();

    // Try input element
    const fileNameInput = document.querySelector<HTMLInputElement>(
      'input[data-testid="filename-input"]'
    );
    if (fileNameInput?.value) return fileNameInput.value;

    // Fallback to page title
    const title = document.title
      .replace(' - Figma', '')
      .replace(' - FigJam', '')
      .trim();
    return title || 'Untitled Design';
  }

  extractContent(): string {
    const parts: string[] = [];

    // File name
    const title = this.extractTitle();
    parts.push(`# ${title}`);

    // Current page/frame info
    const pageName = this.getCurrentPageName();
    if (pageName) {
      parts.push(`Page: ${pageName}`);
    }

    // Selected node info
    const selectedInfo = this.getSelectionInfo();
    if (selectedInfo) {
      parts.push(`\n## Selected: ${selectedInfo.name}`);
      if (selectedInfo.type) parts.push(`Type: ${selectedInfo.type}`);
      if (selectedInfo.dimensions) parts.push(`Dimensions: ${selectedInfo.dimensions}`);
    }

    // Layer panel info
    const layers = this.extractLayerInfo();
    if (layers.length > 0) {
      parts.push('\n## Layers');
      layers.forEach((layer) => {
        parts.push(`- ${layer}`);
      });
    }

    // Comments (if visible)
    const comments = this.extractComments();
    if (comments.length > 0) {
      parts.push('\n## Comments');
      comments.forEach((comment) => {
        parts.push(`- ${comment}`);
      });
    }

    // Design tokens visible in properties panel
    const properties = this.extractDesignProperties();
    if (Object.keys(properties).length > 0) {
      parts.push('\n## Design Properties');
      for (const [key, value] of Object.entries(properties)) {
        parts.push(`${key}: ${value}`);
      }
    }

    return parts.join('\n');
  }

  getArtifactType(): string {
    return 'design:figma';
  }

  extractMetadata(): Record<string, unknown> {
    const metadata: Record<string, unknown> = {};

    // File key from URL
    const fileMatch = window.location.pathname.match(/\/(file|design|proto|board)\/([^/]+)/);
    if (fileMatch) {
      metadata.figmaFileKey = fileMatch[2];
      metadata.figmaViewType = fileMatch[1];
    }

    // Node ID from URL
    const nodeMatch = window.location.search.match(/node-id=([^&]+)/);
    if (nodeMatch) {
      metadata.figmaNodeId = decodeURIComponent(nodeMatch[1]);
    }

    // Current page name
    metadata.currentPage = this.getCurrentPageName();

    // File type (design vs. FigJam)
    metadata.isFigJam = document.title.includes('FigJam');

    // Collaborator count
    const avatars = document.querySelectorAll(
      '[data-testid="multiplayer-avatar"], .multiplayer_avatar--avatarWrapper'
    );
    metadata.activeCollaborators = avatars.length;

    // Zoom level (if extractable)
    const zoomEl = document.querySelector('[data-testid="zoom-level"]');
    metadata.zoomLevel = zoomEl?.textContent?.trim() ?? null;

    return metadata;
  }

  // ---- Private helpers ------------------------------------------------------

  private getCurrentPageName(): string | null {
    const pageTab = document.querySelector(
      '.pages_panel--pageName--selected, [data-testid="page-row--selected"]'
    );
    return pageTab?.textContent?.trim() ?? null;
  }

  private getSelectionInfo(): { name: string; type: string | null; dimensions: string | null } | null {
    // Look for selection info in the design panel
    const nameEl = document.querySelector(
      '[data-testid="object-name"], .raw_components--panelTitle'
    );
    if (!nameEl?.textContent?.trim()) return null;

    const typeEl = document.querySelector('[data-testid="node-type"]');
    const widthEl = document.querySelector('[data-testid="width-input"] input');
    const heightEl = document.querySelector('[data-testid="height-input"] input');

    let dimensions: string | null = null;
    if (widthEl && heightEl) {
      const w = (widthEl as HTMLInputElement).value;
      const h = (heightEl as HTMLInputElement).value;
      if (w && h) dimensions = `${w} x ${h}`;
    }

    return {
      name: nameEl.textContent.trim(),
      type: typeEl?.textContent?.trim() ?? null,
      dimensions,
    };
  }

  private extractLayerInfo(): string[] {
    const layers: string[] = [];
    const layerItems = document.querySelectorAll(
      '[data-testid="layer-row"], .objects_panel--layerRow'
    );

    layerItems.forEach((item) => {
      const name = item.textContent?.trim();
      if (name) layers.push(name);
    });

    return layers.slice(0, 30); // Limit to avoid excessive data
  }

  private extractComments(): string[] {
    const comments: string[] = [];
    const commentEls = document.querySelectorAll(
      '.comment_thread--commentBody, [data-testid="comment-body"]'
    );

    commentEls.forEach((el) => {
      const author = el.closest('[data-testid="comment-thread"]')
        ?.querySelector('[data-testid="comment-author"]')?.textContent?.trim();
      const text = el.textContent?.trim();
      if (text) {
        comments.push(author ? `${author}: ${text}` : text);
      }
    });

    return comments.slice(0, 20);
  }

  private extractDesignProperties(): Record<string, string> {
    const props: Record<string, string> = {};

    // Colors
    const fillColor = document.querySelector('[data-testid="fill-color-value"]');
    if (fillColor?.textContent) props['Fill'] = fillColor.textContent.trim();

    const strokeColor = document.querySelector('[data-testid="stroke-color-value"]');
    if (strokeColor?.textContent) props['Stroke'] = strokeColor.textContent.trim();

    // Typography
    const fontFamily = document.querySelector('[data-testid="font-family"]');
    if (fontFamily?.textContent) props['Font'] = fontFamily.textContent.trim();

    const fontSize = document.querySelector('[data-testid="font-size-input"] input');
    if (fontSize) props['Font Size'] = (fontSize as HTMLInputElement).value;

    // Spacing
    const paddingEl = document.querySelector('[data-testid="padding-input"] input');
    if (paddingEl) props['Padding'] = (paddingEl as HTMLInputElement).value;

    // Border radius
    const radiusEl = document.querySelector('[data-testid="corner-radius-input"] input');
    if (radiusEl) props['Border Radius'] = (radiusEl as HTMLInputElement).value;

    return props;
  }
}
