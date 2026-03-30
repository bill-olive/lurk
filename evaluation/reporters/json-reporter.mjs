/**
 * JSON Reporter — Writes detailed evaluation results to evaluation/reports/ as JSON.
 */

import fs from "node:fs";
import path from "node:path";

export function report(evaluation) {
  const reportsDir = path.join(import.meta.dirname, "..", "reports");

  // Ensure reports directory exists
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  // Generate timestamped filename
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").replace("T", "_").slice(0, 19);
  const filename = `evaluation-${timestamp}.json`;
  const filepath = path.join(reportsDir, filename);

  // Write full evaluation report
  const output = {
    ...evaluation,
    _report_metadata: {
      format: "json",
      generated_at: new Date().toISOString(),
      filepath: filepath,
    },
  };

  fs.writeFileSync(filepath, JSON.stringify(output, null, 2), "utf-8");
  console.log(`[JSON Reporter] Full report written to: ${filepath}`);

  // Also write a summary file
  const summaryFilename = `evaluation-summary-${timestamp}.json`;
  const summaryFilepath = path.join(reportsDir, summaryFilename);

  const summary = {
    metadata: evaluation.metadata,
    summary: evaluation.summary,
    component_scores: evaluation.components.map((c) => ({
      component: c.component,
      path: c.path,
      exists: c.exists,
      overall_score: c.overall_score,
      grade: c.grade,
      pass_rate: c.pass_rate,
      scores: c.scores,
    })),
    dod_results: evaluation.definition_of_done.map((d) => ({
      id: d.id,
      name: d.name,
      category: d.category,
      weight: d.weight,
      score: d.score,
      pass: d.pass,
    })),
    failing_criteria: evaluation.definition_of_done
      .filter((d) => !d.pass)
      .map((d) => ({
        id: d.id,
        name: d.name,
        score: d.score,
        failing_checks: d.checks.filter((c) => !c.pass).map((c) => c.name),
      })),
    top_recommendations: evaluation.recommendations.slice(0, 10),
    _report_metadata: {
      format: "json-summary",
      generated_at: new Date().toISOString(),
      full_report: filepath,
    },
  };

  fs.writeFileSync(summaryFilepath, JSON.stringify(summary, null, 2), "utf-8");
  console.log(`[JSON Reporter] Summary written to: ${summaryFilepath}`);

  // Write a latest symlink-style file (overwrite each time)
  const latestPath = path.join(reportsDir, "latest.json");
  fs.writeFileSync(latestPath, JSON.stringify(output, null, 2), "utf-8");
  console.log(`[JSON Reporter] Latest report available at: ${latestPath}`);

  return { filepath, summaryFilepath, latestPath };
}
