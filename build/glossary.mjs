#!/usr/bin/env node
// The glossary of a language: which words occur in the names, and which of them the language's glossary does not cover yet.
//   node build/glossary.mjs vocabulary [--hub <hub folder>]                       every word of the names, with how often and an example
//   node build/glossary.mjs missing --spoke <language repository> [--hub <hub>]   the words its glossary.json does not cover (exit code 1 if any)
// A word is covered when the glossary has it under `words`, in a phrase, as an inflection of a stem, or under `keep` (a word the language leaves as it is).
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const hub = resolve(arg('hub', join(dirname(fileURLToPath(import.meta.url)), '..')));
const read = (f) => JSON.parse(readFileSync(f, 'utf8'));

/** word (lower case) -> { count, example } over the name of every type, element and code in the hub. */
function vocabulary() {
  const words = new Map();
  const add = (name) => {
    for (const w of name.split(/\s+/)) {
      if (!/[A-Za-z]/.test(w)) continue; // numbers are never translated
      const key = w.toLowerCase();
      const v = words.get(key) ?? words.set(key, { count: 0, example: name }).get(key);
      v.count++;
    }
  };
  const dir = join(hub, 'types');
  for (const letter of readdirSync(dir)) for (const file of readdirSync(join(dir, letter))) {
    const t = read(join(dir, letter, file));
    if (t.name) add(t.name); // a type whose name two items share has an `ambiguous` list and no name
    for (const map of ['isoElements', 'isoCodes', 'isoAttributes', 'isoAssociations']) for (const e of Object.values(t[map] ?? {})) add(e.name);
  }
  return words;
}

const cmd = process.argv[2];
if (cmd === 'vocabulary') {
  for (const [w, v] of [...vocabulary()].sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]))) console.log(`${w}\t${v.count}\t${v.example}`);
} else if (cmd === 'missing') {
  const file = join(resolve(arg('spoke')), 'glossary.json');
  const g = existsSync(file) ? read(file) : {};
  const covered = new Set([...Object.keys(g.words ?? {}), ...(g.keep ?? []).map((w) => w.toLowerCase())]);
  for (const { phrase } of g.phrases ?? []) for (const w of phrase.toLowerCase().split(/\s+/)) covered.add(w);
  const stemmed = (w) => (g.stems ?? []).some((s) => w.startsWith(s.from) && new RegExp(`^(${s.suffixes})$`).test(w.slice(s.from.length)));
  const missing = [...vocabulary()].filter(([w]) => !covered.has(w) && !stemmed(w));
  for (const [w, v] of missing.sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]))) console.log(`${w}\t${v.count}\t${v.example}`);
  console.error(`${missing.length} of ${vocabulary().size} words are not in the glossary`);
  process.exit(missing.length ? 1 : 0);
} else {
  console.error('usage: glossary.mjs vocabulary | missing --spoke <language repository> [--hub <hub folder>]');
  process.exit(2);
}
