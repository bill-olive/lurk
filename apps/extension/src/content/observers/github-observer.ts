// ---------------------------------------------------------------------------
// GitHub Observer — Captures PR views, code changes, issues
// ---------------------------------------------------------------------------

import { BaseObserver } from './base-observer';

type GitHubView = 'pr' | 'issue' | 'code' | 'repo' | 'unknown';

export class GitHubObserver extends BaseObserver {
  private currentView: GitHubView = 'unknown';

  constructor() {
    super({
      debounceMs: 2000,
      minCaptureIntervalMs: 15000,
      observeSelectors: [],
      ignoreSelectors: [
        'script', 'style', 'noscript', 'svg',
        '.js-header-wrapper',
        '.Footer',
        '.flash-messages',
        '.js-notification-shelf',
      ],
      observeBody: true,
    });
  }

  get name(): string {
    return 'github';
  }

  get sourceApp(): string {
    return 'chrome:github';
  }

  shouldActivate(): boolean {
    if (window.location.hostname !== 'github.com') return false;

    this.detectView();
    return this.currentView !== 'unknown';
  }

  extractTitle(): string {
    switch (this.currentView) {
      case 'pr': {
        const titleEl = document.querySelector('.js-issue-title');
        const prNumber = window.location.pathname.split('/').pop();
        const title = titleEl?.textContent?.trim() ?? 'Pull Request';
        return `PR #${prNumber}: ${title}`;
      }

      case 'issue': {
        const titleEl = document.querySelector('.js-issue-title');
        const issueNumber = window.location.pathname.split('/').pop();
        const title = titleEl?.textContent?.trim() ?? 'Issue';
        return `Issue #${issueNumber}: ${title}`;
      }

      case 'code': {
        const filePath = document.querySelector('#blob-path')?.textContent?.trim();
        if (filePath) return filePath;
        const breadcrumb = document.querySelector('.final-path')?.textContent?.trim();
        return breadcrumb ?? document.title.replace(' - GitHub', '');
      }

      case 'repo': {
        const repoName = document.querySelector('[itemprop="name"] a')?.textContent?.trim();
        return repoName ?? document.title.replace(' - GitHub', '');
      }

      default:
        return document.title.replace(' - GitHub', '');
    }
  }

  extractContent(): string {
    this.detectView();

    switch (this.currentView) {
      case 'pr':
        return this.extractPRContent();
      case 'issue':
        return this.extractIssueContent();
      case 'code':
        return this.extractCodeContent();
      default:
        return '';
    }
  }

  getArtifactType(): string {
    switch (this.currentView) {
      case 'pr':
        return 'code:pr';
      case 'issue':
        return 'data:issue_tracker';
      case 'code':
        return 'code:file';
      default:
        return 'code:file';
    }
  }

  extractMetadata(): Record<string, unknown> {
    const metadata: Record<string, unknown> = {
      view: this.currentView,
    };

    // Extract repo info from URL
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    if (pathParts.length >= 2) {
      metadata.owner = pathParts[0];
      metadata.repo = pathParts[1];
      metadata.fullRepo = `${pathParts[0]}/${pathParts[1]}`;
    }

    switch (this.currentView) {
      case 'pr':
        this.extractPRMetadata(metadata);
        break;
      case 'issue':
        this.extractIssueMetadata(metadata);
        break;
      case 'code':
        this.extractCodeMetadata(metadata);
        break;
    }

    return metadata;
  }

  // ---- Private helpers ------------------------------------------------------

  private detectView(): void {
    const path = window.location.pathname;

    if (/\/pull\/\d+/.test(path)) {
      this.currentView = 'pr';
    } else if (/\/issues\/\d+/.test(path)) {
      this.currentView = 'issue';
    } else if (path.includes('/blob/') || path.includes('/tree/')) {
      this.currentView = 'code';
    } else if (/^\/[^/]+\/[^/]+\/?$/.test(path)) {
      this.currentView = 'repo';
    } else {
      this.currentView = 'unknown';
    }
  }

  private extractPRContent(): string {
    const parts: string[] = [];

    // PR title
    const title = document.querySelector('.js-issue-title')?.textContent?.trim();
    if (title) parts.push(`# ${title}`);

    // PR state
    const state = document.querySelector('.State')?.textContent?.trim();
    if (state) parts.push(`Status: ${state}`);

    // PR description
    const description = document.querySelector('.comment-body');
    if (description) {
      parts.push('\n## Description');
      parts.push(this.extractVisibleText(description));
    }

    // PR comments
    const comments = document.querySelectorAll('.timeline-comment .comment-body');
    if (comments.length > 0) {
      parts.push('\n## Discussion');
      comments.forEach((comment, idx) => {
        const author = comment.closest('.timeline-comment')
          ?.querySelector('.author')?.textContent?.trim() ?? 'Unknown';
        parts.push(`\n### Comment ${idx + 1} by ${author}`);
        parts.push(this.extractVisibleText(comment));
      });
    }

    // File changes (if on Files tab)
    const diffStats = document.querySelector('.diffstat');
    if (diffStats) {
      parts.push(`\nDiff: ${diffStats.textContent?.trim()}`);
    }

    // Changed files
    const changedFiles = document.querySelectorAll('.file-info .Truncate a');
    if (changedFiles.length > 0) {
      parts.push('\n## Changed Files');
      changedFiles.forEach((file) => {
        parts.push(`- ${file.textContent?.trim()}`);
      });
    }

    return parts.join('\n');
  }

  private extractIssueContent(): string {
    const parts: string[] = [];

    const title = document.querySelector('.js-issue-title')?.textContent?.trim();
    if (title) parts.push(`# ${title}`);

    const state = document.querySelector('.State')?.textContent?.trim();
    if (state) parts.push(`Status: ${state}`);

    // Issue body
    const body = document.querySelector('.comment-body');
    if (body) {
      parts.push('\n## Description');
      parts.push(this.extractVisibleText(body));
    }

    // Labels
    const labels = document.querySelectorAll('.js-issue-labels .IssueLabel');
    if (labels.length > 0) {
      const labelTexts = Array.from(labels).map((l) => l.textContent?.trim()).filter(Boolean);
      parts.push(`\nLabels: ${labelTexts.join(', ')}`);
    }

    // Assignees
    const assignees = document.querySelectorAll('.js-issue-assignees .assignee');
    if (assignees.length > 0) {
      const assigneeTexts = Array.from(assignees).map((a) => a.textContent?.trim()).filter(Boolean);
      parts.push(`Assignees: ${assigneeTexts.join(', ')}`);
    }

    // Comments
    const comments = document.querySelectorAll('.timeline-comment .comment-body');
    if (comments.length > 1) {
      parts.push('\n## Comments');
      // Skip first comment (it's the issue body)
      Array.from(comments).slice(1).forEach((comment, idx) => {
        const author = comment.closest('.timeline-comment')
          ?.querySelector('.author')?.textContent?.trim() ?? 'Unknown';
        parts.push(`\n### Comment ${idx + 1} by ${author}`);
        parts.push(this.extractVisibleText(comment));
      });
    }

    return parts.join('\n');
  }

  private extractCodeContent(): string {
    const parts: string[] = [];

    // File path
    const filePath = document.querySelector('#blob-path')?.textContent?.trim();
    if (filePath) parts.push(`File: ${filePath}`);

    // Code content
    const codeContainer = document.querySelector('.blob-code-content');
    if (codeContainer) {
      const lines = codeContainer.querySelectorAll('.blob-code-inner');
      const codeLines = Array.from(lines).map((line) => line.textContent ?? '');
      parts.push('\n```');
      parts.push(codeLines.join('\n'));
      parts.push('```');
    }

    return parts.join('\n');
  }

  private extractPRMetadata(metadata: Record<string, unknown>): void {
    const prNumber = window.location.pathname.match(/\/pull\/(\d+)/)?.[1];
    metadata.prNumber = prNumber ? parseInt(prNumber, 10) : null;

    const state = document.querySelector('.State')?.textContent?.trim()?.toLowerCase();
    metadata.prState = state ?? 'unknown';

    const author = document.querySelector('.pull-header-username')?.textContent?.trim();
    metadata.author = author ?? null;

    // Branch info
    const baseBranch = document.querySelector('.base-ref')?.textContent?.trim();
    const headBranch = document.querySelector('.head-ref')?.textContent?.trim();
    metadata.baseBranch = baseBranch ?? null;
    metadata.headBranch = headBranch ?? null;

    // Review status
    const reviewers = document.querySelectorAll('.js-issue-sidebar-form .assignee');
    metadata.reviewerCount = reviewers.length;

    // Checks
    const checksStatus = document.querySelector('.branch-action-item .status-heading')?.textContent?.trim();
    metadata.checksStatus = checksStatus ?? null;
  }

  private extractIssueMetadata(metadata: Record<string, unknown>): void {
    const issueNumber = window.location.pathname.match(/\/issues\/(\d+)/)?.[1];
    metadata.issueNumber = issueNumber ? parseInt(issueNumber, 10) : null;

    const state = document.querySelector('.State')?.textContent?.trim()?.toLowerCase();
    metadata.issueState = state ?? 'unknown';

    const labels = document.querySelectorAll('.js-issue-labels .IssueLabel');
    metadata.labels = Array.from(labels).map((l) => l.textContent?.trim()).filter(Boolean);

    const commentCount = document.querySelectorAll('.timeline-comment').length;
    metadata.commentCount = commentCount;
  }

  private extractCodeMetadata(metadata: Record<string, unknown>): void {
    const filePath = document.querySelector('#blob-path')?.textContent?.trim();
    metadata.filePath = filePath ?? null;

    // File extension
    if (filePath) {
      const ext = filePath.split('.').pop();
      metadata.fileExtension = ext ?? null;
      metadata.language = this.detectLanguage(ext ?? '');
    }

    // Line count
    const lines = document.querySelectorAll('.blob-code-inner');
    metadata.lineCount = lines.length;

    // File size
    const sizeEl = document.querySelector('.file-info-divider + span');
    metadata.fileSize = sizeEl?.textContent?.trim() ?? null;
  }

  private detectLanguage(ext: string): string {
    const langMap: Record<string, string> = {
      ts: 'TypeScript', tsx: 'TypeScript', js: 'JavaScript', jsx: 'JavaScript',
      py: 'Python', rb: 'Ruby', go: 'Go', rs: 'Rust', java: 'Java',
      swift: 'Swift', kt: 'Kotlin', cpp: 'C++', c: 'C', cs: 'C#',
      md: 'Markdown', json: 'JSON', yaml: 'YAML', yml: 'YAML',
      html: 'HTML', css: 'CSS', scss: 'SCSS', sql: 'SQL',
    };
    return langMap[ext.toLowerCase()] ?? ext;
  }
}
