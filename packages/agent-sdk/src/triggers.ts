// ---------------------------------------------------------------------------
// TriggerManager — registers and evaluates agent triggers
// ---------------------------------------------------------------------------

import type { TriggerConfig, TriggerType } from '@lurk/shared-types';

// ---- TriggerEvent ----------------------------------------------------------

/**
 * An event that may activate one or more agent triggers.
 */
export interface TriggerEvent {
  /** The type of event that occurred. */
  type: TriggerType;
  /** Unique identifier for this event instance. */
  eventId: string;
  /** When the event occurred (ISO-8601). */
  timestamp: string;
  /** Event-specific payload (matches TriggerConfig.filter shape). */
  payload: Record<string, unknown>;
  /** The artifact ID related to this event, if any. */
  artifactId?: string;
  /** The ledger ID related to this event, if any. */
  ledgerId?: string;
  /** The org ID where the event occurred. */
  orgId: string;
}

// ---- Trigger handler type --------------------------------------------------

export type TriggerHandler = (event: TriggerEvent) => void | Promise<void>;

// ---- Registered trigger entry -----------------------------------------------

interface RegisteredTrigger {
  config: TriggerConfig;
  handler: TriggerHandler;
  /** Timestamp of last invocation (for debounce). */
  lastFiredAt: number;
}

// ---- TriggerManager --------------------------------------------------------

export class TriggerManager {
  private triggers: RegisteredTrigger[] = [];

  /**
   * Register a trigger configuration with its handler function.
   */
  register(trigger: TriggerConfig, handler: TriggerHandler): void {
    this.triggers.push({
      config: trigger,
      handler,
      lastFiredAt: 0,
    });
  }

  /**
   * Evaluate an incoming event against all registered triggers.
   * Returns true if at least one trigger matched and fired.
   */
  evaluate(event: TriggerEvent): boolean {
    let anyFired = false;
    const now = Date.now();

    for (const entry of this.triggers) {
      if (!entry.config.enabled) continue;
      if (!this.matchesTrigger(event, entry.config)) continue;

      // Debounce check
      const elapsed = now - entry.lastFiredAt;
      if (elapsed < entry.config.debounceMs) continue;

      entry.lastFiredAt = now;
      entry.handler(event);
      anyFired = true;
    }

    return anyFired;
  }

  /**
   * Check whether an event matches a specific trigger configuration.
   */
  matchesTrigger(event: TriggerEvent, config: TriggerConfig): boolean {
    // Type must match
    if (event.type !== config.type) {
      return false;
    }

    // Filter matching: every key in the config filter must match
    // the corresponding key in the event payload
    for (const [key, value] of Object.entries(config.filter)) {
      const eventValue = event.payload[key];

      // Array filter: event value must be included in the filter array
      if (Array.isArray(value)) {
        if (!value.includes(eventValue)) {
          return false;
        }
        continue;
      }

      // Glob/wildcard string filter
      if (typeof value === 'string' && value.includes('*')) {
        const regex = new RegExp(
          '^' + value.replace(/\*/g, '.*') + '$',
        );
        if (typeof eventValue !== 'string' || !regex.test(eventValue)) {
          return false;
        }
        continue;
      }

      // Strict equality
      if (eventValue !== value) {
        return false;
      }
    }

    return true;
  }

  /**
   * Remove all registered triggers.
   */
  clear(): void {
    this.triggers = [];
  }

  /**
   * Return the number of registered triggers.
   */
  get size(): number {
    return this.triggers.length;
  }
}
