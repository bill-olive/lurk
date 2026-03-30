// ---------------------------------------------------------------------------
// Storage — Chrome storage API wrapper + IndexedDB fallback for standalone
// ---------------------------------------------------------------------------

import { openDB, type IDBPDatabase } from 'idb';

// ---- Types -----------------------------------------------------------------

export interface StoredArtifact {
  id: string;
  type: string;
  title: string;
  sourceUrl: string;
  sourceApp: string;
  contentHash: string;
  redactedContent: string | null;
  capturedAt: number;
  modifiedAt: number;
  sensitivity: string;
  tags: string[];
  metadata: Record<string, unknown>;
}

export interface StoredPR {
  id: string;
  title: string;
  description: string;
  agentId: string;
  agentName: string;
  agentType: string;
  artifactId: string;
  artifactTitle: string;
  confidence: number;
  status: string;
  diff: unknown;
  changeSummary: string;
  createdAt: number;
  updatedAt: number;
  autoMergeEligible: boolean;
}

export interface StoredAgentAction {
  id: string;
  agentId: string;
  agentName: string;
  agentType: string;
  action: string;
  description: string;
  artifactId: string | null;
  artifactTitle: string | null;
  timestamp: number;
}

export interface PrivacyRecord {
  id: string;
  artifactId: string;
  destination: 'cloud' | 'native_host' | 'local_only';
  dataType: string;
  redacted: boolean;
  piiDetected: string[];
  timestamp: number;
}

// ---- IndexedDB (standalone mode) -------------------------------------------

const DB_NAME = 'lurk-extension';
const DB_VERSION = 1;

let dbInstance: IDBPDatabase | null = null;

async function getDB(): Promise<IDBPDatabase> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Artifacts store
      if (!db.objectStoreNames.contains('artifacts')) {
        const artifactStore = db.createObjectStore('artifacts', { keyPath: 'id' });
        artifactStore.createIndex('by-type', 'type');
        artifactStore.createIndex('by-captured', 'capturedAt');
        artifactStore.createIndex('by-source', 'sourceUrl');
      }

      // Pull requests store
      if (!db.objectStoreNames.contains('pullRequests')) {
        const prStore = db.createObjectStore('pullRequests', { keyPath: 'id' });
        prStore.createIndex('by-status', 'status');
        prStore.createIndex('by-created', 'createdAt');
      }

      // Agent actions store
      if (!db.objectStoreNames.contains('agentActions')) {
        const actionStore = db.createObjectStore('agentActions', { keyPath: 'id' });
        actionStore.createIndex('by-agent', 'agentId');
        actionStore.createIndex('by-timestamp', 'timestamp');
      }

      // Privacy records store
      if (!db.objectStoreNames.contains('privacyRecords')) {
        const privacyStore = db.createObjectStore('privacyRecords', { keyPath: 'id' });
        privacyStore.createIndex('by-destination', 'destination');
        privacyStore.createIndex('by-timestamp', 'timestamp');
      }

      // Key-value settings store
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    },
  });

  return dbInstance;
}

// ---- Chrome Storage wrapper ------------------------------------------------

export const chromeStorage = {
  async get<T>(key: string): Promise<T | null> {
    return new Promise((resolve) => {
      chrome.storage.local.get(key, (result) => {
        resolve(result[key] ?? null);
      });
    });
  },

  async set<T>(key: string, value: T): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [key]: value }, resolve);
    });
  },

  async remove(key: string): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.remove(key, resolve);
    });
  },

  async getAll(): Promise<Record<string, unknown>> {
    return new Promise((resolve) => {
      chrome.storage.local.get(null, resolve);
    });
  },

  onChanged(callback: (changes: Record<string, chrome.storage.StorageChange>) => void) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local') {
        callback(changes);
      }
    });
  },
};

// ---- IndexedDB wrapper for standalone mode ---------------------------------

export const localDB = {
  // Artifacts
  async putArtifact(artifact: StoredArtifact): Promise<void> {
    const db = await getDB();
    await db.put('artifacts', artifact);
  },

  async getArtifact(id: string): Promise<StoredArtifact | undefined> {
    const db = await getDB();
    return db.get('artifacts', id);
  },

  async getArtifacts(options?: {
    type?: string;
    limit?: number;
    offset?: number;
  }): Promise<StoredArtifact[]> {
    const db = await getDB();
    const tx = db.transaction('artifacts', 'readonly');
    const store = tx.objectStore('artifacts');

    let results: StoredArtifact[];

    if (options?.type) {
      const index = store.index('by-type');
      results = await index.getAll(options.type);
    } else {
      results = await store.getAll();
    }

    // Sort by capturedAt descending
    results.sort((a, b) => b.capturedAt - a.capturedAt);

    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? 50;
    return results.slice(offset, offset + limit);
  },

  async deleteArtifact(id: string): Promise<void> {
    const db = await getDB();
    await db.delete('artifacts', id);
  },

  async getArtifactCount(): Promise<number> {
    const db = await getDB();
    return db.count('artifacts');
  },

  // Pull Requests
  async putPR(pr: StoredPR): Promise<void> {
    const db = await getDB();
    await db.put('pullRequests', pr);
  },

  async getPR(id: string): Promise<StoredPR | undefined> {
    const db = await getDB();
    return db.get('pullRequests', id);
  },

  async getPRsByStatus(status: string): Promise<StoredPR[]> {
    const db = await getDB();
    const tx = db.transaction('pullRequests', 'readonly');
    const index = tx.objectStore('pullRequests').index('by-status');
    const results = await index.getAll(status);
    return results.sort((a, b) => b.createdAt - a.createdAt);
  },

  async getAllPRs(limit = 50): Promise<StoredPR[]> {
    const db = await getDB();
    const results = await db.getAll('pullRequests');
    results.sort((a, b) => b.createdAt - a.createdAt);
    return results.slice(0, limit);
  },

  // Agent Actions
  async putAgentAction(action: StoredAgentAction): Promise<void> {
    const db = await getDB();
    await db.put('agentActions', action);
  },

  async getAgentActions(limit = 50): Promise<StoredAgentAction[]> {
    const db = await getDB();
    const results = await db.getAll('agentActions');
    results.sort((a, b) => b.timestamp - a.timestamp);
    return results.slice(0, limit);
  },

  // Privacy Records
  async putPrivacyRecord(record: PrivacyRecord): Promise<void> {
    const db = await getDB();
    await db.put('privacyRecords', record);
  },

  async getPrivacyRecords(limit = 100): Promise<PrivacyRecord[]> {
    const db = await getDB();
    const results = await db.getAll('privacyRecords');
    results.sort((a, b) => b.timestamp - a.timestamp);
    return results.slice(0, limit);
  },

  async getPrivacyStats(): Promise<{
    totalSent: number;
    cloudSent: number;
    localOnly: number;
    piiDetected: number;
    redacted: number;
  }> {
    const db = await getDB();
    const records = await db.getAll('privacyRecords');
    return {
      totalSent: records.length,
      cloudSent: records.filter((r: PrivacyRecord) => r.destination === 'cloud').length,
      localOnly: records.filter((r: PrivacyRecord) => r.destination === 'local_only').length,
      piiDetected: records.filter((r: PrivacyRecord) => r.piiDetected.length > 0).length,
      redacted: records.filter((r: PrivacyRecord) => r.redacted).length,
    };
  },

  // Settings
  async getSetting<T>(key: string): Promise<T | undefined> {
    const db = await getDB();
    const record = await db.get('settings', key);
    return record?.value;
  },

  async setSetting<T>(key: string, value: T): Promise<void> {
    const db = await getDB();
    await db.put('settings', { key, value });
  },
};

// ---- Unified storage interface ---------------------------------------------

export class LurkStorage {
  private standaloneMode = false;

  setStandaloneMode(enabled: boolean) {
    this.standaloneMode = enabled;
  }

  isStandalone(): boolean {
    return this.standaloneMode;
  }

  async getSetting<T>(key: string): Promise<T | null> {
    if (this.standaloneMode) {
      return (await localDB.getSetting<T>(key)) ?? null;
    }
    return chromeStorage.get<T>(key);
  }

  async setSetting<T>(key: string, value: T): Promise<void> {
    if (this.standaloneMode) {
      await localDB.setSetting(key, value);
    } else {
      await chromeStorage.set(key, value);
    }
  }

  async storeArtifact(artifact: StoredArtifact): Promise<void> {
    await localDB.putArtifact(artifact);
  }

  async getArtifacts(options?: { type?: string; limit?: number; offset?: number }) {
    return localDB.getArtifacts(options);
  }

  async storePR(pr: StoredPR): Promise<void> {
    await localDB.putPR(pr);
  }

  async getPendingPRs(): Promise<StoredPR[]> {
    return localDB.getPRsByStatus('open');
  }

  async storeAgentAction(action: StoredAgentAction): Promise<void> {
    await localDB.putAgentAction(action);
  }

  async getAgentActions(limit?: number): Promise<StoredAgentAction[]> {
    return localDB.getAgentActions(limit);
  }

  async storePrivacyRecord(record: PrivacyRecord): Promise<void> {
    await localDB.putPrivacyRecord(record);
  }

  async getPrivacyStats() {
    return localDB.getPrivacyStats();
  }
}

export const storage = new LurkStorage();
