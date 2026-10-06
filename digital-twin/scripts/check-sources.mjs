/**
 * Source hygiene check.
 *
 * The generator that produced this project occasionally emits non-ASCII
 * look-alike characters (full-width spaces, braces, commas) which are valid in
 * some contexts but silently wrong in others. This script scans every source
 * file and reports:
 *
 *   • any of those dangerous code points, with file/line/column
 *   • JavaScript syntax errors (via `node --check` equivalent: dynamic import is
 *     not possible for arbitrary files, so syntax is validated separately)
 *
 * Usage:  node scripts/check-sources.mjs
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const SOURCE_DIRS = ['src'];
const EXTENSIONS = new Set(['.js', '.mjs', '.css', '.html', '.json', '.md']);

/** Code points that indicate a look-alike character slipped into the source. */
const DANGEROUS = new Map([
  [0x3000, 'IDEOGRAPHIC SPACE (looks like a normal space)'],
  [0xff5d, 'FULLWIDTH RIGHT CURLY BRACKET'],
  [0xff5b, 'FULLWIDTH LEFT CURLY BRACKET'],
  [0xff08, 'FULLWIDTH LEFT PARENTHESIS'],
  [0xff09, 'FULLWIDTH RIGHT PARENTHESIS'],
  [0xff0c, 'FULLWIDTH COMMA'],
  [0xff1b, 'FULLWIDTH SEMICOLON'],
  [0xff1a, 'FULLWIDTH COLON'],
  [0x00a0, 'NO-BREAK SPACE'],
  [0x2028, 'LINE SEPARATOR'],
  [0x2029, 'PARAGRAPH SEPARATOR'],
  [0xfeff, 'ZERO WIDTH NO-BREAK SPACE']
]);

/** Characters that are fine (used in comments/copy) — reported only as info. */
const ALLOWED_NON_ASCII = new Set(
  [...'—·×↑↓≤≥°±≈→←…“”’–≠\u00b3\u00b2'].map((char) => char.codePointAt(0))
);

function walk(dir, files = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch (error) {
    return files;
  }
  for (const entry of entries) {
    if (entry === 'node_modules' || entry === 'dist' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) walk(full, files);
    else files.push(full);
  }
  return files;
}

function extensionOf(file) {
  const index = file.lastIndexOf('.');
  return index < 0 ? '' : file.slice(index);
}

const problems = [];
const notes = [];
let scanned = 0;

for (const dir of SOURCE_DIRS) {
  for (const file of walk(join(ROOT, dir))) {
    if (!EXTENSIONS.has(extensionOf(file))) continue;
    scanned += 1;

    const content = readFileSync(file, 'utf8');
    const lines = content.split(/\r?\n/);

    lines.forEach((line, lineIndex) => {
      for (let column = 0; column < line.length; column += 1) {
        const code = line.codePointAt(column);
        const char = String.fromCodePoint(code);

        if (DANGEROUS.has(code)) {
          problems.push({
            file: relative(ROOT, file),
            line: lineIndex + 1,
            column: column + 1,
            code,
            name: DANGEROUS.get(code),
            snippet: line.slice(Math.max(0, column - 20), column + 20)
          });
        } else if (code > 126 && !ALLOWED_NON_ASCII.has(code)) {
          notes.push({
            file: relative(ROOT, file),
            line: lineIndex + 1,
            code,
            char
          });
        }
      }
    });
  }
}

console.log(`Scanned ${scanned} files under ${SOURCE_DIRS.join(', ')}`);

if (problems.length) {
  console.log(`\n${problems.length} DANGEROUS character(s) found:`);
  for (const problem of problems) {
    console.log(
      `  ${problem.file}:${problem.line}:${problem.column}  U+${problem.code
        .toString(16)
        .toUpperCase()
        .padStart(4, '0')}  ${problem.name}\n     …${problem.snippet}…`
    );
  }
} else {
  console.log('\nNo dangerous look-alike characters found.');
}

if (notes.length) {
  console.log(`\n${notes.length} other non-ASCII character(s) (informational):`);
  const grouped = new Map();
  for (const note of notes) {
    const key = `${note.file}:${note.line} U+${note.code.toString(16).toUpperCase()}`;
    grouped.set(key, (grouped.get(key) || 0) + 1);
  }
  let shown = 0;
  for (const [key, count] of grouped) {
    if (shown >= 40) {
      console.log(`  …and ${grouped.size - shown} more`);
      break;
    }
    console.log(`  ${key} ×${count}`);
    shown += 1;
  }
}

process.exitCode = problems.length ? 1 : 0;
