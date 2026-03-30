#!/usr/bin/env node

/**
 * Lurk Evaluation Framework — Main entry point.
 *
 * Usage:
 *   node evaluation/run-evaluation.mjs                  # console output (default)
 *   node evaluation/run-evaluation.mjs --reporter=json  # JSON file output
 *   node evaluation/run-evaluation.mjs --reporter=all   # both console and JSON
 *   node evaluation/run-evaluation.mjs --reporter=console --verbose  # show all findings
 *   node evaluation/run-evaluation.mjs --component=api-gateway       # evaluate single component
 *   node evaluation/run-evaluation.mjs --dod-only                    # only DoD criteria
 *   node evaluation/run-evaluation.mjs --help                        # show usage
 */

import { runEvaluation } from "./customer-agent.mjs";
import { report as consoleReport } from "./reporters/console-reporter.mjs";
import { report as jsonReport } from "./reporters/json-reporter.mjs";

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = {
    reporter: "console",
    verbose: false,
    component: null,
    dodOnly: false,
    help: false,
  };

  for (const arg of argv.slice(2)) {
    if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg === "--verbose" || arg === "-v") {
      args.verbose = true;
    } else if (arg === "--dod-only") {
      args.dodOnly = true;
    } else if (arg.startsWith("--reporter=")) {
      args.reporter = arg.split("=")[1];
    } else if (arg.startsWith("--component=")) {
      args.component = arg.split("=")[1];
    }
  }

  return args;
}

function printUsage() {
  console.log(`
Lurk Evaluation Framework
=========================

Evaluates the Lurk platform against PRD v3 Definition of Done criteria
and component quality rubrics.

Usage:
  node evaluation/run-evaluation.mjs [options]

Options:
  --reporter=console     Output results to terminal (default)
  --reporter=json        Write results to evaluation/reports/ as JSON
  --reporter=all         Both console and JSON output
  --component=<name>     Evaluate a single component (e.g., api-gateway)
  --dod-only             Only evaluate Definition of Done criteria
  --verbose, -v          Show all findings including passing checks
  --help, -h             Show this help message

Examples:
  node evaluation/run-evaluation.mjs
  node evaluation/run-evaluation.mjs --reporter=all
  node evaluation/run-evaluation.mjs --component=web-admin --verbose
  node evaluation/run-evaluation.mjs --dod-only --reporter=json

Components:
  web-admin, chrome-extension, api-gateway, agent-orchestrator,
  llm-gateway, pii-service, migration-service, notification-service,
  tts-service, audit-service, shared-types, policy-engine,
  diff-engine, acl-resolver, agent-sdk, ui-web
`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv);

  if (args.help) {
    printUsage();
    process.exit(0);
  }

  console.log("Lurk Customer Agent starting evaluation...\n");

  try {
    const evaluation = await runEvaluation();

    // Filter to single component if requested
    if (args.component) {
      const comp = evaluation.components.find((c) => c.component === args.component);
      if (!comp) {
        console.error(`Component "${args.component}" not found in rubric.`);
        console.error(`Available: ${evaluation.components.map((c) => c.component).join(", ")}`);
        process.exit(1);
      }
      evaluation.components = [comp];
      // Recalculate summary for filtered view
      evaluation.summary.components_total = 1;
      evaluation.summary.components_existing = comp.exists ? 1 : 0;
      evaluation.summary.components_passing = comp.overall_score >= 5 ? 1 : 0;
    }

    // Filter to DoD only if requested
    if (args.dodOnly) {
      evaluation.components = [];
    }

    // If not verbose, strip passing findings from output to reduce noise
    if (!args.verbose) {
      for (const comp of evaluation.components) {
        comp._all_findings_count = comp.findings.length;
        comp.findings = comp.findings.filter((f) => !f.pass);
      }
    }

    // Run reporters
    switch (args.reporter) {
      case "json":
        jsonReport(evaluation);
        break;
      case "all":
        consoleReport(evaluation);
        jsonReport(evaluation);
        break;
      case "console":
      default:
        consoleReport(evaluation);
        break;
    }

    // Exit code based on beta readiness
    process.exit(evaluation.summary.beta_ready ? 0 : 1);
  } catch (err) {
    console.error("Evaluation failed with error:", err);
    process.exit(2);
  }
}

main();
