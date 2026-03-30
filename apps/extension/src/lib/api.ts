// ---------------------------------------------------------------------------
// API — Client for communicating with Lurk cloud services
// ---------------------------------------------------------------------------

import { auth } from './auth';

// ---- Types -----------------------------------------------------------------

export interface APIResponse<T> {
  data: T;
  error: null;
}

export interface APIError {
  data: null;
  error: {
    code: string;
    message: string;
    status: number;
  };
}

export type APIResult<T> = APIResponse<T> | APIError;

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface ArtifactCapture {
  type: string;
  title: string;
  sourceUrl: string;
  sourceApp: string;
  mimeType: string;
  captureMethod: 'chrome_dom' | 'chrome_api';
  contentHash: string;
  redactedContent: string | null;
  featureBundle: {
    topicVectors: number[];
    entityCounts: Record<string, number>;
    keyPhrases: string[];
    language: string;
    wordCount: number;
    sectionHeaders: string[];
  };
  metadata: Record<string, unknown>;
  tags: string[];
  customerFacing: boolean;
  sensitivity: string;
}

export interface PRReviewPayload {
  action: 'approve' | 'reject' | 'request_changes';
  comment?: string;
}

export interface AgentTogglePayload {
  status: 'active' | 'paused';
}

export interface YoloTogglePayload {
  enabled: boolean;
}

// ---- Constants -------------------------------------------------------------

const API_BASE = process.env.NODE_ENV === 'production'
  ? 'https://api.lurk.dev/v1'
  : 'http://localhost:3001/v1';

// ---- HTTP Client -----------------------------------------------------------

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options?: { timeout?: number }
): Promise<APIResult<T>> {
  const token = await auth.getToken();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options?.timeout ?? 15000);

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      return {
        data: null,
        error: {
          code: errorBody.code ?? 'UNKNOWN',
          message: errorBody.message ?? response.statusText,
          status: response.status,
        },
      };
    }

    const data = await response.json();
    return { data, error: null };
  } catch (err) {
    clearTimeout(timeoutId);

    if (err instanceof DOMException && err.name === 'AbortError') {
      return {
        data: null,
        error: { code: 'TIMEOUT', message: 'Request timed out', status: 408 },
      };
    }

    return {
      data: null,
      error: {
        code: 'NETWORK_ERROR',
        message: err instanceof Error ? err.message : 'Network request failed',
        status: 0,
      },
    };
  }
}

// ---- API Client ------------------------------------------------------------

export const api = {
  // Artifacts
  async captureArtifact(capture: ArtifactCapture) {
    return request<{ id: string; version: number }>('POST', '/artifacts/capture', capture);
  },

  async getArtifacts(params?: { type?: string; page?: number; pageSize?: number }) {
    const query = new URLSearchParams();
    if (params?.type) query.set('type', params.type);
    if (params?.page) query.set('page', String(params.page));
    if (params?.pageSize) query.set('pageSize', String(params.pageSize));
    const qs = query.toString();
    return request<PaginatedResponse<unknown>>('GET', `/artifacts${qs ? `?${qs}` : ''}`);
  },

  async getArtifact(id: string) {
    return request<unknown>('GET', `/artifacts/${id}`);
  },

  async getArtifactVersions(id: string) {
    return request<unknown[]>('GET', `/artifacts/${id}/versions`);
  },

  // Pull Requests
  async getPendingPRs() {
    return request<PaginatedResponse<unknown>>('GET', '/pull-requests?status=open');
  },

  async reviewPR(prId: string, review: PRReviewPayload) {
    return request<{ success: boolean }>('POST', `/pull-requests/${prId}/review`, review);
  },

  async getPRDiff(prId: string) {
    return request<unknown>('GET', `/pull-requests/${prId}/diff`);
  },

  // Agents
  async getAgents() {
    return request<unknown[]>('GET', '/agents');
  },

  async toggleAgent(agentId: string, payload: AgentTogglePayload) {
    return request<{ success: boolean }>('PATCH', `/agents/${agentId}/status`, payload);
  },

  async getAgentActions(agentId?: string, limit = 50) {
    const path = agentId
      ? `/agents/${agentId}/actions?limit=${limit}`
      : `/agent-actions?limit=${limit}`;
    return request<unknown[]>('GET', path);
  },

  // YOLO Mode
  async getYoloConfig() {
    return request<unknown>('GET', '/settings/yolo');
  },

  async toggleYolo(payload: YoloTogglePayload) {
    return request<{ success: boolean }>('PATCH', '/settings/yolo', payload);
  },

  // Privacy
  async getPrivacyStats() {
    return request<unknown>('GET', '/privacy/stats');
  },

  async setLocalOnlyMode(enabled: boolean) {
    return request<{ success: boolean }>('PATCH', '/settings/privacy', { localOnly: enabled });
  },

  // User
  async getCurrentUser() {
    return request<unknown>('GET', '/users/me');
  },

  async getUserOrg() {
    return request<unknown>('GET', '/users/me/org');
  },

  // Health check
  async ping() {
    return request<{ status: string }>('GET', '/health');
  },
};
