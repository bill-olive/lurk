// ---------------------------------------------------------------------------
// CRM Observer — Captures Salesforce and HubSpot record views
// ---------------------------------------------------------------------------

import { BaseObserver } from './base-observer';

type CRMPlatform = 'salesforce' | 'hubspot';
type RecordType = 'contact' | 'account' | 'deal' | 'opportunity' | 'lead' | 'ticket' | 'unknown';

export class CRMObserver extends BaseObserver {
  private platform: CRMPlatform = 'salesforce';
  private recordType: RecordType = 'unknown';

  constructor() {
    super({
      debounceMs: 3000,
      minCaptureIntervalMs: 15000,
      observeSelectors: [],
      ignoreSelectors: ['script', 'style', 'noscript', 'svg', 'iframe'],
      observeBody: true,
    });
  }

  get name(): string {
    return 'crm';
  }

  get sourceApp(): string {
    return `chrome:${this.platform}`;
  }

  shouldActivate(): boolean {
    const hostname = window.location.hostname;

    if (hostname.includes('.salesforce.com') || hostname.includes('.force.com')) {
      this.platform = 'salesforce';
      return this.isSalesforceRecordPage();
    }

    if (hostname.includes('.hubspot.com')) {
      this.platform = 'hubspot';
      return this.isHubSpotRecordPage();
    }

    return false;
  }

  extractTitle(): string {
    if (this.platform === 'salesforce') {
      return this.extractSalesforceTitle();
    }
    return this.extractHubSpotTitle();
  }

  extractContent(): string {
    this.detectRecordType();

    if (this.platform === 'salesforce') {
      return this.extractSalesforceContent();
    }
    return this.extractHubSpotContent();
  }

  getArtifactType(): string {
    return 'data:crm_record';
  }

  extractMetadata(): Record<string, unknown> {
    const metadata: Record<string, unknown> = {
      platform: this.platform,
      recordType: this.recordType,
    };

    if (this.platform === 'salesforce') {
      this.extractSalesforceMetadata(metadata);
    } else {
      this.extractHubSpotMetadata(metadata);
    }

    return metadata;
  }

  // ---- Salesforce helpers ---------------------------------------------------

  private isSalesforceRecordPage(): boolean {
    const path = window.location.pathname;
    // Lightning record pages: /lightning/r/Object/RecordId/view
    return /\/lightning\/r\/\w+\/[a-zA-Z0-9]+\/view/.test(path) ||
           // Classic record pages
           /\/[a-zA-Z0-9]{15,18}/.test(path);
  }

  private extractSalesforceTitle(): string {
    // Lightning experience record name
    const nameEl = document.querySelector(
      '.slds-page-header__title .uiOutputText, ' +
      'lightning-formatted-text[data-output-element-id="output-field"], ' +
      '.entityNameTitle, ' +
      'h1.slds-page-header__title'
    );
    if (nameEl?.textContent?.trim()) {
      return `${this.recordType}: ${nameEl.textContent.trim()}`;
    }

    // Record type from header
    const headerEl = document.querySelector('.slds-page-header__meta-text');
    const header = headerEl?.textContent?.trim() ?? '';

    return header ? `${header}` : `Salesforce Record`;
  }

  private extractSalesforceContent(): string {
    const parts: string[] = [];

    const title = this.extractSalesforceTitle();
    parts.push(`# ${title}`);

    // Record details (Lightning)
    const detailSections = document.querySelectorAll(
      'records-record-layout-section, .slds-section'
    );

    detailSections.forEach((section) => {
      const sectionTitle = section.querySelector(
        '.slds-section__title, .section-header-title'
      )?.textContent?.trim();

      if (sectionTitle) {
        parts.push(`\n## ${sectionTitle}`);
      }

      // Field-value pairs
      const fields = section.querySelectorAll(
        'records-record-layout-item, .slds-form-element'
      );

      fields.forEach((field) => {
        const label = field.querySelector(
          '.slds-form-element__label, span.test-id__field-label'
        )?.textContent?.trim();
        const value = field.querySelector(
          '.slds-form-element__static, lightning-formatted-text, lightning-formatted-url'
        )?.textContent?.trim();

        if (label && value) {
          parts.push(`**${label}**: ${value}`);
        }
      });
    });

    // Activity timeline
    const activities = document.querySelectorAll(
      'timeline-item-template, .activityTimelineItem'
    );
    if (activities.length > 0) {
      parts.push('\n## Activity Timeline');
      activities.forEach((activity) => {
        const actText = activity.textContent?.trim();
        if (actText) {
          const compressed = actText.replace(/\s+/g, ' ').slice(0, 200);
          parts.push(`- ${compressed}`);
        }
      });
    }

    return parts.join('\n');
  }

  private extractSalesforceMetadata(metadata: Record<string, unknown>): void {
    // Record ID from URL
    const idMatch = window.location.pathname.match(/\/([a-zA-Z0-9]{15,18})\//);
    metadata.recordId = idMatch?.[1] ?? null;

    // Object type from URL
    const objectMatch = window.location.pathname.match(/\/lightning\/r\/(\w+)\//);
    metadata.objectType = objectMatch?.[1] ?? null;

    // Owner
    const ownerEl = document.querySelector(
      '[data-target-selection-name="sfdc:RecordField.Account.OwnerId"] lightning-formatted-text, ' +
      '[data-field-id="OwnerId"] .slds-form-element__static'
    );
    metadata.owner = ownerEl?.textContent?.trim() ?? null;

    // Last modified
    const lastModEl = document.querySelector(
      '[data-target-selection-name="sfdc:RecordField.Account.LastModifiedDate"] lightning-formatted-text'
    );
    metadata.lastModified = lastModEl?.textContent?.trim() ?? null;
  }

  // ---- HubSpot helpers ------------------------------------------------------

  private isHubSpotRecordPage(): boolean {
    const path = window.location.pathname;
    return /\/contacts\/\d+\/record\/\d+/.test(path) ||
           /\/contacts\/\d+\/deal\/\d+/.test(path) ||
           /\/contacts\/\d+\/company\/\d+/.test(path) ||
           /\/contacts\/\d+\/ticket\/\d+/.test(path);
  }

  private extractHubSpotTitle(): string {
    const nameEl = document.querySelector(
      'h1[data-test-id="record-title"], ' +
      '.private-header__heading, ' +
      '[data-selenium="record-title"]'
    );
    if (nameEl?.textContent?.trim()) {
      return `${this.recordType}: ${nameEl.textContent.trim()}`;
    }
    return 'HubSpot Record';
  }

  private extractHubSpotContent(): string {
    const parts: string[] = [];

    const title = this.extractHubSpotTitle();
    parts.push(`# ${title}`);

    // Properties panel
    const propertyGroups = document.querySelectorAll(
      '[data-test-id="property-group"], .private-card'
    );

    propertyGroups.forEach((group) => {
      const groupTitle = group.querySelector(
        '.private-card__title, h3, h4'
      )?.textContent?.trim();

      if (groupTitle) {
        parts.push(`\n## ${groupTitle}`);
      }

      // Property rows
      const rows = group.querySelectorAll(
        '[data-test-id="property-row"], .private-form__set'
      );

      rows.forEach((row) => {
        const label = row.querySelector(
          '[data-test-id="property-label"], label'
        )?.textContent?.trim();
        const value = row.querySelector(
          '[data-test-id="property-value"], .private-form__control'
        )?.textContent?.trim();

        if (label && value && value !== '--') {
          parts.push(`**${label}**: ${value}`);
        }
      });
    });

    // Timeline / activity
    const activities = document.querySelectorAll(
      '[data-test-id="timeline-event"], .timeline-event'
    );
    if (activities.length > 0) {
      parts.push('\n## Activity');
      activities.forEach((activity) => {
        const text = activity.textContent?.trim()?.replace(/\s+/g, ' ').slice(0, 200);
        if (text) parts.push(`- ${text}`);
      });
    }

    return parts.join('\n');
  }

  private extractHubSpotMetadata(metadata: Record<string, unknown>): void {
    // Record ID from URL
    const idMatch = window.location.pathname.match(/\/(\d+)$/);
    metadata.recordId = idMatch?.[1] ?? null;

    // Object type from URL
    if (window.location.pathname.includes('/deal/')) metadata.objectType = 'deal';
    else if (window.location.pathname.includes('/company/')) metadata.objectType = 'company';
    else if (window.location.pathname.includes('/ticket/')) metadata.objectType = 'ticket';
    else metadata.objectType = 'contact';

    // Pipeline stage
    const stageEl = document.querySelector(
      '[data-test-id="deal-stage-selector"], .deal-stage-current'
    );
    metadata.pipelineStage = stageEl?.textContent?.trim() ?? null;

    // Deal amount
    const amountEl = document.querySelector(
      '[data-test-id="property-amount"] [data-test-id="property-value"]'
    );
    metadata.dealAmount = amountEl?.textContent?.trim() ?? null;
  }

  // ---- Shared ---------------------------------------------------------------

  private detectRecordType(): void {
    if (this.platform === 'salesforce') {
      const objType = window.location.pathname.match(/\/lightning\/r\/(\w+)\//)?.[1]?.toLowerCase();
      const typeMap: Record<string, RecordType> = {
        account: 'account', contact: 'contact', lead: 'lead',
        opportunity: 'opportunity', case: 'ticket',
      };
      this.recordType = (objType && typeMap[objType]) ?? 'unknown';
    } else {
      const path = window.location.pathname;
      if (path.includes('/deal/')) this.recordType = 'deal';
      else if (path.includes('/company/')) this.recordType = 'account';
      else if (path.includes('/ticket/')) this.recordType = 'ticket';
      else this.recordType = 'contact';
    }
  }
}
