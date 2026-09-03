#!/usr/bin/env node
/**
 * Verifies that every relative link in the project's markdown files resolves.
 *
 * Links starting with `/` are reported as errors: GitHub resolves them against the
 * site root (github.com/...), not the repository root, so they 404 in the web UI
 * even though they look correct. Use paths relative to the containing document.
 *
 * Usage: yarn docs:check-links
 */
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const SKIP = /(^|\/)(node_modules|\.git|\.next|logs)(\/|$)|oracleJdk/;

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (SKIP.test(path.relative(REPO, full))) continue;
    if (entry.isDirectory()) walk(full, out);
    else if (/\.md$/i.test(entry.name)) out.push(full);
  }
  return out;
}

let checked = 0;
const problems = [];

for (const file of walk(REPO)) {
  // Strip fenced code blocks — links inside them are examples, not navigation.
  const body = fs.readFileSync(file, 'utf8').replace(/^```[\s\S]*?^```/gm, '');
  const rel = path.relative(REPO, file);

  body.split('\n').forEach((line, i) => {
    for (const match of line.matchAll(/\]\(([^)\s]+)\)/g)) {
      const link = match[1];
      if (/^(https?:|mailto:|#)/.test(link)) continue;

      const target = link.split('#')[0];
      if (!target) continue;
      checked++;

      if (link.startsWith('/')) {
        problems.push(
          `${rel}:${i + 1}  ${link}\n    leading slash — GitHub resolves this against github.com, not the repo root`,
        );
        continue;
      }
      if (!fs.existsSync(path.resolve(path.dirname(file), target))) {
        problems.push(`${rel}:${i + 1}  ${link}\n    target does not exist`);
      }
    }
  });
}

if (problems.length) {
  console.error(
    `\n${problems.length} broken link(s) out of ${checked} checked:\n`,
  );
  problems.forEach((p) => console.error('  ' + p + '\n'));
  process.exit(1);
}

console.log(`All ${checked} relative markdown links resolve.`);
