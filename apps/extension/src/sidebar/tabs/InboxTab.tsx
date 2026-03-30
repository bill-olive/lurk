import React, { useState, useEffect, useCallback } from 'react';
import { clsx } from 'clsx';
import { Inbox, RefreshCw, Zap, Filter } from 'lucide-react';
import { PRCard, type PRCardData } from '../components/PRCard';

// ---- Component -------------------------------------------------------------

export function InboxTab() {
  const [prs, setPrs] = useState<PRCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'yolo'>('all');

  const fetchPRs = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      // Fetch from background script which handles standalone vs. connected mode
      const response = await sendMessage<{ data?: { items?: PRCardData[] } }>({
        type: 'LURK_GET_PENDING_PRS',
      });

      if (response?.data?.items) {
        setPrs(response.data.items);
      } else {
        // Fallback: try to get from local storage
        const localResponse = await sendMessage<PRCardData[]>({
          type: 'LURK_GET_LOCAL_PRS',
        });
        if (Array.isArray(localResponse)) {
          setPrs(localResponse);
        }
      }
    } catch (err) {
      console.error('[InboxTab] Failed to fetch PRs:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchPRs();

    // Listen for new PR notifications
    const handleMessage = (message: { type: string; payload?: unknown }) => {
      if (message.type === 'LURK_NEW_PR') {
        fetchPRs();
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, [fetchPRs]);

  const handleApprove = async (prId: string) => {
    setReviewingId(prId);
    try {
      await sendMessage({
        type: 'LURK_REVIEW_PR',
        payload: { prId, action: 'approve' },
      });
      setPrs((prev) => prev.filter((pr) => pr.id !== prId));
    } catch (err) {
      console.error('[InboxTab] Failed to approve PR:', err);
    } finally {
      setReviewingId(null);
    }
  };

  const handleReject = async (prId: string) => {
    setReviewingId(prId);
    try {
      await sendMessage({
        type: 'LURK_REVIEW_PR',
        payload: { prId, action: 'reject' },
      });
      setPrs((prev) => prev.filter((pr) => pr.id !== prId));
    } catch (err) {
      console.error('[InboxTab] Failed to reject PR:', err);
    } finally {
      setReviewingId(null);
    }
  };

  const filteredPRs = filter === 'yolo'
    ? prs.filter((pr) => pr.autoMergeEligible)
    : prs;

  const yoloCount = prs.filter((pr) => pr.autoMergeEligible).length;

  // ---- Render ----------------------------------------------------------------

  if (loading) {
    return (
      <div className="p-3 space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="lurk-card">
            <div className="lurk-skeleton h-4 w-3/4 mb-2" />
            <div className="lurk-skeleton h-3 w-1/2 mb-1" />
            <div className="lurk-skeleton h-3 w-1/3" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-surface-300">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setFilter('all')}
            className={clsx(
              'lurk-btn-ghost text-2xs px-2 py-1 rounded',
              filter === 'all' && 'bg-white/5 text-white/80'
            )}
          >
            All ({prs.length})
          </button>
          {yoloCount > 0 && (
            <button
              onClick={() => setFilter('yolo')}
              className={clsx(
                'lurk-btn-ghost text-2xs px-2 py-1 rounded flex items-center gap-1',
                filter === 'yolo' && 'bg-accent-yellow/10 text-accent-yellow'
              )}
            >
              <Zap size={10} />
              YOLO ({yoloCount})
            </button>
          )}
        </div>
        <button
          onClick={() => fetchPRs(true)}
          disabled={refreshing}
          className={clsx(
            'lurk-btn-ghost p-1 rounded',
            refreshing && 'animate-spin'
          )}
        >
          <RefreshCw size={13} />
        </button>
      </div>

      {/* PR List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filteredPRs.length === 0 ? (
          <EmptyState filter={filter} />
        ) : (
          filteredPRs.map((pr) => (
            <PRCard
              key={pr.id}
              pr={pr}
              onApprove={handleApprove}
              onReject={handleReject}
              isReviewing={reviewingId === pr.id}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ---- Empty State -----------------------------------------------------------

function EmptyState({ filter }: { filter: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-10 h-10 rounded-full bg-surface-200 flex items-center justify-center mb-3">
        {filter === 'yolo' ? (
          <Zap size={18} className="text-accent-yellow/40" />
        ) : (
          <Inbox size={18} className="text-white/20" />
        )}
      </div>
      <p className="text-sm text-white/40 font-medium">
        {filter === 'yolo' ? 'No YOLO-eligible PRs' : 'No pending PRs'}
      </p>
      <p className="text-2xs text-white/25 mt-1 max-w-[200px]">
        {filter === 'yolo'
          ? 'PRs meeting your YOLO criteria will appear here'
          : 'Agent proposals awaiting your review will appear here'}
      </p>
    </div>
  );
}

// ---- Helpers ---------------------------------------------------------------

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
