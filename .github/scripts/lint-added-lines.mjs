#!/usr/bin/env node
/**
 * Fails only on ESLint problems sitting on lines this pull request added.
 *
 * The gate used to lint whole changed files. That reads well until a change
 * is broad rather than deep: a repository-wide restyling touches the files
 * with the most backlog in them and inherits every problem already there,
 * none of which it caused. Measuring added lines asks the question the gate
 * was always meant to ask — did this change make things worse — instead of
 * asking who last touched the file.
 *
 * Usage: node .github/scripts/lint-added-lines.mjs <base-sha>
 */

import { execFileSync } from 'node:child_process';
import path from 'node:path';

const base = process.argv[2];
if (!base) {
  console.error('usage: lint-added-lines.mjs <base-sha>');
  process.exit(2);
}

const git = (...args) =>
  execFileSync('git', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });

// Match with a regex rather than a git pathspec: git globs let a single "*"
// cross a "/", so a pathspec would quietly widen the selection.
const files = git('diff', '--name-only', '--diff-filter=ACMR', base, 'HEAD')
  .split('\n')
  .filter((f) => /^frontend\/src\/.*\.tsx?$/.test(f));

if (files.length === 0) {
  console.log('No frontend source files changed.');
  process.exit(0);
}

/** file -> Set of line numbers the diff adds, read from unified=0 hunks. */
const addedLines = new Map();
// No pathspec here, and that is deliberate. Limiting the diff to the new paths
// stops git pairing a renamed file with its old path, so it reports the whole
// file as added and every pre-existing problem in it counts as new. The loop
// below filters by path instead, which keeps rename detection intact.
const diff = git(
  'diff',
  '--unified=0',
  '--find-renames',
  '--diff-filter=ACMR',
  base,
  'HEAD',
);

let current = null;
for (const line of diff.split('\n')) {
  const header = /^\+\+\+ b\/(.+)$/.exec(line);
  if (header) {
    current = header[1];
    addedLines.set(current, new Set());
    continue;
  }
  // @@ -old,count +new,count @@ — a missing count means exactly one line.
  const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line);
  if (hunk && current) {
    const start = Number(hunk[1]);
    const count = hunk[2] === undefined ? 1 : Number(hunk[2]);
    for (let i = 0; i < count; i += 1) addedLines.get(current).add(start + i);
  }
}

// ESLint exits non-zero whenever it finds an error, which throws here — but
// the JSON we want is on stdout either way, so the throw is a status code, not
// a failure to read.
let stdout;
try {
  stdout = execFileSync(
    'yarn',
    [
      'workspace',
      'frontend',
      'exec',
      'eslint',
      '--format',
      'json',
      ...files.map((f) => f.replace(/^frontend\//, '')),
    ],
    {
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'inherit'],
    },
  );
} catch (e) {
  if (typeof e.stdout !== 'string' || e.stdout === '') throw e;
  stdout = e.stdout;
}

const report = JSON.parse(stdout);

let errors = 0;
let warnings = 0;

for (const result of report) {
  const relative = path.relative(process.cwd(), result.filePath);
  const lines = addedLines.get(relative);
  if (!lines) continue;

  for (const m of result.messages) {
    // A message with no line (a parse failure, say) is about the whole file,
    // so it cannot be attributed to the backlog and always counts.
    if (m.line !== undefined && !lines.has(m.line)) continue;
    const severity = m.severity === 2 ? 'error' : 'warning';
    if (m.severity === 2) errors += 1;
    else warnings += 1;
    console.log(
      `${relative}:${m.line ?? '?'}:${m.column ?? '?'}  ${severity}  ${m.message}  ${m.ruleId ?? ''}`,
    );
  }
}

const scanned = files.length;
if (errors === 0 && warnings === 0) {
  console.log(`No problems on lines added across ${scanned} changed file(s).`);
  process.exit(0);
}

console.log(`\n${errors} error(s), ${warnings} warning(s) on added lines.`);
process.exit(errors > 0 ? 1 : 0);
