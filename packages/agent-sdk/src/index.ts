// =============================================================================
// @lurk/agent-sdk — Agent Development SDK
// =============================================================================

export { BaseAgent } from './agent.js';
export type {
  AgentDecision,
  AgentExecutionResult,
  ExecutionTiming,
  GateConfig,
} from './agent.js';

export { TriggerManager } from './triggers.js';
export type { TriggerEvent, TriggerHandler } from './triggers.js';

export { CapabilityRegistry } from './capabilities.js';
export type { CapabilityHandler } from './capabilities.js';

export { ScopeResolver } from './scope.js';
export type { ResolvedScope, ScopePolicy } from './scope.js';

export { ContextBuilder } from './context.js';
export type { AgentContext, ArtifactSummary } from './context.js';
