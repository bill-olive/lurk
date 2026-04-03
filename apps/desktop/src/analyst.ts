// =============================================================================
// Analyst — Local LLM analysis via Ollama (Qwen3 14B on Apple Silicon)
//
// Runs document summarization, writing style extraction, content classification,
// and insight generation entirely on-device. Only insights/summaries are synced
// to the cloud — raw content never leaves the machine.
// =============================================================================

import { Ollama } from 'ollama';
import { Ledger } from './ledger';
import type { OllamaManager } from './ollama-manager';

// ---- Configuration ---------------------------------------------------------

const MAX_CONTENT_LENGTH = 12000;   // chars to send to LLM (fit in 8K tokens)
const ANALYSIS_QUEUE_INTERVAL = 5000; // ms between queue drain attempts

// ---- Types -----------------------------------------------------------------

interface AnalysisJob {
  artifactId: string;
  commitId: string;
  fileName: string;
  extension: string;
  content: string;
}

interface AnalysisResult {
  summary: string;
  classification: string;
  style_notes: string | null;
  suggestion: string | null;
}

// ---- Analyst Class ---------------------------------------------------------

export class Analyst {
  private ollama: Ollama;
  private model: string;
  private queue: AnalysisJob[] = [];
  private processing = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private available = false;

  constructor(
    private ledger: Ledger,
    private manager: OllamaManager,
  ) {
    this.model = manager.getModel();
    this.ollama = manager.getClient();
  }

  /** Start the analyst — uses the managed Ollama instance from OllamaManager. */
  async start(): Promise<void> {
    if (!this.manager.isRunning()) {
      console.log('[Analyst] OllamaManager not running — local analysis disabled');
      return;
    }

    this.available = true;
    console.log(`[Analyst] Connected to managed Ollama (${this.model})`);
    this.timer = setInterval(() => this.drain(), ANALYSIS_QUEUE_INTERVAL);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  isAvailable(): boolean {
    return this.available;
  }

  /** Enqueue a file for analysis. Called by the watcher after a commit. */
  enqueue(job: AnalysisJob): void {
    if (!this.available) return;

    // De-duplicate: don't re-queue the same artifact if already pending
    const exists = this.queue.some(j => j.artifactId === job.artifactId);
    if (exists) {
      // Replace with the latest version
      this.queue = this.queue.filter(j => j.artifactId !== job.artifactId);
    }

    this.queue.push(job);
  }

  // ---- Private: Queue Processing -------------------------------------------

  private async drain(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;
    const job = this.queue.shift()!;

    try {
      await this.analyze(job);
    } catch (err) {
      console.error(`[Analyst] Failed to analyze ${job.fileName}:`, err);
    } finally {
      this.processing = false;
    }
  }

  private async analyze(job: AnalysisJob): Promise<void> {
    const start = Date.now();
    const truncated = job.content.slice(0, MAX_CONTENT_LENGTH);

    const prompt = this.buildPrompt(job.fileName, job.extension, truncated);

    let rawResponse = '';
    try {
      const response = await this.ollama.chat({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are a document analyst. Respond ONLY with valid JSON. No markdown, no explanation, no code fences.',
          },
          { role: 'user', content: prompt },
        ],
        options: {
          temperature: 0.3,
          num_ctx: 8192,
        },
      });
      rawResponse = response.message.content;
    } catch (err) {
      console.error(`[Analyst] Ollama request failed for ${job.fileName}:`, err);
      return;
    }

    const elapsed = Date.now() - start;

    // Parse the JSON response
    let result: AnalysisResult;
    try {
      // Strip thinking tags if present (Qwen3 sometimes wraps in <think>)
      const cleaned = rawResponse
        .replace(/<think>[\s\S]*?<\/think>/g, '')
        .replace(/```json\s*/g, '')
        .replace(/```\s*/g, '')
        .trim();
      result = JSON.parse(cleaned);
    } catch {
      console.warn(`[Analyst] Failed to parse LLM response for ${job.fileName}, storing raw`);
      result = {
        summary: rawResponse.slice(0, 500),
        classification: 'unknown',
        style_notes: null,
        suggestion: null,
      };
    }

    const metadata = JSON.stringify({
      model: this.model,
      latency_ms: elapsed,
      content_length: truncated.length,
      local: true,
    });

    // Store insights in ledger
    if (result.summary) {
      this.ledger.insertInsight({
        artifact_id: job.artifactId,
        commit_id: job.commitId,
        insight_type: 'summary',
        content: result.summary,
        metadata,
      });
    }

    if (result.classification) {
      this.ledger.insertInsight({
        artifact_id: job.artifactId,
        commit_id: job.commitId,
        insight_type: 'classification',
        content: result.classification,
        metadata,
      });
    }

    if (result.style_notes) {
      this.ledger.insertInsight({
        artifact_id: job.artifactId,
        commit_id: job.commitId,
        insight_type: 'style',
        content: result.style_notes,
        metadata,
      });
    }

    if (result.suggestion) {
      this.ledger.insertInsight({
        artifact_id: job.artifactId,
        commit_id: job.commitId,
        insight_type: 'suggestion',
        content: result.suggestion,
        metadata,
      });
    }

    console.log(`[Analyst] ${job.fileName} — ${elapsed}ms (${result.classification})`);
  }

  // ---- Private: Prompt Building --------------------------------------------

  private buildPrompt(fileName: string, ext: string, content: string): string {
    return `Analyze this document and return a JSON object with exactly these fields:

{
  "summary": "A 2-3 sentence summary of the document's content and purpose.",
  "classification": "One of: technical_doc, business_doc, personal_note, meeting_notes, code_config, correspondence, creative_writing, data_file, reference, other",
  "style_notes": "Brief notes on the writing style: tone, formality, sentence structure, vocabulary level. Null if not applicable (e.g., data files).",
  "suggestion": "One actionable suggestion for improving this document, or null if it's already good."
}

File: ${fileName} (${ext})
Content:
---
${content}
---

Respond with ONLY the JSON object.`;
  }

}
