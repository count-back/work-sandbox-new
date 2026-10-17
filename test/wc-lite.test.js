'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { count, formatRow, run } = require('../lib/wc-lite.js');

const BIN = path.join(__dirname, '..', 'bin', 'wc-lite.js');
const ROOT = path.join(__dirname, '..');

/** Create a capture object for run()'s stdout/stderr. */
function capture() {
  return {
    output: '',
    write(chunk) {
      this.output += chunk;
      return true;
    },
  };
}

/** Run the real CLI with the given args, from the repo root. */
function cli(args) {
  return spawnSync(process.execPath, [BIN, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
  });
}

test('count: empty string', () => {
  assert.deepEqual(count(''), { lines: 0, words: 0, chars: 0 });
});

test('count: text without trailing newline', () => {
  assert.deepEqual(count('hello world'), { lines: 0, words: 2, chars: 11 });
});

test('count: lines equal to number of newlines', () => {
  assert.deepEqual(count('a\nb\n'), { lines: 2, words: 2, chars: 4 });
  assert.deepEqual(count('a\nb'), { lines: 1, words: 2, chars: 3 });
  assert.deepEqual(count('\n\n\n'), { lines: 3, words: 0, chars: 3 });
});

test('count: consecutive whitespace, tabs and newlines', () => {
  assert.deepEqual(count('  foo\t\tbar\n\n  baz  '), {
    lines: 2,
    words: 3,
    chars: 19,
  });
  assert.deepEqual(count('   \t \n  '), { lines: 1, words: 0, chars: 8 });
});

test('count: unicode code points for Chinese and emoji', () => {
  assert.deepEqual(count('你好'), { lines: 0, words: 1, chars: 2 });
  // '😀' is a single code point but two UTF-16 code units.
  assert.deepEqual(count('😀'), { lines: 0, words: 1, chars: 1 });
  assert.deepEqual(count('a😀b'), { lines: 0, words: 1, chars: 3 });
});

test('formatRow: tab separated', () => {
  assert.equal(formatRow({ lines: 1, words: 2, chars: 3 }, 'file.txt'), '1\t2\t3\tfile.txt');
});

test('run: no arguments prints usage to stderr and returns 2', () => {
  const stdout = capture();
  const stderr = capture();
  const code = run([], { stdout, stderr });
  assert.equal(code, 2);
  assert.equal(stdout.output, '');
  assert.equal(stderr.output, 'Usage: wc-lite <file...>\n');
});

test('run: single file has no total line', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wc-lite-'));
  try {
    const file = path.join(dir, 'one.txt');
    fs.writeFileSync(file, 'alpha beta\ngamma\n');
    const stdout = capture();
    const stderr = capture();
    const code = run([file], { stdout, stderr });
    assert.equal(code, 0);
    assert.equal(stderr.output, '');
    assert.equal(stdout.output, `2\t3\t17\t${file}\n`);
    assert.ok(!stdout.output.includes('total'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('run: multiple files prints a correct total line', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wc-lite-'));
  try {
    const a = path.join(dir, 'a.txt');
    const b = path.join(dir, 'b.txt');
    fs.writeFileSync(a, 'one two\nthree\n'); // lines 2, words 3, chars 14
    fs.writeFileSync(b, 'four'); // lines 0, words 1, chars 4
    const stdout = capture();
    const stderr = capture();
    const code = run([a, b], { stdout, stderr });
    assert.equal(code, 0);
    assert.equal(stderr.output, '');
    const lines = stdout.output.split('\n');
    assert.equal(lines[0], `2\t3\t14\t${a}`);
    assert.equal(lines[1], `0\t1\t4\t${b}`);
    assert.equal(lines[2], '2\t4\t18\ttotal');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('run: missing file writes stderr, returns 1, keeps processing others', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wc-lite-'));
  try {
    const good = path.join(dir, 'good.txt');
    const missing = path.join(dir, 'does-not-exist.txt');
    fs.writeFileSync(good, 'hello world\n');
    const stdout = capture();
    const stderr = capture();
    const code = run([missing, good], { stdout, stderr });
    assert.equal(code, 1);
    assert.match(stderr.output, /^wc-lite: /);
    assert.ok(stderr.output.includes(missing));
    assert.equal(stdout.output.split('\n')[0], `1\t2\t12\t${good}`);
    assert.ok(stdout.output.includes('total'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('run: directory as input is reported as an error', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wc-lite-'));
  try {
    const stdout = capture();
    const stderr = capture();
    const code = run([dir], { stdout, stderr });
    assert.equal(code, 1);
    assert.ok(stderr.output.includes(dir));
    assert.equal(stdout.output, '');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('cli: counts a real file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wc-lite-'));
  try {
    const file = path.join(dir, 'cli.txt');
    fs.writeFileSync(file, 'foo bar\nbaz\n');
    const res = cli([file]);
    assert.equal(res.status, 0);
    assert.equal(res.stderr, '');
    assert.equal(res.stdout, `2\t3\t12\t${file}\n`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('cli: multiple files include total', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wc-lite-'));
  try {
    const a = path.join(dir, 'a.txt');
    const b = path.join(dir, 'b.txt');
    fs.writeFileSync(a, 'aa bb\n');
    fs.writeFileSync(b, 'cc dd\n');
    const res = cli([a, b]);
    assert.equal(res.status, 0);
    assert.equal(res.stderr, '');
    assert.equal(
      res.stdout,
      `1\t2\t6\t${a}\n1\t2\t6\t${b}\n2\t4\t12\ttotal\n`,
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('cli: no arguments exits with 2', () => {
  const res = cli([]);
  assert.equal(res.status, 2);
  assert.equal(res.stdout, '');
  assert.equal(res.stderr, 'Usage: wc-lite <file...>\n');
});

test('cli: missing file exits with 1 and reports to stderr', () => {
  const missing = path.join(os.tmpdir(), 'wc-lite-does-not-exist-xyz.txt');
  const res = cli([missing]);
  assert.equal(res.status, 1);
  assert.match(res.stderr, /^wc-lite: /);
  assert.ok(res.stderr.includes(missing));
});

test('cli: can count README.md when present', () => {
  const readme = path.join(ROOT, 'README.md');
  if (!fs.existsSync(readme)) {
    return;
  }
  const res = cli(['README.md']);
  assert.equal(res.status, 0);
  assert.equal(res.stderr, '');
  assert.match(res.stdout, /\d+\t\d+\t\d+\tREADME\.md\n$/);
});
