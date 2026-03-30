import React, { useState, useEffect, useCallback } from 'react';
import { clsx } from 'clsx';
import {
  Search,
  Filter,
  RefreshCw,
  ChevronDown,
  Clock,
  X,
} from 'lucide-react';
import { ArtifactCard, type ArtifactCardData } from '../components/ArtifactCard';

// ---- Types -----------------------------------------------------------------

const ARTIFACT_TYPE_CATEGORIES = [
  { value: '', label: 'All Types' },
  { value: 'document', label: 'Documents' },
  { value: 'code', label: 'Code' },
  { value: 'comm', label: 'Communications' },
  { value: 'data', label: 'Data' },
  { value: 'design', label: 'Design' },
  { value: 'meta', label: 'Meta' },
];

interface VersionEntry {
  version: number;
  commitMessage: string;
  authorType: string;
  timestamp: number;
}

// ---- Component -------------------------------------------------------------

export function LedgerTab() {
  const [artifacts, setArtifacts] = useState<ArtifactCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedArtifact, setSelectedArtifact] = useState<ArtifactCardData | null>(null);
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);

  const fetchArtifacts = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const response = await sendMessage<
        ArtifactCardData[] | { data?: { items?: ArtifactCardData[] } }
      >({
        type: 'LURK_GET_ARTIFACTS',
        payload: { type: typeFilter || undefined, limit: 50 },
      });

      if (Array.isArray(response)) {
        setArtifacts(response);
      } else if (response?.data?.items) {
        setArtifacts(response.data.items);
      }
    } catch (err) {
      console.error('[LedgerTab] Failed to fetch artifacts:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [typeFilter]);

  useEffect(() => {
    fetchArtifacts();
  }, [fetchArtifacts]);

  const handleArtifactClick = async (artifact: ArtifactCardData) => {
    setSelectedArtifact(artifact);
    setLoadingVersions(true);

    try {
      const response = await sendMessage<VersionEntry[] | { data?: VersionEntry[] }>({
        type: 'LURK_GET_ARTIFACT_VERSIONS',
        payload: { artifactId: artifact.id },
      });

      if (Array.isArray(response)) {
        setVersions(response);
      } else if (response?.data && Array.isArray(response.data)) {
        setVersions(response.data);
      }
    } catch {
      setVersions([]);
    } finally {
      setLoadingVersions(false);
    }
  };

  // Filter artifacts by search query
  const filteredArtifacts = artifacts.filter((a) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      a.title.toLowerCase().includes(q) ||
      a.type.toLowerCase().includes(q) ||
      a.tags.some((t) => t.toLowerCase().includes(q))
    );
  });

  if (loading) {
    return (
      <div className="p-3 space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="lurk-card">
            <div className="lurk-skeleton h-4 w-3/4 mb-2" />
            <div className="lurk-skeleton h-3 w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  // ---- Detail View -----------------------------------------------------------

  if (selectedArtifact) {
    return (
      <div className="flex flex-col h-full">
        {/* Detail Header */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-surface-300">
          <button
            onClick={() => setSelectedArtifact(null)}
            className="lurk-btn-ghost p-1 rounded"
          >
            <X size={13} />
          </button>
          <span className="text-xs font-medium text-white/80 truncate">
            {selectedArtifact.title}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          <ArtifactCard artifact={selectedArtifact} />

          {/* Version History */}
          <div>
            <h3 className="text-xs font-medium text-white/60 mb-2 flex items-center gap-1.5">
              <Clock size={12} />
              Version History
            </h3>

            {loadingVersions ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="lurk-skeleton h-10 w-full" />
                ))}
              </div>
            ) : versions.length === 0 ? (
              <p className="text-2xs text-white/30">No version history available</p>
            ) : (
              <div className="space-y-1">
                {versions.map((version) => (
                  <div
                    key={version.version}
                    className="flex items-start gap-2 px-2 py-1.5 rounded hover:bg-surface-200 transition-colors"
                  >
                    <div className="flex flex-col items-center flex-shrink-0">
                      <div className="w-2 h-2 rounded-full bg-lurk-500 mt-1" />
                      <div className="w-px h-full bg-surface-300" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-2xs font-mono text-lurk-400">
                          v{version.version}
                        </span>
                        <span className="text-2xs text-white/30">
                          {version.authorType === 'agent' ? 'Agent' : 'You'}
                        </span>
                        <span className="text-2xs text-white/20">
                          {formatTimeAgo(version.timestamp)}
                        </span>
                      </div>
                      <p className="text-2xs text-white/50 truncate">
                        {version.commitMessage}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ---- List View -------------------------------------------------------------

  return (
    <div className="flex flex-col h-full">
      {/* Search + Filters */}
      <div className="px-3 py-2 border-b border-surface-300 space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search artifacts..."
              className="lurk-input pl-7 text-xs py-1"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
              >
                <X size={11} />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={clsx(
              'lurk-btn-ghost p-1.5 rounded',
              showFilters && 'bg-white/5'
            )}
          >
            <Filter size={13} />
          </button>
          <button
            onClick={() => fetchArtifacts(true)}
            disabled={refreshing}
            className={clsx(
              'lurk-btn-ghost p-1.5 rounded',
              refreshing && 'animate-spin'
            )}
          >
            <RefreshCw size={13} />
          </button>
        </div>

        {showFilters && (
          <div className="flex items-center gap-1 flex-wrap animate-slide-in">
            {ARTIFACT_TYPE_CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setTypeFilter(cat.value)}
                className={clsx(
                  'text-2xs px-2 py-0.5 rounded-full border transition-colors',
                  typeFilter === cat.value
                    ? 'border-lurk-500 bg-lurk-600/15 text-lurk-400'
                    : 'border-surface-400 text-white/40 hover:text-white/60'
                )}
              >
                {cat.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Artifact List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filteredArtifacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm text-white/40">
              {searchQuery ? 'No matching artifacts' : 'No artifacts captured yet'}
            </p>
            <p className="text-2xs text-white/25 mt-1">
              {searchQuery
                ? 'Try a different search query'
                : 'Visit a supported site to start capturing'}
            </p>
          </div>
        ) : (
          filteredArtifacts.map((artifact) => (
            <ArtifactCard
              key={artifact.id}
              artifact={artifact}
              onClick={handleArtifactClick}
            />
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-1.5 border-t border-surface-300 bg-surface-50">
        <span className="text-2xs text-white/30">
          {filteredArtifacts.length} artifact{filteredArtifacts.length !== 1 ? 's' : ''}
          {typeFilter && ` (${typeFilter})`}
        </span>
      </div>
    </div>
  );
}

// ---- Helpers ---------------------------------------------------------------

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return new Date(timestamp).toLocaleDateString();
}

function sendMessage<T>(message: { type: string; payload?: unknown }): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response as T);
      }
    });
  });
}
