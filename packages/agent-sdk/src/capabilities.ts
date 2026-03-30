// ---------------------------------------------------------------------------
// CapabilityRegistry — registers and executes agent capabilities
// ---------------------------------------------------------------------------

import type { AgentCapability } from '@lurk/shared-types';

// ---- Capability handler type -----------------------------------------------

export type CapabilityHandler = (args: Record<string, unknown>) => Promise<unknown>;

// ---- CapabilityRegistry ----------------------------------------------------

export class CapabilityRegistry {
  private handlers = new Map<AgentCapability, CapabilityHandler>();

  /**
   * Register a capability with its handler function.
   * Throws if the capability is already registered.
   */
  register(capability: AgentCapability, handler: CapabilityHandler): void {
    if (this.handlers.has(capability)) {
      throw new Error(
        `Capability "${capability}" is already registered. Unregister it first.`,
      );
    }
    this.handlers.set(capability, handler);
  }

  /**
   * Unregister a previously registered capability.
   */
  unregister(capability: AgentCapability): boolean {
    return this.handlers.delete(capability);
  }

  /**
   * Check whether a capability is registered.
   */
  has(capability: AgentCapability): boolean {
    return this.handlers.has(capability);
  }

  /**
   * Execute a registered capability with the given arguments.
   * Throws if the capability is not registered.
   */
  async execute(
    capability: AgentCapability,
    args: Record<string, unknown>,
  ): Promise<unknown> {
    const handler = this.handlers.get(capability);
    if (!handler) {
      throw new Error(
        `Capability "${capability}" is not registered. ` +
          `Available: [${[...this.handlers.keys()].join(', ')}]`,
      );
    }
    return handler(args);
  }

  /**
   * Return all registered capabilities.
   */
  list(): AgentCapability[] {
    return [...this.handlers.keys()];
  }

  /**
   * Remove all registered capabilities.
   */
  clear(): void {
    this.handlers.clear();
  }

  /**
   * Return the number of registered capabilities.
   */
  get size(): number {
    return this.handlers.size;
  }
}
