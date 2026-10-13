#!/usr/bin/env node
// Builds what a language host serves: the hub's text, then the language repository's glossary rules, then its explicit entries.
//   node build/overlay.mjs [--spoke <language repository>] --out <folder> [--hub <hub folder, default: this repository>]
// Names and dropdown values (code names) are never stored in a language repository: they are computed here, so a change to the glossary reaches all of them.
// The language tag comes from the spoke's text.config.json. Nothing is read from or written to the hub or the spoke.
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const hub = resolve(arg('hub', join(dirname(fileURLToPath(import.meta.url)), '..')));
// without --spoke: the hub's own language, the ISO English (build/en has only the language tag)
const spoke = resolve(arg('spoke', join(hub, 'build', 'en')));
const out = resolve(arg('out'));
const read = (f) => JSON.parse(readFileSync(f, 'utf8'));
const lang = read(join(spoke, 'text.config.json')).lang;
const glossaryFile = join(spoke, 'glossary.json');
const glossary = existsSync(glossaryFile) ? read(glossaryFile) : {};

const keepCase = (from, to) => {
  if (from.length > 1 && from === from.toUpperCase()) return to.toUpperCase();
  return from[0] === from[0].toUpperCase() && from[0] !== from[0].toLowerCase() ? to[0].toUpperCase() + to.slice(1) : to;
};
const TOKEN = /[A-Z]+(?![a-z])|[A-Z]?[a-z]+/g;
const CAMEL_NAME = /\b[A-Z][a-z0-9]+(?:[A-Z][a-z0-9]+)+\b/g;

/**
 * Applies the glossary in one pass over the original text: at each place a phrase (longest first), else a word, else a stem. Text that a rule has
 * written is never read again, so a translated word cannot be matched by a rule meant for the English word. A CamelCase name inside prose is an ISO
 * name, not a word: it is left alone.
 */
const phraseKey = (p) => p.toLowerCase().replace(/\s+/g, ' ');
const phraseTo = new Map((glossary.phrases ?? []).map(({ phrase, to }) => [phraseKey(phrase), to]));
const phraseOrder = [...phraseTo.keys()].sort((a, b) => b.split(' ').length - a.split(' ').length || b.length - a.length);
const escapeRe = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const PHRASE = phraseOrder.length
  ? new RegExp(`(?<![A-Za-z])(?:${phraseOrder.map((p) => p.split(' ').map(escapeRe).join('\\s+')).join('|')})(?![a-z])|${TOKEN.source}`, 'gi')
  : TOKEN;
function applyGlossary(text, keepCamelCase) {
  // a {placeholder} is code, not a word: it is set aside and put back
  const holes = [];
  const masked = text.replace(/\{\w+\}/g, (m) => `\u0001${holes.push(m) - 1}\u0001`);
  return applyMasked(masked, keepCamelCase).replace(/\u0001(\d+)\u0001/g, (_, i) => holes[Number(i)]);
}
function applyMasked(text, keepCamelCase) {
  if (keepCamelCase) {
    const kept = [];
    const masked = text.replace(CAMEL_NAME, (m) => `\u0000${kept.push(m) - 1}\u0000`);
    return applyMasked(masked, false).replace(/\u0000(\d+)\u0000/g, (_, i) => kept[Number(i)]);
  }
  return text.replace(PHRASE, (m) => {
    const phrase = phraseTo.get(phraseKey(m));
    if (phrase !== undefined) return keepCase(m, phrase);
    const lower = m.toLowerCase();
    const word = glossary.words?.[lower];
    if (word !== undefined) return keepCase(m, word);
    for (const s of glossary.stems ?? []) {
      if (lower.startsWith(s.from) && new RegExp(`^(${s.suffixes})$`).test(lower.slice(s.from.length))) return keepCase(m, s.to + lower.slice(s.from.length));
    }
    return m;
  });
}

// `applyTo` says where the rules apply: "names" (type, element and code names: the display names and dropdown values) and "texts" (definitions and
// formats). A regional language applies both; a translation applies only "names", because its definitions are translated and listed as exceptions.
const applyTo = glossary.applyTo ?? ['names', 'texts'];
const rewrite = (entry) => {
  if (entry.name !== undefined && applyTo.includes('names')) entry.name = applyGlossary(entry.name, false);
  if (entry.definition !== undefined && applyTo.includes('texts')) entry.definition = applyGlossary(entry.definition, true);
  if (entry.format !== undefined && applyTo.includes('texts')) entry.format = applyGlossary(entry.format, true);
};

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const d of ['types', 'messages']) cpSync(join(hub, d), join(out, d), { recursive: true });
cpSync(join(hub, 'coverage.json'), join(out, 'coverage.json'));

let rewritten = 0, explicit = 0;
const typesDir = join(out, 'types');
for (const letter of readdirSync(typesDir)) for (const file of readdirSync(join(typesDir, letter))) {
  const path = join(typesDir, letter, file);
  const full = read(path);
  full.language = lang;
  const sameLanguage = JSON.stringify(full);
  rewrite(full);
  for (const map of ['isoElements', 'isoCodes', 'isoRules']) for (const e of Object.values(full[map] ?? {})) rewrite(e);
  const over = existsSync(join(spoke, 'types', letter, file)) ? read(join(spoke, 'types', letter, file)) : undefined;
  if (over) {
    for (const k of ['name', 'definition', 'format']) if (over[k] !== undefined) { full[k] = over[k]; explicit++; }
    for (const map of ['isoElements', 'isoCodes', 'isoRules']) for (const [key, o] of Object.entries(over[map] ?? {})) {
      for (const k of ['name', 'definition']) if (o[k] !== undefined) { full[map][key][k] = o[k]; explicit++; }
    }
  }
  if (JSON.stringify(full) !== sameLanguage) rewritten++;
  writeFileSync(path, JSON.stringify(full, null, 2) + '\n');
}
// The text of the tools that use this text (tools/<tool>/<name>.json: key -> text). The base is the hub's; a language repository lists only the keys it changes.
// The glossary applies to it only where `applyTo` has "tools" (a regional language: spelling).
const toolsDir = join(hub, 'tools');
let toolTexts = 0;
if (existsSync(toolsDir)) for (const tool of readdirSync(toolsDir)) for (const file of readdirSync(join(toolsDir, tool))) {
  const text = read(join(toolsDir, tool, file));
  if (applyTo.includes('tools')) for (const [k, v] of Object.entries(text)) text[k] = applyGlossary(v, true);
  const overFile = join(spoke, 'tools', tool, file);
  if (existsSync(overFile)) for (const [k, v] of Object.entries(read(overFile))) if (k in text) { text[k] = v; toolTexts++; }
  mkdirSync(join(out, 'tools', tool), { recursive: true });
  writeFileSync(join(out, 'tools', tool, file), JSON.stringify(text, null, 2) + '\n');
}
// The business areas (pain, pacs, ...): ISO's own names and definitions, treated like the names and definitions of types.
if (existsSync(join(hub, 'areas.json'))) {
  const areas = read(join(hub, 'areas.json'));
  for (const e of Object.values(areas.isoAreas)) rewrite(e);
  const overFile = join(spoke, 'areas.json');
  if (existsSync(overFile)) for (const [code, o] of Object.entries(read(overFile).isoAreas ?? {})) if (areas.isoAreas[code]) for (const k of ['name', 'definition']) if (o[k] !== undefined) { areas.isoAreas[code][k] = o[k]; explicit++; }
  writeFileSync(join(out, 'areas.json'), JSON.stringify(areas, null, 2) + '\n');
}
console.log(`${lang}: ${rewritten} type files differ from the hub, ${explicit} texts set by explicit entries, ${toolTexts} tool texts set by the language`);
