import React, { useState, useEffect, useCallback } from 'react';
import { clsx } from 'clsx';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Eye,
  EyeOff,
  Cloud,
  HardDrive,
  RefreshCw,
  Lock,
  Fingerprint,
  ArrowUpFromLine,
  Info,
} from 'lucide-react';

// ---- Types -----------------------------------------------------------------

interface PrivacyStats {
  totalSent: number;
  cloudSent: number;
  localOnly: number;
  piiDetected: number;
  redacted: number;
}

interface PrivacyConfig {
  localOnly: boolean;
  redactionLevel: 'aggressive' | 'standard' | 'minimal' | 'none';
  piiDetectionEnabled: boolean;
}

// ---- Component -------------------------------------------------------------

export function PrivacyTab() {
  const [stats, setStats] = useState<PrivacyStats>({
    totalSent: 0,
    cloudSent: 0,
    localOnly: 0,
    piiDetected: 0,
    redacted: 0,
  });
  const [config, setConfig] = useState<PrivacyConfig>({
    localOnly: false,
    redactionLevel: 'standard',
    piiDetectionEnabled: true,
  });
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  const fetchPrivacyData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsResponse, configResponse] = await Promise.all([
        sendMessage<PrivacyStats | { data?: PrivacyStats }>({
          type: 'LURK_GET_PRIVACY_STATS',
        }),
        sendMessage<PrivacyConfig | { data?: PrivacyConfig }>({
          type: 'LURK_GET_PRIVACY_CONFIG',
        }),
      ]);

      if (statsResponse && 'totalSent' in statsResponse) {
        setStats(statsResponse);
      } else if (statsResponse && 'data' in statsResponse && statsResponse.data) {
        setStats(statsResponse.data);
      }

      if (configResponse && 'localOnly' in configResponse) {
        setConfig(configResponse);
      } else if (configResponse && 'data' in configResponse && configResponse.data) {
        setConfig(configResponse.data);
      }
    } catch (err) {
      console.error('[PrivacyTab] Failed to fetch privacy data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrivacyData();
  }, [fetchPrivacyData]);

  const handleToggleLocalOnly = async () => {
    setToggling(true);
    const newValue = !config.localOnly;
    try {
      await sendMessage({
        type: 'LURK_SET_LOCAL_ONLY',
        payload: { enabled: newValue },
      });
      setConfig((prev) => ({ ...prev, localOnly: newValue }));
    } catch (err) {
      console.error('[PrivacyTab] Failed to toggle local-only:', err);
    } finally {
      setToggling(false);
    }
  };

  if (loading) {
    return (
      <div className="p-3 space-y-3">
        <div className="lurk-skeleton h-20 w-full" />
        <div className="lurk-skeleton h-32 w-full" />
        <div className="lurk-skeleton h-24 w-full" />
      </div>
    );
  }

  const cloudPercent = stats.totalSent > 0
    ? Math.round((stats.cloudSent / stats.totalSent) * 100)
    : 0;
  const redactedPercent = stats.piiDetected > 0
    ? Math.round((stats.redacted / stats.piiDetected) * 100)
    : 100;

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Privacy Score */}
      <div className="px-3 py-3 border-b border-surface-300">
        <div className="flex items-center gap-3">
          <div className={clsx(
            'w-10 h-10 rounded-xl flex items-center justify-center',
            config.localOnly
              ? 'bg-accent-green/15'
              : redactedPercent >= 90
                ? 'bg-accent-green/15'
                : redactedPercent >= 50
                  ? 'bg-accent-yellow/15'
                  : 'bg-accent-red/15'
          )}>
            {config.localOnly ? (
              <ShieldCheck size={20} className="text-accent-green" />
            ) : redactedPercent >= 90 ? (
              <Shield size={20} className="text-accent-green" />
            ) : (
              <ShieldAlert size={20} className="text-accent-yellow" />
            )}
          </div>
          <div>
            <h3 className="text-sm font-medium text-white">Privacy Status</h3>
            <p className="text-2xs text-white/40">
              {config.localOnly
                ? 'All data stays on your device'
                : `${redactedPercent}% of PII detected was redacted`}
            </p>
          </div>
        </div>
      </div>

      {/* Local-Only Mode Toggle */}
      <div className="px-3 py-3 border-b border-surface-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <HardDrive size={15} className={config.localOnly ? 'text-accent-green' : 'text-white/40'} />
            <div>
              <span className="text-sm font-medium text-white">Local-Only Mode</span>
              <p className="text-2xs text-white/40 mt-0.5">
                Keep all data on-device. No cloud sync.
              </p>
            </div>
          </div>
          <button
            onClick={handleToggleLocalOnly}
            disabled={toggling}
            className={clsx(
              'lurk-toggle',
              config.localOnly ? 'lurk-toggle-on' : 'lurk-toggle-off',
              toggling && 'opacity-50'
            )}
          >
            <span
              className={clsx(
                'lurk-toggle-thumb',
                config.localOnly ? 'lurk-toggle-thumb-on' : 'lurk-toggle-thumb-off'
              )}
            />
          </button>
        </div>
      </div>

      {/* Data Flow Summary */}
      <div className="px-3 py-3 border-b border-surface-300">
        <h3 className="text-xs font-medium text-white/60 mb-3 flex items-center gap-1.5">
          <ArrowUpFromLine size={12} />
          Data Flow Summary
        </h3>

        <div className="grid grid-cols-2 gap-2">
          <StatCard
            icon={Cloud}
            label="Cloud Synced"
            value={String(stats.cloudSent)}
            color="text-accent-blue"
            bgColor="bg-accent-blue/10"
          />
          <StatCard
            icon={HardDrive}
            label="Local Only"
            value={String(stats.localOnly)}
            color="text-accent-green"
            bgColor="bg-accent-green/10"
          />
          <StatCard
            icon={Fingerprint}
            label="PII Detected"
            value={String(stats.piiDetected)}
            color="text-accent-yellow"
            bgColor="bg-accent-yellow/10"
          />
          <StatCard
            icon={Lock}
            label="Redacted"
            value={String(stats.redacted)}
            color="text-accent-purple"
            bgColor="bg-accent-purple/10"
          />
        </div>

        {stats.totalSent > 0 && (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-2xs text-white/40">Data distribution</span>
              <span className="text-2xs text-white/30">
                {stats.totalSent} total artifacts
              </span>
            </div>
            <div className="h-2 bg-surface-300 rounded-full overflow-hidden flex">
              <div
                className="h-full bg-accent-blue transition-all"
                style={{ width: `${cloudPercent}%` }}
              />
              <div
                className="h-full bg-accent-green transition-all"
                style={{ width: `${100 - cloudPercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-1">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-accent-blue" />
                <span className="text-2xs text-white/30">Cloud ({cloudPercent}%)</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-accent-green" />
                <span className="text-2xs text-white/30">Local ({100 - cloudPercent}%)</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Redaction Level */}
      <div className="px-3 py-3 border-b border-surface-300">
        <h3 className="text-xs font-medium text-white/60 mb-2 flex items-center gap-1.5">
          <Eye size={12} />
          Redaction Level
        </h3>

        <div className="space-y-1">
          {(['aggressive', 'standard', 'minimal', 'none'] as const).map((level) => (
            <RedactionOption
              key={level}
              level={level}
              current={config.redactionLevel}
              onChange={(level) => setConfig((prev) => ({ ...prev, redactionLevel: level }))}
            />
          ))}
        </div>
      </div>

      {/* PII Detection */}
      <div className="px-3 py-3 border-b border-surface-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Fingerprint size={15} className={config.piiDetectionEnabled ? 'text-lurk-400' : 'text-white/40'} />
            <div>
              <span className="text-sm font-medium text-white">PII Detection</span>
              <p className="text-2xs text-white/40 mt-0.5">
                On-device scanning (WASM)
              </p>
            </div>
          </div>
          <span className={clsx(
            'lurk-badge',
            config.piiDetectionEnabled ? 'lurk-badge-green' : 'lurk-badge-gray'
          )}>
            {config.piiDetectionEnabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>

        {config.piiDetectionEnabled && stats.piiDetected > 0 && (
          <div className="mt-2 bg-surface-100 rounded-md p-2 animate-slide-in">
            <div className="flex items-start gap-1.5">
              <Info size={10} className="text-white/30 mt-0.5 flex-shrink-0" />
              <p className="text-2xs text-white/40">
                Detected {stats.piiDetected} PII instance{stats.piiDetected !== 1 ? 's' : ''} across captured artifacts.
                {stats.redacted > 0 && ` ${stats.redacted} were automatically redacted.`}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-3">
        <p className="text-2xs text-white/20 text-center">
          Raw content never leaves your device unless redaction is applied.
          All PII detection runs on-device.
        </p>
      </div>
    </div>
  );
}

// ---- Sub-components --------------------------------------------------------

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  bgColor,
}: {
  icon: React.FC<{ size?: number; className?: string }>;
  label: string;
  value: string;
  color: string;
  bgColor: string;
}) {
  return (
    <div className="lurk-card flex items-center gap-2.5 p-2.5">
      <div className={clsx('w-7 h-7 rounded-md flex items-center justify-center', bgColor)}>
        <Icon size={13} className={color} />
      </div>
      <div>
        <p className="text-sm font-semibold text-white font-mono">{value}</p>
        <p className="text-2xs text-white/40">{label}</p>
      </div>
    </div>
  );
}

function RedactionOption({
  level,
  current,
  onChange,
}: {
  level: 'aggressive' | 'standard' | 'minimal' | 'none';
  current: string;
  onChange: (level: 'aggressive' | 'standard' | 'minimal' | 'none') => void;
}) {
  const isActive = current === level;

  const descriptions: Record<string, string> = {
    aggressive: 'Strip all detected entities, names, identifiers',
    standard: 'Redact PII (emails, phones, SSN, addresses)',
    minimal: 'Only redact high-confidence PII matches',
    none: 'No redaction (not recommended)',
  };

  const icons: Record<string, React.FC<{ size?: number; className?: string }>> = {
    aggressive: EyeOff,
    standard: Shield,
    minimal: Eye,
    none: Eye,
  };

  const Icon = icons[level] ?? Shield;

  return (
    <button
      onClick={() => onChange(level)}
      className={clsx(
        'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md border transition-colors text-left',
        isActive
          ? 'border-lurk-500 bg-lurk-600/10'
          : 'border-transparent hover:bg-surface-200'
      )}
    >
      <Icon
        size={12}
        className={isActive ? 'text-lurk-400' : 'text-white/30'}
      />
      <div>
        <span className={clsx(
          'text-xs font-medium capitalize',
          isActive ? 'text-lurk-400' : 'text-white/60'
        )}>
          {level}
        </span>
        <p className="text-2xs text-white/30">{descriptions[level]}</p>
      </div>
      {isActive && (
        <div className="ml-auto w-2 h-2 rounded-full bg-lurk-400 flex-shrink-0" />
      )}
    </button>
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
