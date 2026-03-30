// ---------------------------------------------------------------------------
// ContextBuilder — builds the agent execution context from artifacts
// ---------------------------------------------------------------------------

import type {
  Agent,
  Artifact,
  FeatureBundle,
  ArtifactType,
  Timestamp,
} from '@lurk/shared-types';

// ---- AgentContext -----------------------------------------------------------

/**
 * The context object passed to an agent's analyze() method. Contains all the
 * information the agent needs to make a decision, pruned to fit within
 * token budgets.
 */
export interface AgentContext {
  /** The agent this context was built for. */
  agentId: string;
  /** Artifact summaries included in this context window. */
  artifacts: ArtifactSummary[];
  /** Extracted feature bundles for ML/embedding operations. */
  featureBundles: FeatureBundle[];
  /** Total estimated token count of this context. */
  estimatedTokens: number;
  /** When this context was assembled. */
  builtAt: Timestamp;
}

/**
 * A lightweight representation of an artifact for inclusion in the context
 * window. Full content is never included; instead we carry the redacted
 * content (if available) plus the feature bundle.
 */
export interface ArtifactSummary {
  id: string;
  ledgerId: string;
  type: ArtifactType;
  title: string;
  tags: string[];
  version: number;
  /** Redacted content (may be null if policy forbids). */
  redactedContent: string | null;
  featureBundle: FeatureBundle;
  /** Relevance score assigned during context building (0.0 - 1.0). */
  relevance: number;
}

// ---- ContextBuilder --------------------------------------------------------

export class ContextBuilder {
  /** Average characters per token (rough estimate for pruning). */
  private static readonly CHARS_PER_TOKEN = 4;

  /**
   * Build a full agent context from a set of in-scope artifacts.
   */
  buildContext(artifacts: Artifact[], agent: Agent): AgentContext {
    const summaries = artifacts.map((a) => this.toSummary(a));

    // Sort by relevance descending so the most important artifacts appear first
    summaries.sort((a, b) => b.relevance - a.relevance);

    const featureBundles = this.loadFeatureBundles(artifacts);
    const estimatedTokens = this.estimateTokens(summaries);

    return {
      agentId: agent.id,
      artifacts: summaries,
      featureBundles,
      estimatedTokens,
      builtAt: new Date().toISOString(),
    };
  }

  /**
   * Extract feature bundles from a set of artifacts.
   */
  loadFeatureBundles(artifacts: Artifact[]): FeatureBundle[] {
    return artifacts.map((a) => a.featureBundle);
  }

  /**
   * Prune a context to fit within a maximum token budget. Removes the
   * lowest-relevance artifacts first, then truncates redacted content
   * on remaining artifacts if still over budget.
   */
  pruneContext(context: AgentContext, maxTokens: number): AgentContext {
    let pruned = { ...context, artifacts: [...context.artifacts] };

    // Phase 1: drop entire artifacts starting from the least relevant
    while (
      pruned.artifacts.length > 0 &&
      this.estimateTokens(pruned.artifacts) > maxTokens
    ) {
      pruned.artifacts.pop();
    }

    // Phase 2: truncate redacted content on remaining artifacts
    if (this.estimateTokens(pruned.artifacts) > maxTokens) {
      const budgetPerArtifact = Math.floor(
        maxTokens / Math.max(pruned.artifacts.length, 1),
      );
      const charsPerArtifact = budgetPerArtifact * ContextBuilder.CHARS_PER_TOKEN;

      pruned.artifacts = pruned.artifacts.map((a) => {
        if (a.redactedContent && a.redactedContent.length > charsPerArtifact) {
          return {
            ...a,
            redactedContent: a.redactedContent.slice(0, charsPerArtifact) + '...',
          };
        }
        return a;
      });
    }

    // Rebuild feature bundles to match remaining artifacts
    pruned.featureBundles = pruned.artifacts.map((a) => a.featureBundle);
    pruned.estimatedTokens = this.estimateTokens(pruned.artifacts);

    return pruned;
  }

  // -- Private ----------------------------------------------------------------

  private toSummary(artifact: Artifact): ArtifactSummary {
    return {
      id: artifact.id,
      ledgerId: artifact.ledgerId,
      type: artifact.type,
      title: artifact.title,
      tags: artifact.tags,
      version: artifact.version,
      redactedContent: artifact.redactedContent,
      featureBundle: artifact.featureBundle,
      relevance: this.scoreRelevance(artifact),
    };
  }

  /**
   * Heuristic relevance score based on recency, quality, and staleness.
   */
  private scoreRelevance(artifact: Artifact): number {
    let score = 0.5;

    // Boost recent artifacts
    const ageMs = Date.now() - new Date(artifact.modifiedAt).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    if (ageDays < 1) score += 0.3;
    else if (ageDays < 7) score += 0.2;
    else if (ageDays < 30) score += 0.1;

    // Boost high-quality artifacts
    if (artifact.qualityScore !== null) {
      score += artifact.qualityScore * 0.2;
    }

    // Penalize stale artifacts
    if (artifact.stalenessScore !== null) {
      score -= artifact.stalenessScore * 0.2;
    }

    return Math.max(0, Math.min(1, score));
  }

  private estimateTokens(summaries: ArtifactSummary[]): number {
    let totalChars = 0;
    for (const s of summaries) {
      // Title + tags contribute
      totalChars += s.title.length;
      totalChars += s.tags.join(' ').length;
      // Redacted content is the bulk
      if (s.redactedContent) {
        totalChars += s.redactedContent.length;
      }
      // Feature bundle key phrases
      totalChars += s.featureBundle.keyPhrases.join(' ').length;
    }
    return Math.ceil(totalChars / ContextBuilder.CHARS_PER_TOKEN);
  }
}
