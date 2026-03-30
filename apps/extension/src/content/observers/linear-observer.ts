// ---------------------------------------------------------------------------
// Linear Observer — Captures issue views from linear.app
// ---------------------------------------------------------------------------

import { BaseObserver } from './base-observer';

export class LinearObserver extends BaseObserver {
  constructor() {
    super({
      debounceMs: 2000,
      minCaptureIntervalMs: 15000,
      observeSelectors: [],
      ignoreSelectors: ['script', 'style', 'noscript', 'svg'],
      observeBody: true,
    });
  }

  get name(): string {
    return 'linear';
  }

  get sourceApp(): string {
    return 'chrome:linear';
  }

  shouldActivate(): boolean {
    return (
      window.location.hostname === 'linear.app' &&
      this.isIssuePage()
    );
  }

  extractTitle(): string {
    // Issue identifier + title
    const identifierEl = document.querySelector(
      '[data-testid="issue-identifier"], .issue-identifier'
    );
    const identifier = identifierEl?.textContent?.trim() ?? '';

    const titleEl = document.querySelector(
      '[data-testid="issue-title"], h1[contenteditable], .issue-title textarea, .issue-title input'
    );
    const title = titleEl?.textContent?.trim() ?? '';

    if (identifier && title) return `${identifier}: ${title}`;
    if (title) return title;

    // Fallback to page title
    return document.title.replace(' | Linear', '').trim() || 'Linear Issue';
  }

  extractContent(): string {
    const parts: string[] = [];

    // Issue title
    const title = this.extractTitle();
    parts.push(`# ${title}`);

    // Status
    const status = this.getStatus();
    if (status) parts.push(`Status: ${status}`);

    // Priority
    const priority = this.getPriority();
    if (priority) parts.push(`Priority: ${priority}`);

    // Assignee
    const assignee = this.getAssignee();
    if (assignee) parts.push(`Assignee: ${assignee}`);

    // Labels
    const labels = this.getLabels();
    if (labels.length > 0) parts.push(`Labels: ${labels.join(', ')}`);

    // Description
    const description = this.getDescription();
    if (description) {
      parts.push('\n## Description');
      parts.push(description);
    }

    // Comments
    const comments = this.getComments();
    if (comments.length > 0) {
      parts.push('\n## Comments');
      comments.forEach((comment) => {
        parts.push(`\n### ${comment.author} (${comment.timestamp})`);
        parts.push(comment.content);
      });
    }

    // Activity
    const activities = this.getActivities();
    if (activities.length > 0) {
      parts.push('\n## Activity');
      activities.forEach((activity) => {
        parts.push(`- ${activity}`);
      });
    }

    return parts.join('\n');
  }

  getArtifactType(): string {
    return 'data:issue_tracker';
  }

  extractMetadata(): Record<string, unknown> {
    const metadata: Record<string, unknown> = {
      platform: 'linear',
    };

    // Issue identifier
    const identifierEl = document.querySelector(
      '[data-testid="issue-identifier"], .issue-identifier'
    );
    metadata.issueIdentifier = identifierEl?.textContent?.trim() ?? null;

    // Team from identifier (e.g., "ENG-123" -> "ENG")
    const identifier = metadata.issueIdentifier as string | null;
    if (identifier) {
      const teamPrefix = identifier.split('-')[0];
      metadata.team = teamPrefix;
    }

    // Status
    metadata.status = this.getStatus();

    // Priority
    metadata.priority = this.getPriority();

    // Assignee
    metadata.assignee = this.getAssignee();

    // Labels
    metadata.labels = this.getLabels();

    // Cycle/project
    const cycleEl = document.querySelector(
      '[data-testid="issue-cycle"], .issue-detail-cycle'
    );
    metadata.cycle = cycleEl?.textContent?.trim() ?? null;

    const projectEl = document.querySelector(
      '[data-testid="issue-project"], .issue-detail-project'
    );
    metadata.project = projectEl?.textContent?.trim() ?? null;

    // Estimate
    const estimateEl = document.querySelector(
      '[data-testid="issue-estimate"], .issue-detail-estimate'
    );
    metadata.estimate = estimateEl?.textContent?.trim() ?? null;

    // Due date
    const dueDateEl = document.querySelector(
      '[data-testid="issue-due-date"], .issue-detail-due-date'
    );
    metadata.dueDate = dueDateEl?.textContent?.trim() ?? null;

    // Comment count
    metadata.commentCount = this.getComments().length;

    return metadata;
  }

  // ---- Private helpers ------------------------------------------------------

  private isIssuePage(): boolean {
    // Linear issue pages match /team/issue-identifier pattern
    return /\/[a-zA-Z]+-\d+/.test(window.location.pathname) ||
           /\/issue\/[a-zA-Z]+-\d+/.test(window.location.pathname);
  }

  private getStatus(): string | null {
    const statusEl = document.querySelector(
      '[data-testid="issue-status"] span, ' +
      '.issue-detail-status .status-label, ' +
      'button[aria-label*="Status"] span'
    );
    return statusEl?.textContent?.trim() ?? null;
  }

  private getPriority(): string | null {
    const priorityEl = document.querySelector(
      '[data-testid="issue-priority"] span, ' +
      '.issue-detail-priority span, ' +
      'button[aria-label*="Priority"] span'
    );
    return priorityEl?.textContent?.trim() ?? null;
  }

  private getAssignee(): string | null {
    const assigneeEl = document.querySelector(
      '[data-testid="issue-assignee"] span, ' +
      '.issue-detail-assignee span, ' +
      'button[aria-label*="Assignee"] span'
    );
    return assigneeEl?.textContent?.trim() ?? null;
  }

  private getLabels(): string[] {
    const labelEls = document.querySelectorAll(
      '[data-testid="issue-label"], .issue-detail-label span'
    );
    return Array.from(labelEls)
      .map((el) => el.textContent?.trim())
      .filter((text): text is string => !!text);
  }

  private getDescription(): string | null {
    // Linear renders description in a ProseMirror editor
    const descEl = document.querySelector(
      '[data-testid="issue-description"] .ProseMirror, ' +
      '.issue-description .ProseMirror, ' +
      '.editor-container .ProseMirror'
    );

    if (!descEl) return null;

    return this.extractVisibleText(descEl) || null;
  }

  private getComments(): Array<{ author: string; content: string; timestamp: string }> {
    const comments: Array<{ author: string; content: string; timestamp: string }> = [];

    const commentEls = document.querySelectorAll(
      '[data-testid="comment"], .comment-container'
    );

    commentEls.forEach((commentEl) => {
      const author = commentEl.querySelector(
        '[data-testid="comment-author"], .comment-author'
      )?.textContent?.trim() ?? 'Unknown';

      const timestamp = commentEl.querySelector(
        '[data-testid="comment-timestamp"], .comment-timestamp, time'
      )?.textContent?.trim() ?? '';

      const content = commentEl.querySelector(
        '[data-testid="comment-body"] .ProseMirror, .comment-body .ProseMirror, .comment-content'
      );

      const contentText = content ? this.extractVisibleText(content) : '';

      if (contentText) {
        comments.push({ author, content: contentText, timestamp });
      }
    });

    return comments;
  }

  private getActivities(): string[] {
    const activities: string[] = [];

    const activityEls = document.querySelectorAll(
      '[data-testid="activity-item"], .activity-item'
    );

    activityEls.forEach((el) => {
      const text = el.textContent?.trim()?.replace(/\s+/g, ' ');
      if (text && text.length > 5) {
        activities.push(text.slice(0, 200));
      }
    });

    return activities.slice(0, 20);
  }
}
