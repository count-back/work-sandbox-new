'use strict';

const fs = require('fs');

/**
 * Count lines, words and characters in a string.
 *
 * - lines: number of '\n' characters (a trailing line without a newline is not
 *   counted), matching the behavior of wc.
 * - words: number of non-empty segments after splitting on whitespace.
 * - chars: number of Unicode code points (not UTF-16 code units).
 *
 * @param {string} text
 * @returns {{lines: number, words: number, chars: number}}
 */
function count(text) {
  let lines = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === '\n') {
      lines += 1;
    }
  }

  const words = text.split(/\s+/).filter((part) => part.length > 0).length;
  const chars = [...text].length;

  return { lines, words, chars };
}

/**
 * Format a count row using tab separators.
 *
 * @param {{lines: number, words: number, chars: number}} counts
 * @param {string} name
 * @returns {string}
 */
function formatRow(counts, name) {
  return `${counts.lines}\t${counts.words}\t${counts.chars}\t${name}`;
}

/**
 * CLI main logic.
 *
 * @param {string[]} argv - arguments after the script name
 * @param {{stdout: {write: Function}, stderr: {write: Function}}} io
 * @returns {number} process exit code
 */
function run(argv, io) {
  const stdout = io.stdout;
  const stderr = io.stderr;

  if (argv.length === 0) {
    stderr.write('Usage: wc-lite <file...>\n');
    return 2;
  }

  let failed = false;
  let totalLines = 0;
  let totalWords = 0;
  let totalChars = 0;

  for (const file of argv) {
    let text;
    try {
      text = fs.readFileSync(file, 'utf8');
    } catch (err) {
      stderr.write(`wc-lite: ${file}: ${err.message}\n`);
      failed = true;
      continue;
    }

    const counts = count(text);
    stdout.write(`${formatRow(counts, file)}\n`);
    totalLines += counts.lines;
    totalWords += counts.words;
    totalChars += counts.chars;
  }

  if (argv.length >= 2) {
    stdout.write(
      `${formatRow(
        { lines: totalLines, words: totalWords, chars: totalChars },
        'total',
      )}\n`,
    );
  }

  return failed ? 1 : 0;
}

module.exports = { count, formatRow, run };
