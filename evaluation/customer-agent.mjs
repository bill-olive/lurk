/**
 * Lurk Customer Agent — Automated evaluation of built components against PRD criteria.
 *
 * Reads real project files, checks for expected structures, dependencies, route
 * definitions, Firestore collection references, Firebase Auth integration,
 * Docker/Cloud Run configs, and more.  Returns a structured evaluation report
 * with per-component scores and per-DoD-criterion pass/fail verdicts.
 */

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ROOT = path.resolve(import.meta.dirname, "..");

function fileExists(relPath) {
  return fs.existsSync(path.join(ROOT, relPath));
}

function readFile(relPath) {
  const full = path.join(ROOT, relPath);
  if (!fs.existsSync(full)) return null;
  return fs.readFileSync(full, "utf-8");
}

function readJson(relPath) {
  const raw = readFile(relPath);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Recursively list all files under `dir` that match `ext`.
 * Returns relative paths from ROOT.
 */
function listFiles(relDir, ext) {
  const full = path.join(ROOT, relDir);
  if (!fs.existsSync(full) || !fs.statSync(full).isDirectory()) return [];
  const results = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fp = path.join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== "node_modules" && entry.name !== ".git") {
        walk(fp);
      } else if (entry.isFile()) {
        if (!ext || entry.name.endsWith(ext)) {
          results.push(path.relative(ROOT, fp));
        }
      }
    }
  };
  walk(full);
  return results;
}

/** Search all files under relDir for a regex pattern. Returns matches. */
function searchFiles(relDir, pattern, extensions) {
  const files = [];
  for (const ext of extensions) {
    files.push(...listFiles(relDir, ext));
  }
  const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern, "gi");
  const matches = [];
  for (const f of files) {
    const content = readFile(f);
    if (!content) continue;
    const m = content.match(regex);
    if (m) {
      matches.push({ file: f, count: m.length, sample: m.slice(0, 3) });
    }
  }
  return matches;
}

/** Check whether any file under relDir contains the given string. */
function containsString(relDir, str, extensions) {
  const files = [];
  for (const ext of extensions) {
    files.push(...listFiles(relDir, ext));
  }
  for (const f of files) {
    const content = readFile(f);
    if (content && content.includes(str)) return true;
  }
  return false;
}

/** Count files under a directory matching an extension. */
function countFiles(relDir, ext) {
  return listFiles(relDir, ext).length;
}

/** Check if a package.json has a given dependency (deps or devDeps). */
function hasDependency(pkgJsonPath, depName) {
  const pkg = readJson(pkgJsonPath);
  if (!pkg) return false;
  const all = {
    ...(pkg.dependencies || {}),
    ...(pkg.devDependencies || {}),
    ...(pkg.peerDependencies || {}),
  };
  return depName in all;
}

/** Check if a requirements.txt or pyproject.toml references a package. */
function hasPythonDep(serviceDir, depName) {
  const req = readFile(path.join(serviceDir, "requirements.txt"));
  if (req && req.toLowerCase().includes(depName.toLowerCase())) return true;
  const pyproj = readFile(path.join(serviceDir, "pyproject.toml"));
  if (pyproj && pyproj.toLowerCase().includes(depName.toLowerCase())) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Component evaluators
// ---------------------------------------------------------------------------

function evaluatePackageJson(componentPath) {
  const findings = [];
  const pkgPath = path.join(componentPath, "package.json");
  const pkg = readJson(pkgPath);
  if (!pkg) {
    findings.push({ check: "package.json exists", pass: false, detail: "Missing package.json" });
    return { score: 0, findings };
  }
  findings.push({ check: "package.json exists", pass: true, detail: `name: ${pkg.name || "(unnamed)"}` });

  if (pkg.scripts && Object.keys(pkg.scripts).length > 0) {
    findings.push({ check: "scripts defined", pass: true, detail: `Scripts: ${Object.keys(pkg.scripts).join(", ")}` });
  } else {
    findings.push({ check: "scripts defined", pass: false, detail: "No scripts in package.json" });
  }

  const hasDeps = (pkg.dependencies && Object.keys(pkg.dependencies).length > 0) ||
                  (pkg.devDependencies && Object.keys(pkg.devDependencies).length > 0);
  findings.push({
    check: "dependencies present",
    pass: hasDeps,
    detail: hasDeps ? `deps: ${Object.keys(pkg.dependencies || {}).length}, devDeps: ${Object.keys(pkg.devDependencies || {}).length}` : "No dependencies listed",
  });

  const score = findings.filter((f) => f.pass).length / findings.length;
  return { score, findings };
}

function evaluateTypeScriptCompilability(componentPath) {
  const findings = [];
  const tsFiles = listFiles(componentPath, ".ts").concat(listFiles(componentPath, ".tsx"));
  if (tsFiles.length === 0) {
    findings.push({ check: "TypeScript files present", pass: false, detail: "No .ts/.tsx files found" });
    return { score: 0, findings };
  }
  findings.push({ check: "TypeScript files present", pass: true, detail: `${tsFiles.length} TypeScript files found` });

  // Check for tsconfig
  const hasTsConfig = fileExists(path.join(componentPath, "tsconfig.json"));
  findings.push({ check: "tsconfig.json exists", pass: hasTsConfig, detail: hasTsConfig ? "Found" : "Missing tsconfig.json" });

  // Basic syntax check — look for unmatched braces, obvious errors
  let syntaxOk = 0;
  let syntaxBad = 0;
  for (const f of tsFiles.slice(0, 20)) {
    const content = readFile(f);
    if (!content) continue;
    // Simple heuristic: count braces
    const open = (content.match(/{/g) || []).length;
    const close = (content.match(/}/g) || []).length;
    if (Math.abs(open - close) <= 1) {
      syntaxOk++;
    } else {
      syntaxBad++;
    }
  }
  const total = syntaxOk + syntaxBad;
  if (total > 0) {
    const ratio = syntaxOk / total;
    findings.push({
      check: "TypeScript syntax heuristic",
      pass: ratio > 0.8,
      detail: `${syntaxOk}/${total} files pass brace-matching heuristic`,
    });
  }

  // Check for type imports/exports (indicates proper typing)
  let typeCount = 0;
  for (const f of tsFiles.slice(0, 20)) {
    const content = readFile(f);
    if (!content) continue;
    if (/\b(interface|type|enum)\s+\w+/.test(content) || /import\s+.*type/.test(content)) {
      typeCount++;
    }
  }
  findings.push({
    check: "Type definitions used",
    pass: typeCount > 0,
    detail: `${typeCount} files contain type/interface/enum definitions or type imports`,
  });

  const score = findings.filter((f) => f.pass).length / findings.length;
  return { score, findings };
}

function evaluatePythonCompilability(componentPath) {
  const findings = [];
  const pyFiles = listFiles(componentPath, ".py");
  if (pyFiles.length === 0) {
    findings.push({ check: "Python files present", pass: false, detail: "No .py files found" });
    return { score: 0, findings };
  }
  findings.push({ check: "Python files present", pass: true, detail: `${pyFiles.length} Python files found` });

  // Check for requirements.txt or pyproject.toml
  const hasReqs = fileExists(path.join(componentPath, "requirements.txt"));
  const hasPyProj = fileExists(path.join(componentPath, "pyproject.toml"));
  findings.push({
    check: "Dependency file exists",
    pass: hasReqs || hasPyProj,
    detail: hasReqs ? "requirements.txt found" : hasPyProj ? "pyproject.toml found" : "No dependency file",
  });

  // Basic syntax check — look for def/class/import patterns
  let wellFormed = 0;
  for (const f of pyFiles.slice(0, 20)) {
    const content = readFile(f);
    if (!content) continue;
    if (/^(import |from |def |class |async def |@)/.test(content) || /\ndef /.test(content) || /\nclass /.test(content)) {
      wellFormed++;
    }
  }
  findings.push({
    check: "Python structure heuristic",
    pass: wellFormed > 0,
    detail: `${wellFormed}/${Math.min(pyFiles.length, 20)} files contain standard Python structures`,
  });

  // Check for type hints
  let typedFiles = 0;
  for (const f of pyFiles.slice(0, 20)) {
    const content = readFile(f);
    if (!content) continue;
    if (/:\s*(str|int|float|bool|list|dict|Optional|List|Dict|Any|Tuple)\b/.test(content) || /-> /.test(content)) {
      typedFiles++;
    }
  }
  findings.push({
    check: "Python type hints used",
    pass: typedFiles > 0,
    detail: `${typedFiles} files contain type hints`,
  });

  const score = findings.filter((f) => f.pass).length / findings.length;
  return { score, findings };
}

function evaluateApiRoutes(componentPath, expectedRoutes) {
  const findings = [];
  if (!expectedRoutes || expectedRoutes.length === 0) {
    return { score: 1, findings: [{ check: "API routes", pass: true, detail: "No routes expected for this component" }] };
  }

  const allFiles = [
    ...listFiles(componentPath, ".ts"),
    ...listFiles(componentPath, ".tsx"),
    ...listFiles(componentPath, ".py"),
    ...listFiles(componentPath, ".mjs"),
    ...listFiles(componentPath, ".js"),
  ];

  let allContent = "";
  for (const f of allFiles) {
    const c = readFile(f);
    if (c) allContent += "\n" + c;
  }

  let found = 0;
  const routeResults = [];
  for (const route of expectedRoutes) {
    // Parse "GET /api/artifacts/:id" into method + path
    const parts = route.split(" ");
    const method = parts[0].toLowerCase();
    const routePath = parts.slice(1).join(" ");

    // Flexible matching: look for the method and a reasonable route path
    const pathSegments = routePath.split("/").filter(Boolean);
    const lastSegment = pathSegments[pathSegments.length - 1];
    const keySegment = pathSegments.length > 1 ? pathSegments[pathSegments.length - 2] : lastSegment;

    // Build patterns to search for
    const patterns = [
      // Express-style: router.get('/api/artifacts', ...)
      new RegExp(`\\.(${method}|all)\\s*\\(\\s*['"\`].*${keySegment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i"),
      // FastAPI-style: @app.get("/api/artifacts")
      new RegExp(`@(app|router)\\.(${method})\\s*\\(\\s*['"\`/].*${keySegment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i"),
      // Route definition object: { method: 'GET', path: '/api/artifacts' }
      new RegExp(`['"\`]${routePath.replace(/:[a-zA-Z]+/g, "[^'\"]+").replace(/\//g, "\\/")}['"\`]`, "i"),
      // Just the path string mentioned anywhere
      new RegExp(`['"\`]/?${pathSegments.slice(0, -1).join("/")}/?['"\`]`, "i"),
    ];

    const matched = patterns.some((p) => p.test(allContent));
    routeResults.push({ route, matched });
    if (matched) found++;
  }

  const ratio = found / expectedRoutes.length;
  findings.push({
    check: "API route coverage",
    pass: ratio >= 0.5,
    detail: `${found}/${expectedRoutes.length} expected routes found (${(ratio * 100).toFixed(0)}%)`,
  });

  // List missing routes
  const missing = routeResults.filter((r) => !r.matched).map((r) => r.route);
  if (missing.length > 0) {
    findings.push({
      check: "Missing routes",
      pass: false,
      detail: `Missing: ${missing.slice(0, 10).join(", ")}${missing.length > 10 ? ` (+${missing.length - 10} more)` : ""}`,
    });
  }

  return { score: ratio, findings };
}

function evaluateFirestoreCollections(componentPath, expectedCollections) {
  const findings = [];
  if (!expectedCollections || expectedCollections.length === 0) {
    return { score: 1, findings: [{ check: "Firestore collections", pass: true, detail: "No collections expected" }] };
  }

  const allFiles = [
    ...listFiles(componentPath, ".ts"),
    ...listFiles(componentPath, ".tsx"),
    ...listFiles(componentPath, ".py"),
    ...listFiles(componentPath, ".mjs"),
    ...listFiles(componentPath, ".js"),
  ];

  let allContent = "";
  for (const f of allFiles) {
    const c = readFile(f);
    if (c) allContent += "\n" + c;
  }

  let found = 0;
  const collResults = [];
  for (const coll of expectedCollections) {
    // Look for collection references in various forms
    const patterns = [
      // Firestore: collection('artifacts') or .collection('artifacts')
      new RegExp(`collection\\s*\\(\\s*['"\`]${coll}['"\`]\\)`, "i"),
      // Constant: COLLECTION_ARTIFACTS = 'artifacts'
      new RegExp(`['"\`]${coll}['"\`]`, "i"),
      // Python: db.collection(u'artifacts')
      new RegExp(`collection\\s*\\(\\s*u?['"]${coll}['"]\\)`, "i"),
    ];

    const matched = patterns.some((p) => p.test(allContent));
    collResults.push({ collection: coll, matched });
    if (matched) found++;
  }

  const ratio = found / expectedCollections.length;
  findings.push({
    check: "Firestore collection references",
    pass: ratio >= 0.5,
    detail: `${found}/${expectedCollections.length} expected collections referenced`,
  });

  const missing = collResults.filter((r) => !r.matched).map((r) => r.collection);
  if (missing.length > 0) {
    findings.push({
      check: "Missing collection references",
      pass: false,
      detail: `Missing: ${missing.join(", ")}`,
    });
  }

  return { score: ratio, findings };
}

function evaluateFirebaseAuth(componentPath) {
  const findings = [];
  const allFiles = [
    ...listFiles(componentPath, ".ts"),
    ...listFiles(componentPath, ".tsx"),
    ...listFiles(componentPath, ".py"),
    ...listFiles(componentPath, ".mjs"),
    ...listFiles(componentPath, ".js"),
  ];

  let allContent = "";
  for (const f of allFiles) {
    const c = readFile(f);
    if (c) allContent += "\n" + c;
  }

  // Check for Firebase Auth patterns
  const authPatterns = [
    { name: "Firebase Admin SDK import", pattern: /firebase-admin|firebase_admin|from firebase_admin/i },
    { name: "Auth verification", pattern: /verifyIdToken|verify_id_token|auth\(\)\.verify/i },
    { name: "Auth middleware", pattern: /auth.*middleware|middleware.*auth|requireAuth|require_auth|authenticate/i },
    { name: "Firebase Auth client", pattern: /firebase\/auth|getAuth|signInWith|onAuthStateChanged/i },
    { name: "Custom claims", pattern: /customClaims|custom_claims|setCustomUserClaims/i },
    { name: "Auth token handling", pattern: /Bearer|authorization|idToken|id_token|access_token/i },
  ];

  let authScore = 0;
  for (const ap of authPatterns) {
    const matched = ap.pattern.test(allContent);
    findings.push({ check: ap.name, pass: matched, detail: matched ? "Found" : "Not found" });
    if (matched) authScore++;
  }

  const score = authScore / authPatterns.length;
  return { score, findings };
}

function evaluateDockerConfig(componentPath) {
  const findings = [];
  const dockerfilePath = path.join(componentPath, "Dockerfile");
  const hasDockerfile = fileExists(dockerfilePath);
  findings.push({ check: "Dockerfile exists", pass: hasDockerfile, detail: hasDockerfile ? "Found" : "Missing" });

  if (hasDockerfile) {
    const content = readFile(dockerfilePath);
    if (content) {
      const hasFrom = /^FROM\s+/im.test(content);
      findings.push({ check: "Dockerfile has FROM", pass: hasFrom, detail: hasFrom ? "Base image specified" : "No FROM instruction" });

      const hasExpose = /^EXPOSE\s+/im.test(content);
      findings.push({ check: "Dockerfile has EXPOSE", pass: hasExpose, detail: hasExpose ? "Port exposed" : "No EXPOSE instruction" });

      const hasCmd = /^(CMD|ENTRYPOINT)\s+/im.test(content);
      findings.push({ check: "Dockerfile has CMD/ENTRYPOINT", pass: hasCmd, detail: hasCmd ? "Start command defined" : "No CMD/ENTRYPOINT" });
    }
  }

  // Check for docker-compose or cloud run config
  const hasCloudRun = fileExists(path.join(componentPath, "service.yaml")) ||
                      fileExists(path.join(componentPath, "cloudrun.yaml")) ||
                      fileExists(path.join(componentPath, ".gcloudignore"));
  if (hasCloudRun) {
    findings.push({ check: "Cloud Run config", pass: true, detail: "Found Cloud Run configuration" });
  }

  const score = findings.filter((f) => f.pass).length / findings.length;
  return { score, findings };
}

function evaluateUIComponents(componentPath, requiredSections) {
  const findings = [];
  if (!requiredSections || requiredSections.length === 0) {
    return { score: 1, findings: [{ check: "UI components", pass: true, detail: "No UI sections expected" }] };
  }

  const tsxFiles = listFiles(componentPath, ".tsx");
  const jsxFiles = listFiles(componentPath, ".jsx");
  const allUIFiles = [...tsxFiles, ...jsxFiles];

  if (allUIFiles.length === 0) {
    findings.push({ check: "UI component files exist", pass: false, detail: "No .tsx/.jsx files found" });
    return { score: 0, findings };
  }

  findings.push({ check: "UI component files exist", pass: true, detail: `${allUIFiles.length} component files found` });

  // Check for each required section
  let allContent = "";
  for (const f of allUIFiles) {
    const c = readFile(f);
    if (c) allContent += "\n" + c;
  }

  // Also check directory structure for page routes (Next.js app router)
  const allDirs = [];
  const walkDirs = (dir) => {
    const full = path.join(ROOT, dir);
    if (!fs.existsSync(full)) return;
    for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
      if (entry.isDirectory() && entry.name !== "node_modules") {
        const rel = path.join(dir, entry.name);
        allDirs.push(rel);
        walkDirs(rel);
      }
    }
  };
  walkDirs(componentPath);

  let sectionFound = 0;
  for (const section of requiredSections) {
    // Normalize section name for matching
    const normalized = section.toLowerCase().replace(/\s+/g, "[-_\\s]?");
    const patterns = [
      new RegExp(normalized, "i"),
      new RegExp(section.replace(/\s+/g, ""), "i"),
    ];

    const inContent = patterns.some((p) => p.test(allContent));
    const inDirs = allDirs.some((d) => patterns.some((p) => p.test(d)));
    const matched = inContent || inDirs;

    findings.push({
      check: `Section: ${section}`,
      pass: matched,
      detail: matched ? (inDirs ? "Directory found" : "Content reference found") : "Not found",
    });
    if (matched) sectionFound++;
  }

  const ratio = sectionFound / requiredSections.length;
  findings.push({
    check: "Section coverage",
    pass: ratio >= 0.5,
    detail: `${sectionFound}/${requiredSections.length} admin sections found`,
  });

  // Check for Tailwind usage
  const tailwind = /className\s*=\s*['"`].*\b(flex|grid|bg-|text-|p-|m-|w-|h-|rounded|shadow)/i.test(allContent);
  findings.push({ check: "Tailwind CSS usage", pass: tailwind, detail: tailwind ? "Tailwind classes detected" : "No Tailwind classes found" });

  // Check for accessibility (aria attributes)
  const aria = /aria-|role=|tabIndex|alt=/i.test(allContent);
  findings.push({ check: "Accessibility attributes", pass: aria, detail: aria ? "ARIA/role/alt attributes found" : "No accessibility attributes" });

  const score = findings.filter((f) => f.pass).length / findings.length;
  return { score, findings };
}

function evaluateTestCoverage(componentPath) {
  const findings = [];
  const testPatterns = [".test.ts", ".test.tsx", ".spec.ts", ".spec.tsx", ".test.py", ".test.js", ".spec.js", "_test.py", "test_"];

  let testFiles = [];
  for (const ext of [".ts", ".tsx", ".py", ".js", ".mjs"]) {
    const files = listFiles(componentPath, ext);
    testFiles.push(...files.filter((f) => testPatterns.some((p) => f.includes(p))));
  }

  // Also check __tests__ or tests directories
  const testDirs = ["__tests__", "tests", "test"];
  for (const td of testDirs) {
    const testDir = path.join(componentPath, td);
    for (const ext of [".ts", ".tsx", ".py", ".js"]) {
      testFiles.push(...listFiles(testDir, ext));
    }
  }

  // Deduplicate
  testFiles = [...new Set(testFiles)];

  if (testFiles.length === 0) {
    findings.push({ check: "Test files exist", pass: false, detail: "No test files found" });
    return { score: 0, findings };
  }

  findings.push({ check: "Test files exist", pass: true, detail: `${testFiles.length} test files found` });

  // Check for test framework patterns
  let allTestContent = "";
  for (const f of testFiles) {
    const c = readFile(f);
    if (c) allTestContent += "\n" + c;
  }

  const hasDescribe = /\b(describe|test|it)\s*\(/.test(allTestContent);
  findings.push({
    check: "Test structure (describe/test/it)",
    pass: hasDescribe,
    detail: hasDescribe ? "Standard test structure found" : "No describe/test/it blocks",
  });

  const hasAssertions = /\b(expect|assert|should|toBe|toEqual|toHaveBeenCalled|assertEqual|assertTrue)\b/.test(allTestContent);
  findings.push({
    check: "Assertions present",
    pass: hasAssertions,
    detail: hasAssertions ? "Assertions found" : "No assertions found",
  });

  // Check for test config
  const hasTestConfig = fileExists(path.join(componentPath, "vitest.config.ts")) ||
                        fileExists(path.join(componentPath, "jest.config.ts")) ||
                        fileExists(path.join(componentPath, "jest.config.js")) ||
                        fileExists(path.join(componentPath, "pytest.ini")) ||
                        fileExists(path.join(componentPath, "conftest.py"));
  findings.push({
    check: "Test configuration",
    pass: hasTestConfig,
    detail: hasTestConfig ? "Test config found" : "No test configuration file",
  });

  const score = findings.filter((f) => f.pass).length / findings.length;
  return { score, findings };
}

function evaluateSharedTypesIntegration(componentPath) {
  const findings = [];
  const allFiles = [
    ...listFiles(componentPath, ".ts"),
    ...listFiles(componentPath, ".tsx"),
    ...listFiles(componentPath, ".js"),
    ...listFiles(componentPath, ".mjs"),
  ];

  let allContent = "";
  for (const f of allFiles) {
    const c = readFile(f);
    if (c) allContent += "\n" + c;
  }

  // Check for imports from @lurk/shared-types or relative imports to shared-types
  const sharedTypesImport = /@lurk\/shared-types|shared-types|\.\.\/\.\.\/packages\/shared-types/i.test(allContent);
  findings.push({
    check: "Imports from shared-types",
    pass: sharedTypesImport,
    detail: sharedTypesImport ? "Found shared-types imports" : "No shared-types imports detected",
  });

  // Check package.json for shared-types dependency
  const pkg = readJson(path.join(componentPath, "package.json"));
  if (pkg) {
    const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    const hasSharedDep = "@lurk/shared-types" in allDeps;
    findings.push({
      check: "shared-types in package.json dependencies",
      pass: hasSharedDep,
      detail: hasSharedDep ? "Listed as dependency" : "Not listed in package.json",
    });
  }

  const score = findings.filter((f) => f.pass).length / Math.max(findings.length, 1);
  return { score, findings };
}

function evaluateErrorHandling(componentPath) {
  const findings = [];
  const allFiles = [
    ...listFiles(componentPath, ".ts"),
    ...listFiles(componentPath, ".tsx"),
    ...listFiles(componentPath, ".py"),
  ];

  let allContent = "";
  for (const f of allFiles) {
    const c = readFile(f);
    if (c) allContent += "\n" + c;
  }

  if (allContent.length === 0) {
    findings.push({ check: "Source files exist", pass: false, detail: "No source files to analyze" });
    return { score: 0, findings };
  }

  // Check for try/catch or try/except
  const hasTryCatch = /try\s*{[\s\S]*?catch|try:[\s\S]*?except/i.test(allContent);
  findings.push({
    check: "Try/catch error handling",
    pass: hasTryCatch,
    detail: hasTryCatch ? "Error handling blocks found" : "No try/catch or try/except blocks",
  });

  // Check for error response patterns
  const hasErrorResponse = /res\.status\(\d{3}\)|HttpException|HTTPException|status_code\s*=\s*[45]\d\d|\.error\(|throw new Error|raise\s+\w*Error/i.test(allContent);
  findings.push({
    check: "Error response patterns",
    pass: hasErrorResponse,
    detail: hasErrorResponse ? "Error responses found" : "No error response patterns",
  });

  // Check for logging
  const hasLogging = /console\.(log|error|warn)|logger\.|logging\.|import.*log/i.test(allContent);
  findings.push({
    check: "Logging present",
    pass: hasLogging,
    detail: hasLogging ? "Logging found" : "No logging statements",
  });

  const score = findings.filter((f) => f.pass).length / findings.length;
  return { score, findings };
}

// ---------------------------------------------------------------------------
// Specific file/function checks per component
// ---------------------------------------------------------------------------

function checkSpecificFiles(componentConfig) {
  const findings = [];
  if (!componentConfig.expected_files) return { score: 1, findings };

  let found = 0;
  const total = Object.keys(componentConfig.expected_files).length;

  for (const [filePattern, description] of Object.entries(componentConfig.expected_files)) {
    // Handle glob-like patterns
    if (filePattern.includes("**")) {
      const baseDir = path.join(componentConfig.path, filePattern.split("**")[0]);
      const ext = filePattern.includes(".") ? filePattern.split(".").pop() : null;
      const files = ext ? listFiles(baseDir, `.${ext}`) : listFiles(baseDir);
      const exists = files.length > 0;
      findings.push({
        check: `${filePattern}`,
        pass: exists,
        detail: exists ? `${files.length} files matching pattern` : `No files matching ${filePattern}`,
      });
      if (exists) found++;
    } else {
      // Handle wildcard extension: next.config.*
      if (filePattern.includes("*")) {
        const base = filePattern.replace("*", "");
        const dir = path.dirname(path.join(componentConfig.path, filePattern));
        const prefix = path.basename(base);
        const allInDir = listFiles(dir);
        const matched = allInDir.some((f) => path.basename(f).startsWith(prefix));
        findings.push({
          check: `${filePattern}`,
          pass: matched,
          detail: matched ? `Found matching file for ${filePattern}` : `No file matching ${filePattern}`,
        });
        if (matched) found++;
      } else {
        const exists = fileExists(path.join(componentConfig.path, filePattern));
        findings.push({
          check: `${filePattern}`,
          pass: exists,
          detail: exists ? description : `Missing: ${filePattern}`,
        });
        if (exists) found++;
      }
    }
  }

  const score = total > 0 ? found / total : 1;
  return { score, findings };
}

// ---------------------------------------------------------------------------
// Main component evaluator
// ---------------------------------------------------------------------------

function evaluateComponent(componentId, componentConfig, rubric) {
  const compPath = componentConfig.path;
  const dirExists = fs.existsSync(path.join(ROOT, compPath));

  if (!dirExists) {
    return {
      component: componentId,
      path: compPath,
      exists: false,
      scores: {},
      overall_score: 0,
      grade: "F",
      findings: [{ check: "Component directory exists", pass: false, detail: `Directory ${compPath} does not exist` }],
      recommendation: `Create the ${componentId} component at ${compPath} with the required structure.`,
    };
  }

  const isNodeComponent = componentConfig.technology.toLowerCase().includes("node") ||
                          componentConfig.technology.toLowerCase().includes("next") ||
                          componentConfig.technology.toLowerCase().includes("react") ||
                          componentConfig.technology.toLowerCase().includes("typescript");
  const isPythonComponent = componentConfig.technology.toLowerCase().includes("python");
  const isUIComponent = (componentConfig.evaluated_dimensions || []).includes("ux_quality");

  const allFindings = [];
  const scores = {};

  // --- code_quality ---
  if ((componentConfig.evaluated_dimensions || []).includes("code_quality")) {
    const subScores = [];
    const subFindings = [];

    if (isNodeComponent) {
      const pkgEval = evaluatePackageJson(compPath);
      subFindings.push(...pkgEval.findings);
      subScores.push(pkgEval.score);

      const tsEval = evaluateTypeScriptCompilability(compPath);
      subFindings.push(...tsEval.findings);
      subScores.push(tsEval.score);
    }

    if (isPythonComponent) {
      const pyEval = evaluatePythonCompilability(compPath);
      subFindings.push(...pyEval.findings);
      subScores.push(pyEval.score);
    }

    const errEval = evaluateErrorHandling(compPath);
    subFindings.push(...errEval.findings);
    subScores.push(errEval.score);

    const avg = subScores.length > 0 ? subScores.reduce((a, b) => a + b, 0) / subScores.length : 0;
    scores.code_quality = Math.round(avg * 10);
    allFindings.push(...subFindings.map((f) => ({ ...f, dimension: "code_quality" })));
  }

  // --- api_completeness ---
  if ((componentConfig.evaluated_dimensions || []).includes("api_completeness")) {
    const routeEval = evaluateApiRoutes(compPath, componentConfig.expected_routes || []);
    const fileEval = checkSpecificFiles(componentConfig);

    const avg = (routeEval.score + fileEval.score) / 2;
    scores.api_completeness = Math.round(avg * 10);
    allFindings.push(...routeEval.findings.map((f) => ({ ...f, dimension: "api_completeness" })));
    allFindings.push(...fileEval.findings.map((f) => ({ ...f, dimension: "api_completeness" })));
  }

  // --- security ---
  if ((componentConfig.evaluated_dimensions || []).includes("security")) {
    const authEval = evaluateFirebaseAuth(compPath);
    scores.security = Math.round(authEval.score * 10);
    allFindings.push(...authEval.findings.map((f) => ({ ...f, dimension: "security" })));
  }

  // --- test_coverage ---
  if ((componentConfig.evaluated_dimensions || []).includes("test_coverage")) {
    const testEval = evaluateTestCoverage(compPath);
    scores.test_coverage = Math.round(testEval.score * 10);
    allFindings.push(...testEval.findings.map((f) => ({ ...f, dimension: "test_coverage" })));
  }

  // --- integration ---
  if ((componentConfig.evaluated_dimensions || []).includes("integration")) {
    const subScores = [];
    const subFindings = [];

    if (isNodeComponent) {
      const stEval = evaluateSharedTypesIntegration(compPath);
      subFindings.push(...stEval.findings);
      subScores.push(stEval.score);
    }

    if (componentConfig.firestore_collections) {
      const fsEval = evaluateFirestoreCollections(compPath, componentConfig.firestore_collections);
      subFindings.push(...fsEval.findings);
      subScores.push(fsEval.score);
    }

    const dockerEval = evaluateDockerConfig(compPath);
    subFindings.push(...dockerEval.findings);
    subScores.push(dockerEval.score);

    const avg = subScores.length > 0 ? subScores.reduce((a, b) => a + b, 0) / subScores.length : 0;
    scores.integration = Math.round(avg * 10);
    allFindings.push(...subFindings.map((f) => ({ ...f, dimension: "integration" })));
  }

  // --- ux_quality ---
  if (isUIComponent) {
    const uiEval = evaluateUIComponents(compPath, componentConfig.required_features || []);
    scores.ux_quality = Math.round(uiEval.score * 10);
    allFindings.push(...uiEval.findings.map((f) => ({ ...f, dimension: "ux_quality" })));
  }

  // Calculate overall score
  const scoreValues = Object.values(scores);
  const overall = scoreValues.length > 0
    ? scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length
    : 0;

  // Grade
  const grade = overall >= 9 ? "A+"
    : overall >= 8 ? "A"
    : overall >= 7 ? "B+"
    : overall >= 6 ? "B"
    : overall >= 5 ? "C+"
    : overall >= 4 ? "C"
    : overall >= 3 ? "D"
    : overall >= 1 ? "F"
    : "N/A";

  // Generate recommendations
  const failedChecks = allFindings.filter((f) => !f.pass);
  const recommendations = [];
  if (scores.code_quality !== undefined && scores.code_quality < 5) {
    recommendations.push("Improve code quality: add proper types, error handling, and follow TypeScript/Python best practices.");
  }
  if (scores.api_completeness !== undefined && scores.api_completeness < 5) {
    recommendations.push("Implement missing API endpoints and expected file structures per PRD specification.");
  }
  if (scores.security !== undefined && scores.security < 5) {
    recommendations.push("Add Firebase Auth integration, input validation, and proper authorization checks.");
  }
  if (scores.test_coverage !== undefined && scores.test_coverage < 5) {
    recommendations.push("Add unit and integration tests with proper assertions.");
  }
  if (scores.integration !== undefined && scores.integration < 5) {
    recommendations.push("Integrate with shared-types package, reference correct Firestore collections, and add Docker/Cloud Run config.");
  }
  if (scores.ux_quality !== undefined && scores.ux_quality < 5) {
    recommendations.push("Build out UI components for all admin sections with Tailwind styling and accessibility attributes.");
  }

  return {
    component: componentId,
    path: compPath,
    exists: true,
    technology: componentConfig.technology,
    scores,
    overall_score: Math.round(overall * 10) / 10,
    grade,
    findings: allFindings,
    failed_checks: failedChecks.length,
    total_checks: allFindings.length,
    pass_rate: allFindings.length > 0 ? Math.round((1 - failedChecks.length / allFindings.length) * 100) : 0,
    recommendations,
  };
}

// ---------------------------------------------------------------------------
// DoD criteria evaluator
// ---------------------------------------------------------------------------

function evaluateDoDCriteria(dodCriteria, componentResults) {
  const results = [];

  for (const criterion of dodCriteria) {
    const criterionResult = {
      id: criterion.id,
      name: criterion.name,
      category: criterion.category,
      weight: criterion.weight,
      checks: [],
      pass: false,
      score: 0,
      detail: "",
    };

    // Map DoD criteria to component checks
    const checks = mapCriterionToChecks(criterion, componentResults);
    criterionResult.checks = checks;

    const passed = checks.filter((c) => c.pass).length;
    const total = checks.length;
    criterionResult.score = total > 0 ? Math.round((passed / total) * 100) : 0;
    criterionResult.pass = criterionResult.score >= 60; // 60% threshold for passing
    criterionResult.detail = `${passed}/${total} checks passed (${criterionResult.score}%)`;

    results.push(criterionResult);
  }

  return results;
}

function mapCriterionToChecks(criterion, componentResults) {
  const checks = [];
  const componentMap = {};
  for (const cr of componentResults) {
    componentMap[cr.component] = cr;
  }

  switch (criterion.id) {
    case "dod-01": // Mac Menu Bar Audio Capture
      checks.push(
        { name: "Mac app directory exists", pass: fileExists("apps/mac") },
        { name: "Swift source files present", pass: countFiles("apps/mac", ".swift") > 0 },
        { name: "CoreAudio references", pass: containsString("apps/mac", "CoreAudio", [".swift"]) },
        { name: "Whisper integration", pass: containsString("apps/mac", "whisper", [".swift", ".h", ".m"]) || fileExists("apps/mac/LurkTranscription") },
        { name: "Audio capture module", pass: fileExists("apps/mac/LurkAudioCapture") || containsString("apps/mac", "AudioCapture", [".swift"]) },
      );
      break;

    case "dod-02": // Chrome Extension Capture
      checks.push(
        { name: "Extension directory exists", pass: fileExists("apps/extension") },
        { name: "manifest.json exists", pass: fileExists("apps/extension/manifest.json") },
        { name: "Extension has source files", pass: countFiles("apps/extension", ".ts") + countFiles("apps/extension", ".tsx") + countFiles("apps/extension", ".js") > 0 },
        { name: "Native Messaging reference", pass: containsString("apps/extension", "nativeMessaging", [".ts", ".tsx", ".js", ".json"]) || containsString("apps/extension", "connectNative", [".ts", ".tsx", ".js"]) },
        { name: "DOM observer logic", pass: containsString("apps/extension", "MutationObserver", [".ts", ".tsx", ".js"]) || containsString("apps/extension", "observer", [".ts", ".tsx", ".js"]) },
        { name: "Google Docs target", pass: containsString("apps/extension", "docs.google.com", [".ts", ".tsx", ".js", ".json"]) },
        { name: "Gmail target", pass: containsString("apps/extension", "mail.google.com", [".ts", ".tsx", ".js", ".json"]) },
        { name: "Chrome extension component", pass: (componentMap["chrome-extension"]?.exists) || false },
      );
      break;

    case "dod-03": // iOS PR Review App
      checks.push(
        { name: "iOS app directory exists", pass: fileExists("apps/ios") },
        { name: "SwiftUI source files", pass: countFiles("apps/ios", ".swift") > 0 },
        { name: "PR review references", pass: containsString("apps/ios", "PullRequest", [".swift"]) || containsString("apps/ios", "PRReview", [".swift"]) },
        { name: "Swipe gesture references", pass: containsString("apps/ios", "swipe", [".swift"]) },
        { name: "Push notification references", pass: containsString("apps/ios", "UNNotification", [".swift"]) || containsString("apps/ios", "APNs", [".swift"]) },
      );
      break;

    case "dod-04": // PII Scrubbing and Ledger Sync
      checks.push(
        { name: "PII service exists", pass: (componentMap["pii-service"]?.exists) || false },
        { name: "PII service has source files", pass: countFiles("services/pii-service", ".py") > 0 },
        { name: "Regex detector patterns", pass: containsString("services/pii-service", "EMAIL", [".py"]) && containsString("services/pii-service", "PHONE", [".py"]) },
        { name: "NER detectors", pass: containsString("services/pii-service", "PERSON", [".py"]) || containsString("services/pii-service", "ner", [".py"]) },
        { name: "Shared types include PII types", pass: containsString("packages/shared-types", "PII", [".ts"]) || containsString("packages/shared-types", "redact", [".ts"]) },
        { name: "Ledger commit logic exists", pass: containsString("services/api-gateway", "commit", [".ts"]) || containsString("packages/shared-types", "CommitEntry", [".ts"]) },
        { name: "Firestore sync references", pass: containsString("services/api-gateway", "firestore", [".ts"]) || containsString("services/api-gateway", "Firestore", [".ts"]) },
      );
      break;

    case "dod-05": // Personal Agent with Sonnet
      checks.push(
        { name: "Agent orchestrator exists", pass: (componentMap["agent-orchestrator"]?.exists) || false },
        { name: "Agent orchestrator has source files", pass: countFiles("services/agent-orchestrator", ".py") > 0 },
        { name: "Personal agent implementation", pass: containsString("services/agent-orchestrator", "personal", [".py"]) },
        { name: "Sonnet model reference", pass: containsString("services/agent-orchestrator", "sonnet", [".py"]) || containsString("services/agent-orchestrator", "claude-sonnet", [".py"]) },
        { name: "Fork/PR creation logic", pass: containsString("services/agent-orchestrator", "fork", [".py"]) || containsString("services/agent-orchestrator", "pull_request", [".py"]) || containsString("services/agent-orchestrator", "PullRequest", [".py"]) },
        { name: "Staleness detection", pass: containsString("services/agent-orchestrator", "stale", [".py"]) },
        { name: "Agent SDK exists", pass: (componentMap["agent-sdk"]?.exists) || false },
      );
      break;

    case "dod-06": // Org Agent with Opus
      checks.push(
        { name: "Agent orchestrator exists", pass: (componentMap["agent-orchestrator"]?.exists) || false },
        { name: "Org agent implementation", pass: containsString("services/agent-orchestrator", "org", [".py"]) },
        { name: "Opus model reference", pass: containsString("services/agent-orchestrator", "opus", [".py"]) || containsString("services/agent-orchestrator", "claude-opus", [".py"]) },
        { name: "LLM gateway exists", pass: (componentMap["llm-gateway"]?.exists) || false },
        { name: "LLM gateway has model routing", pass: containsString("services/llm-gateway", "router", [".py"]) || containsString("services/llm-gateway", "route", [".py"]) },
        { name: "Anthropic SDK dependency", pass: containsString("services/llm-gateway", "anthropic", [".py", ".txt", ".toml"]) },
      );
      break;

    case "dod-07": // Voice Agent
      checks.push(
        { name: "Voice agent references", pass: containsString("services/agent-orchestrator", "voice", [".py"]) },
        { name: "Transcription processing", pass: containsString("services/agent-orchestrator", "transcript", [".py"]) || containsString("services/agent-orchestrator", "transcri", [".py"]) },
        { name: "Meeting summary generation", pass: containsString("services/agent-orchestrator", "summary", [".py"]) || containsString("services/agent-orchestrator", "meeting", [".py"]) },
        { name: "Prompt templates for meetings", pass: fileExists("prompts/meeting_summary") },
        { name: "call_summary artifact type", pass: containsString("packages/shared-types", "call_summary", [".ts"]) || containsString("services/agent-orchestrator", "call_summary", [".py"]) },
      );
      break;

    case "dod-08": // Calendar Agent
      checks.push(
        { name: "Calendar agent references", pass: containsString("services/agent-orchestrator", "calendar", [".py"]) },
        { name: "Calendar API integration", pass: containsString("services/agent-orchestrator", "calendar_api", [".py"]) || containsString("services/agent-orchestrator", "google.calendar", [".py"]) || containsString("services/agent-orchestrator", "calendar", [".py"]) },
        { name: "Cancellation logic", pass: containsString("services/agent-orchestrator", "cancel", [".py"]) },
        { name: "Calendar review prompt", pass: fileExists("prompts/calendar_review") },
        { name: "calendar_review artifact type", pass: containsString("packages/shared-types", "calendar_review", [".ts"]) || containsString("services/agent-orchestrator", "calendar_review", [".py"]) },
      );
      break;

    case "dod-09": // Customer Health Agent
      checks.push(
        { name: "Customer health agent references", pass: containsString("services/agent-orchestrator", "customer_health", [".py"]) || containsString("services/agent-orchestrator", "customerHealth", [".py"]) },
        { name: "Health score computation", pass: containsString("services/agent-orchestrator", "health_score", [".py"]) || containsString("services/agent-orchestrator", "healthScore", [".py"]) },
        { name: "Customer health prompt", pass: fileExists("prompts/customer_health") },
        { name: "Customer health Firestore collection", pass: containsString("services/api-gateway", "customerHealth", [".ts"]) || containsString("packages/shared-types", "customerHealth", [".ts"]) || containsString("packages/shared-types", "CustomerHealth", [".ts"]) },
        { name: "Health trend classification", pass: containsString("services/agent-orchestrator", "trend", [".py"]) || containsString("packages/shared-types", "trend", [".ts"]) },
      );
      break;

    case "dod-10": // YOLO Mode
      checks.push(
        { name: "YOLO references in agent orchestrator", pass: containsString("services/agent-orchestrator", "yolo", [".py"]) || containsString("services/agent-orchestrator", "YOLO", [".py"]) },
        { name: "YOLO config type", pass: containsString("packages/shared-types", "yolo", [".ts"]) || containsString("packages/shared-types", "Yolo", [".ts"]) || containsString("packages/shared-types", "YOLO", [".ts"]) },
        { name: "Auto-merge logic", pass: containsString("services/agent-orchestrator", "auto_merge", [".py"]) || containsString("services/agent-orchestrator", "autoMerge", [".py"]) || containsString("services/api-gateway", "autoMerge", [".ts"]) },
        { name: "YOLO policy in policy engine", pass: containsString("packages/policy-engine", "yolo", [".ts"]) || containsString("packages/policy-engine", "YOLO", [".ts"]) },
        { name: "YOLO in web admin", pass: containsString("apps/web", "yolo", [".ts", ".tsx"]) || containsString("apps/web", "YOLO", [".ts", ".tsx"]) },
      );
      break;

    case "dod-11": // PR Voice Narration
      checks.push(
        { name: "TTS service exists", pass: (componentMap["tts-service"]?.exists) || false },
        { name: "TTS service has source files", pass: countFiles("services/tts-service", ".py") > 0 },
        { name: "OpenAI TTS reference", pass: containsString("services/tts-service", "openai", [".py", ".txt", ".toml"]) || containsString("services/tts-service", "tts", [".py"]) },
        { name: "Voice narration URL in PR type", pass: containsString("packages/shared-types", "voiceNarration", [".ts"]) || containsString("packages/shared-types", "voice_narration", [".ts"]) },
        { name: "GCS storage for audio", pass: containsString("services/tts-service", "storage", [".py"]) || containsString("services/tts-service", "gcs", [".py"]) || containsString("services/tts-service", "bucket", [".py"]) },
      );
      break;

    case "dod-12": // Slack Migration
      checks.push(
        { name: "Migration service exists", pass: (componentMap["migration-service"]?.exists) || false },
        { name: "Migration service has source files", pass: countFiles("services/migration-service", ".py") > 0 },
        { name: "Slack importer", pass: containsString("services/migration-service", "slack", [".py"]) },
        { name: "Browserbase integration", pass: containsString("services/migration-service", "browserbase", [".py", ".txt", ".toml"]) },
        { name: "Migration pipeline logic", pass: containsString("services/migration-service", "pipeline", [".py"]) || containsString("services/migration-service", "migrate", [".py"]) },
        { name: "Migration types in shared-types", pass: containsString("packages/shared-types", "migration", [".ts"]) || containsString("packages/shared-types", "Migration", [".ts"]) },
        { name: "Rollback capability", pass: containsString("services/migration-service", "rollback", [".py"]) },
      );
      break;

    case "dod-13": // Agent Marketplace
      checks.push(
        { name: "Agent templates in shared types", pass: containsString("packages/shared-types", "AgentTemplate", [".ts"]) || containsString("packages/shared-types", "agentTemplate", [".ts"]) },
        { name: "Marketplace UI in web admin", pass: containsString("apps/web", "marketplace", [".ts", ".tsx"]) || containsString("apps/web", "Marketplace", [".ts", ".tsx"]) },
        { name: "Agent builder references", pass: containsString("apps/web", "builder", [".ts", ".tsx"]) || containsString("apps/web", "Builder", [".ts", ".tsx"]) },
        { name: "Agent SDK package exists", pass: (componentMap["agent-sdk"]?.exists) || false },
        { name: "Agent SDK has source files", pass: countFiles("packages/agent-sdk", ".ts") > 0 },
        { name: "7+ template types referenced", pass: containsString("services/agent-orchestrator", "personal", [".py"]) && containsString("services/agent-orchestrator", "voice", [".py"]) },
        { name: "Agent builder prompt templates", pass: fileExists("prompts/agent_builder") },
      );
      break;

    case "dod-14": // Local-Only Mode
      checks.push(
        { name: "Local-only mode references", pass: containsString("packages/shared-types", "localOnly", [".ts"]) || containsString("packages/shared-types", "local_only", [".ts"]) || containsString("apps/web", "local", [".ts", ".tsx"]) },
        { name: "Network toggle references", pass: containsString("apps/extension", "offline", [".ts", ".tsx", ".js"]) || containsString("apps/extension", "localOnly", [".ts", ".tsx", ".js"]) || containsString("packages/shared-types", "offline", [".ts"]) },
        { name: "Feature flag for local-only", pass: containsString("packages/shared-types", "local_only_mode", [".ts"]) || containsString("apps/web", "local_only", [".ts", ".tsx"]) || containsString("apps/web", "localOnly", [".ts", ".tsx"]) },
      );
      break;

    case "dod-15": // Kill Switches
      checks.push(
        { name: "Kill switch types defined", pass: containsString("packages/shared-types", "kill", [".ts"]) || containsString("packages/shared-types", "Kill", [".ts"]) },
        { name: "Kill switch UI in admin", pass: containsString("apps/web", "kill", [".ts", ".tsx"]) || containsString("apps/web", "Kill", [".ts", ".tsx"]) },
        { name: "org_global_kill reference", pass: containsString("packages/shared-types", "org_global_kill", [".ts"]) || containsString("apps/web", "global_kill", [".ts", ".tsx"]) || containsString("packages/shared-types", "globalKill", [".ts"]) },
        { name: "Kill switch API endpoints", pass: containsString("services/api-gateway", "kill", [".ts"]) || containsString("services/api-gateway", "Kill", [".ts"]) },
        { name: "Kill switches in org schema", pass: containsString("packages/shared-types", "killSwitch", [".ts"]) || containsString("packages/shared-types", "kill_switch", [".ts"]) },
      );
      break;

    case "dod-16": // Privacy Regression Tests
      checks.push(
        { name: "Privacy test files exist", pass: searchFiles(".", /privacy.*test|test.*privacy|pii.*test|test.*pii/i, [".ts", ".py"]).length > 0 },
        { name: "Network traffic validation tests", pass: containsString(".", "no raw text", [".test.ts", ".test.py", ".spec.ts"]) || searchFiles(".", /raw.*text.*leave|network.*pii|privacy.*regression/i, [".ts", ".py"]).length > 0 },
        { name: "PII service has tests", pass: countFiles("services/pii-service", ".py") > 0 && (listFiles("services/pii-service", ".py").some((f) => f.includes("test"))) },
        { name: "Redaction verification references", pass: searchFiles(".", /redact.*verif|verify.*redact/i, [".ts", ".py"]).length > 0 },
      );
      break;

    case "dod-17": // PII Detection >95% Recall
      checks.push(
        { name: "PII service exists with detectors", pass: countFiles("services/pii-service", ".py") > 0 },
        { name: "Regex detectors implemented", pass: containsString("services/pii-service", "regex", [".py"]) || containsString("services/pii-service", "pattern", [".py"]) },
        { name: "NER detectors implemented", pass: containsString("services/pii-service", "ner", [".py"]) || containsString("services/pii-service", "NER", [".py"]) || containsString("services/pii-service", "spacy", [".py"]) },
        { name: "Presidio integration", pass: containsString("services/pii-service", "presidio", [".py", ".txt", ".toml"]) },
        { name: "Test dataset or test harness", pass: listFiles("services/pii-service", ".py").some((f) => f.includes("test")) || containsString("services/pii-service", "recall", [".py"]) },
      );
      break;

    case "dod-18": // Cross-Org Federation
      checks.push(
        { name: "Federation types defined", pass: containsString("packages/shared-types", "federation", [".ts"]) || containsString("packages/shared-types", "Federation", [".ts"]) },
        { name: "ACL resolver handles federation", pass: containsString("packages/acl-resolver", "federation", [".ts"]) || countFiles("packages/acl-resolver", ".ts") > 0 },
        { name: "Federation API endpoints", pass: containsString("services/api-gateway", "federation", [".ts"]) },
        { name: "Redaction level configuration", pass: containsString("packages/shared-types", "redactionLevel", [".ts"]) || containsString("packages/shared-types", "redaction_level", [".ts"]) },
        { name: "Federation kill switch", pass: containsString("packages/shared-types", "federation_kill", [".ts"]) || containsString("packages/shared-types", "federationKill", [".ts"]) },
      );
      break;

    case "dod-19": // Comprehensive Audit Logs
      checks.push(
        { name: "Audit service exists", pass: (componentMap["audit-service"]?.exists) || false },
        { name: "Audit service has source files", pass: countFiles("services/audit-service", ".ts") > 0 },
        { name: "BigQuery integration", pass: containsString("services/audit-service", "bigquery", [".ts", ".json"]) || containsString("services/audit-service", "BigQuery", [".ts"]) },
        { name: "Audit types in shared-types", pass: containsString("packages/shared-types", "audit", [".ts"]) || containsString("packages/shared-types", "Audit", [".ts"]) },
        { name: "Lineage tracking references", pass: containsString("services/audit-service", "lineage", [".ts"]) || containsString("packages/shared-types", "lineage", [".ts"]) },
        { name: "Audit UI in web admin", pass: containsString("apps/web", "audit", [".ts", ".tsx"]) || containsString("apps/web", "Audit", [".ts", ".tsx"]) },
      );
      break;

    case "dod-20": // Performance at Scale
      checks.push(
        { name: "Cloud Run configuration exists", pass: fileExists("infra/terraform") },
        { name: "Rate limiting implemented", pass: containsString("services/api-gateway", "rate", [".ts"]) || containsString("services/api-gateway", "rateLimit", [".ts"]) },
        { name: "Auto-scaling references", pass: containsString("infra", "autoscal", [".tf", ".yaml", ".json"]) || containsString("infra", "max_instances", [".tf", ".yaml", ".json"]) },
        { name: "Performance test config", pass: searchFiles(".", /load.*test|perf.*test|k6|artillery|locust/i, [".ts", ".py", ".yaml", ".json", ".js"]).length > 0 },
        { name: "Health check endpoint", pass: containsString("services/api-gateway", "health", [".ts"]) },
      );
      break;

    default:
      checks.push({ name: `Unknown criterion: ${criterion.id}`, pass: false });
  }

  return checks;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function runEvaluation() {
  const startTime = Date.now();

  // Load criteria and rubric
  const dodPath = path.join(import.meta.dirname, "criteria", "definition-of-done.json");
  const rubricPath = path.join(import.meta.dirname, "criteria", "component-rubric.json");

  const dod = JSON.parse(fs.readFileSync(dodPath, "utf-8"));
  const rubric = JSON.parse(fs.readFileSync(rubricPath, "utf-8"));

  // Evaluate each component
  const componentResults = [];
  for (const [componentId, componentConfig] of Object.entries(rubric.components)) {
    const result = evaluateComponent(componentId, componentConfig, rubric);
    componentResults.push(result);
  }

  // Evaluate DoD criteria
  const dodResults = evaluateDoDCriteria(dod.criteria, componentResults);

  // Calculate summary statistics
  const totalComponents = componentResults.length;
  const existingComponents = componentResults.filter((c) => c.exists).length;
  const passingComponents = componentResults.filter((c) => c.overall_score >= 5).length;

  const totalDodCriteria = dodResults.length;
  const passingDodCriteria = dodResults.filter((d) => d.pass).length;

  const overallComponentScore = componentResults.length > 0
    ? componentResults.reduce((sum, c) => sum + c.overall_score, 0) / componentResults.length
    : 0;

  const overallDodScore = dodResults.length > 0
    ? dodResults.reduce((sum, d) => sum + d.score, 0) / dodResults.length
    : 0;

  // Weighted DoD score (using criterion weight)
  const totalWeight = dodResults.reduce((sum, d) => {
    const crit = dod.criteria.find((c) => c.id === d.id);
    return sum + (crit?.weight || 5);
  }, 0);
  const weightedDodScore = dodResults.reduce((sum, d) => {
    const crit = dod.criteria.find((c) => c.id === d.id);
    return sum + (d.score * (crit?.weight || 5));
  }, 0) / totalWeight;

  // Beta readiness determination
  const criticalCriteriaPassing = dodResults
    .filter((d) => {
      const crit = dod.criteria.find((c) => c.id === d.id);
      return (crit?.weight || 0) >= 9;
    })
    .every((d) => d.pass);

  const betaReady = passingDodCriteria >= 16 && criticalCriteriaPassing && overallComponentScore >= 6;

  const elapsedMs = Date.now() - startTime;

  return {
    metadata: {
      evaluator: "Lurk Customer Agent v1.0.0",
      prd_version: "3.0.0",
      evaluated_at: new Date().toISOString(),
      elapsed_ms: elapsedMs,
      root_path: ROOT,
    },
    summary: {
      beta_ready: betaReady,
      overall_component_score: Math.round(overallComponentScore * 10) / 10,
      overall_dod_score: Math.round(overallDodScore * 10) / 10,
      weighted_dod_score: Math.round(weightedDodScore * 10) / 10,
      components_total: totalComponents,
      components_existing: existingComponents,
      components_passing: passingComponents,
      dod_criteria_total: totalDodCriteria,
      dod_criteria_passing: passingDodCriteria,
      grade: betaReady ? "BETA READY" : overallComponentScore >= 5 ? "IN PROGRESS" : "EARLY STAGE",
    },
    components: componentResults,
    definition_of_done: dodResults,
    recommendations: generateTopRecommendations(componentResults, dodResults, dod.criteria),
  };
}

function generateTopRecommendations(componentResults, dodResults, dodCriteria) {
  const recs = [];

  // Missing components
  const missingComponents = componentResults.filter((c) => !c.exists);
  if (missingComponents.length > 0) {
    recs.push({
      priority: "CRITICAL",
      area: "Missing Components",
      detail: `${missingComponents.length} components have no code: ${missingComponents.map((c) => c.component).join(", ")}`,
      action: "Create directory structure and implement core files for each missing component.",
    });
  }

  // Failing critical DoD criteria
  const failingCritical = dodResults.filter((d) => {
    const crit = dodCriteria.find((c) => c.id === d.id);
    return !d.pass && (crit?.weight || 0) >= 9;
  });
  if (failingCritical.length > 0) {
    for (const fc of failingCritical) {
      recs.push({
        priority: "HIGH",
        area: `DoD: ${fc.name}`,
        detail: `Critical criterion failing: ${fc.detail}`,
        action: `Address failing checks: ${fc.checks.filter((c) => !c.pass).map((c) => c.name).join("; ")}`,
      });
    }
  }

  // Low-scoring components
  const lowScoring = componentResults.filter((c) => c.exists && c.overall_score < 5).sort((a, b) => a.overall_score - b.overall_score);
  for (const ls of lowScoring.slice(0, 5)) {
    recs.push({
      priority: "MEDIUM",
      area: `Component: ${ls.component}`,
      detail: `Score: ${ls.overall_score}/10 (Grade: ${ls.grade})`,
      action: ls.recommendations.join(" "),
    });
  }

  // Failing non-critical DoD criteria
  const failingNonCritical = dodResults.filter((d) => {
    const crit = dodCriteria.find((c) => c.id === d.id);
    return !d.pass && (crit?.weight || 0) < 9;
  });
  for (const fnc of failingNonCritical.slice(0, 5)) {
    recs.push({
      priority: "LOW",
      area: `DoD: ${fnc.name}`,
      detail: fnc.detail,
      action: `Address: ${fnc.checks.filter((c) => !c.pass).map((c) => c.name).slice(0, 3).join("; ")}`,
    });
  }

  return recs;
}
