/**
 * Console Reporter — Pretty-prints evaluation results to the terminal.
 */

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const BLUE = "\x1b[34m";
const MAGENTA = "\x1b[35m";
const CYAN = "\x1b[36m";
const WHITE = "\x1b[37m";
const BG_RED = "\x1b[41m";
const BG_GREEN = "\x1b[42m";
const BG_YELLOW = "\x1b[43m";

function colorize(text, ...codes) {
  return codes.join("") + text + RESET;
}

function bar(score, max = 10, width = 20) {
  const filled = Math.round((score / max) * width);
  const empty = width - filled;
  const color = score >= 7 ? GREEN : score >= 4 ? YELLOW : RED;
  return color + "\u2588".repeat(filled) + DIM + "\u2591".repeat(empty) + RESET;
}

function gradeColor(grade) {
  if (grade.startsWith("A")) return GREEN;
  if (grade.startsWith("B")) return CYAN;
  if (grade.startsWith("C")) return YELLOW;
  return RED;
}

function priorityColor(priority) {
  switch (priority) {
    case "CRITICAL": return BG_RED + WHITE;
    case "HIGH": return RED;
    case "MEDIUM": return YELLOW;
    case "LOW": return DIM;
    default: return RESET;
  }
}

function padRight(str, len) {
  return str.length >= len ? str.slice(0, len) : str + " ".repeat(len - str.length);
}

function padLeft(str, len) {
  return str.length >= len ? str.slice(0, len) : " ".repeat(len - str.length) + str;
}

function separator(char = "\u2500", len = 80) {
  return DIM + char.repeat(len) + RESET;
}

function doubleSeparator(len = 80) {
  return DIM + "\u2550".repeat(len) + RESET;
}

export function report(evaluation) {
  const lines = [];

  // Header
  lines.push("");
  lines.push(doubleSeparator());
  lines.push(colorize("  LURK EVALUATION REPORT", BOLD, CYAN));
  lines.push(colorize(`  ${evaluation.metadata.evaluator}`, DIM));
  lines.push(colorize(`  Evaluated: ${evaluation.metadata.evaluated_at}`, DIM));
  lines.push(colorize(`  Duration: ${evaluation.metadata.elapsed_ms}ms`, DIM));
  lines.push(doubleSeparator());
  lines.push("");

  // Summary
  const s = evaluation.summary;
  const readinessColor = s.beta_ready ? BG_GREEN : s.grade === "IN PROGRESS" ? BG_YELLOW : BG_RED;
  lines.push(colorize("  SUMMARY", BOLD));
  lines.push(separator());
  lines.push("");
  lines.push(`  Status:              ${colorize(` ${s.grade} `, readinessColor, BOLD)}`);
  lines.push(`  Component Score:     ${bar(s.overall_component_score)} ${colorize(s.overall_component_score.toFixed(1) + "/10", BOLD)}`);
  lines.push(`  DoD Score:           ${bar(s.overall_dod_score, 100, 20)} ${colorize(s.overall_dod_score.toFixed(1) + "%", BOLD)}`);
  lines.push(`  Weighted DoD Score:  ${bar(s.weighted_dod_score, 100, 20)} ${colorize(s.weighted_dod_score.toFixed(1) + "%", BOLD)}`);
  lines.push("");
  lines.push(`  Components:  ${colorize(String(s.components_existing), GREEN)}/${s.components_total} exist, ${colorize(String(s.components_passing), s.components_passing > 0 ? GREEN : RED)} passing`);
  lines.push(`  DoD Criteria: ${colorize(String(s.dod_criteria_passing), s.dod_criteria_passing >= 16 ? GREEN : YELLOW)}/${s.dod_criteria_total} passing`);
  lines.push("");

  // Component Results
  lines.push(doubleSeparator());
  lines.push(colorize("  COMPONENT SCORES", BOLD));
  lines.push(separator());
  lines.push("");

  const header = `  ${padRight("Component", 25)} ${padRight("Score", 8)} ${padRight("Grade", 7)} ${padRight("Pass%", 7)} ${padRight("Checks", 8)} Status`;
  lines.push(colorize(header, DIM));
  lines.push(colorize("  " + "-".repeat(78), DIM));

  for (const comp of evaluation.components) {
    const scoreStr = comp.exists ? `${comp.overall_score.toFixed(1)}/10` : "  N/A";
    const gradeStr = comp.exists ? comp.grade : "N/A";
    const passStr = comp.exists ? `${comp.pass_rate}%` : "N/A";
    const checksStr = comp.exists ? `${comp.total_checks - comp.failed_checks}/${comp.total_checks}` : "0/0";
    const statusIcon = !comp.exists ? colorize("\u2717 MISSING", RED) : comp.overall_score >= 5 ? colorize("\u2713 OK", GREEN) : colorize("\u26A0 LOW", YELLOW);

    lines.push(
      `  ${padRight(comp.component, 25)} ${padRight(scoreStr, 8)} ${colorize(padRight(gradeStr, 7), gradeColor(gradeStr))} ${padRight(passStr, 7)} ${padRight(checksStr, 8)} ${statusIcon}`
    );
  }
  lines.push("");

  // Detailed dimension scores per component
  lines.push(doubleSeparator());
  lines.push(colorize("  DIMENSION BREAKDOWN", BOLD));
  lines.push(separator());
  lines.push("");

  for (const comp of evaluation.components) {
    if (!comp.exists) continue;
    lines.push(colorize(`  ${comp.component}`, BOLD, CYAN) + colorize(` (${comp.technology})`, DIM));
    lines.push(colorize(`  ${comp.path}`, DIM));
    lines.push("");

    for (const [dim, score] of Object.entries(comp.scores)) {
      const label = padRight(`    ${dim}:`, 25);
      lines.push(`${label} ${bar(score)} ${score}/10`);
    }
    lines.push("");

    // Show failed checks for this component (limit to 10)
    const failed = comp.findings.filter((f) => !f.pass);
    if (failed.length > 0) {
      lines.push(colorize(`    Failed checks (${failed.length}):`, RED));
      for (const f of failed.slice(0, 10)) {
        lines.push(colorize(`      \u2717 [${f.dimension || "general"}] ${f.check}: ${f.detail}`, DIM));
      }
      if (failed.length > 10) {
        lines.push(colorize(`      ... and ${failed.length - 10} more`, DIM));
      }
    }
    lines.push(separator("\u2500", 60));
    lines.push("");
  }

  // Definition of Done
  lines.push(doubleSeparator());
  lines.push(colorize("  DEFINITION OF DONE (PRD Section 22)", BOLD));
  lines.push(separator());
  lines.push("");

  const dodHeader = `  ${padRight("#", 4)} ${padRight("Criterion", 38)} ${padRight("Cat", 14)} ${padRight("Wt", 4)} ${padRight("Score", 7)} Status`;
  lines.push(colorize(dodHeader, DIM));
  lines.push(colorize("  " + "-".repeat(78), DIM));

  for (const dod of evaluation.definition_of_done) {
    const statusIcon = dod.pass ? colorize("\u2713 PASS", GREEN) : colorize("\u2717 FAIL", RED);
    const scoreStr = `${dod.score}%`;
    lines.push(
      `  ${padRight(dod.id.replace("dod-", ""), 4)} ${padRight(dod.name.slice(0, 37), 38)} ${padRight(dod.category, 14)} ${padRight(String(dod.weight), 4)} ${padRight(scoreStr, 7)} ${statusIcon}`
    );
  }
  lines.push("");

  // DoD detail for failing criteria
  const failingDod = evaluation.definition_of_done.filter((d) => !d.pass);
  if (failingDod.length > 0) {
    lines.push(colorize("  FAILING DoD CRITERIA DETAILS", BOLD, RED));
    lines.push(separator());
    lines.push("");

    for (const dod of failingDod) {
      lines.push(colorize(`  ${dod.id}: ${dod.name}`, BOLD, YELLOW));
      lines.push(colorize(`  Score: ${dod.score}% | Weight: ${dod.weight}`, DIM));
      for (const check of dod.checks) {
        const icon = check.pass ? colorize("\u2713", GREEN) : colorize("\u2717", RED);
        lines.push(`    ${icon} ${check.name}`);
      }
      lines.push("");
    }
  }

  // Recommendations
  if (evaluation.recommendations && evaluation.recommendations.length > 0) {
    lines.push(doubleSeparator());
    lines.push(colorize("  RECOMMENDATIONS", BOLD));
    lines.push(separator());
    lines.push("");

    for (const rec of evaluation.recommendations) {
      const pColor = priorityColor(rec.priority);
      lines.push(`  ${colorize(`[${rec.priority}]`, pColor, BOLD)} ${colorize(rec.area, BOLD)}`);
      lines.push(colorize(`    ${rec.detail}`, DIM));
      lines.push(`    ${colorize("Action:", CYAN)} ${rec.action}`);
      lines.push("");
    }
  }

  // Footer
  lines.push(doubleSeparator());
  lines.push(colorize(`  Evaluation complete. ${evaluation.summary.dod_criteria_passing}/${evaluation.summary.dod_criteria_total} DoD criteria met.`, BOLD));
  if (evaluation.summary.beta_ready) {
    lines.push(colorize("  VERDICT: Platform is ready for closed beta.", BOLD, GREEN));
  } else {
    lines.push(colorize("  VERDICT: Platform is NOT ready for closed beta.", BOLD, RED));
    lines.push(colorize(`  Address ${failingDod.length} failing DoD criteria and improve component scores to proceed.`, DIM));
  }
  lines.push(doubleSeparator());
  lines.push("");

  console.log(lines.join("\n"));
}
