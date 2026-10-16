#!/usr/bin/env node
// Writes the text of types and messages from the ISO 20022 repository file into the hub: `types/<first letter>/<Type>.json`, in the form SPECIFICATION.md describes.
//   node build/types.mjs --repository <file.iso20022> --snapshot <spec-snapshot.tsv> [--hub <hub folder>] [--verify | --write-missing]
// --verify    regenerates every type the hub already has and compares it with the file (exit code 1 on a difference): the proof that this script says what the hub says
// --write-missing   writes the target types (build/coverage.mjs) that the hub lacks, and adds the target messages to messages.json
// Definitions are ISO's, word for word, `|` for a line break; `name` is the ISO name broken into words. The code values of a code set are not in the repository file's
// derived code sets: they come from the snapshot (`CODE` records: code set, id, value, status, ..., definition).
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readRepository } from './repository.mjs';
import { descendants, targetMessages } from './coverage.mjs';
import { text, words } from './domain.mjs';
import { formatOf } from './format.mjs';

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const COMPONENTS = new Set(['MessageComponent', 'ChoiceComponent']);

/** code set name -> Map(code id -> { value, definition }) from the snapshot's CODE records. */
export function readCodes(snapshotFile) {
  const byCodeSet = new Map();
  for (const line of readFileSync(snapshotFile, 'utf8').split('\n')) {
    if (!line.startsWith('CODE\t')) continue;
    const f = line.split('\t');
    (byCodeSet.get(f[1]) ?? byCodeSet.set(f[1], new Map()).get(f[1])).set(f[2], { value: f[3], status: f[4], definition: f.slice(6).join('\t') });
  }
  return byCodeSet;
}

const named = (name, definition) => ({ name: words(name), ...(definition ? { definition: text(definition) } : {}) });
const rulesOf = (constraints) => {
  const rules = {};
  for (const c of constraints) if (c.status !== 'Obsolete') rules[c.name] = { definition: text(c.definition ?? '') };
  return rules;
};

/** The hub's file for one dictionary entry or message definition. `format` of a data type is added by formatOf (build/format.mjs) when it exists. */
export function typeFile(t, ctx) {
  const out = { isoType: t.name, language: 'en', name: words(t.name), definition: text(t.definition ?? '') };
  if (t.blocks) { // a message definition: its building blocks are its elements
    out.isoElements = Object.fromEntries(t.blocks.map((b) => [b.name, named(b.name, b.definition)]));
  } else if (COMPONENTS.has(t.kind)) {
    out.isoElements = Object.fromEntries(t.elements.filter((e) => e.status !== 'Obsolete').map((e) => [e.name, named(e.name, e.definition)]));
  } else if (t.kind === 'CodeSet' && t.codes.length) {
    const values = ctx.codes.get(t.name) ?? new Map();
    const codes = {};
    for (const c of t.codes) {
      const v = values.get(c.id);
      const value = c.codeName ?? v?.value;
      if (value === undefined) continue;
      codes[value] = { isoName: c.name, ...named(c.name, c.definition ?? v?.definition) };
    }
    if (Object.keys(codes).length) out.isoCodes = codes;
  }
  if (out.isoElements && !Object.keys(out.isoElements).length) delete out.isoElements;
  const rules = rulesOf(t.constraints ?? []);
  if (Object.keys(rules).length) out.isoRules = rules;
  if (ctx.format && !COMPONENTS.has(t.kind) && t.kind !== 'CodeSet' && !t.blocks) { const f = ctx.format(t); if (f) out.format = f; }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const repository = arg('repository'), snapshot = arg('snapshot');
  if (!repository || !snapshot) { console.error('usage: node build/types.mjs --repository <file.iso20022> --snapshot <spec-snapshot.tsv> [--hub <hub folder>] [--verify | --write-missing]'); process.exit(2); }
  const hub = resolve(arg('hub', join(dirname(fileURLToPath(import.meta.url)), '..')));
  const { types, messages } = await readRepository(repository);
  const ctx = { codes: readCodes(snapshot), format: formatOf };
  const byName = new Map();
  for (const t of types.values()) (byName.get(t.name) ?? byName.set(t.name, []).get(t.name)).push(t);
  for (const m of messages) if (!byName.has(m.name)) byName.set(m.name, [m]);

  if (process.argv.includes('--write-missing') || process.argv.includes('--repair')) {
    const target = targetMessages(messages);
    const used = descendants(types, target);
    const entries = new Map(); // name -> [entries]
    for (const id of used) { const t = types.get(id); (entries.get(t.name) ?? entries.set(t.name, []).get(t.name)).push(t); }
    for (const m of target) (entries.get(m.name) ?? entries.set(m.name, []).get(m.name)).push(m);
    const ambiguous = [...entries].filter(([, list]) => list.length > 1).map(([n]) => n);
    const file = (name) => join(hub, 'types', name[0].toUpperCase(), `${name}.json`);
    const write = (name, json) => { mkdirSync(dirname(file(name)), { recursive: true }); writeFileSync(file(name), JSON.stringify(json, null, 2) + '\n'); };
    let written = 0, repaired = 0, rulesAdded = 0, definitionsFilled = 0; const ambiguousWritten = [];

    if (process.argv.includes('--write-missing')) {
      for (const [name, list] of entries) {
        if (existsSync(file(name))) continue;
        if (list.length > 1) { // one name for several items (SPECIFICATION.md, "Names that are not unique"): the resource lists them, each reachable by repository id
          write(name, { isoType: name, language: 'en', ambiguous: list.map((t) => ({ id: t.id, definition: text(t.definition ?? '') })) });
          written++; ambiguousWritten.push(name); continue;
        }
        write(name, typeFile(list[0], ctx)); written++;
      }
      const path = join(hub, 'messages.json');
      const current = JSON.parse(readFileSync(path, 'utf8'));
      let added = 0;
      for (const m of target) if (!(m.identifier in current.isoMessages)) { current.isoMessages[m.identifier] = { isoType: m.name }; added++; }
      current.isoMessages = Object.fromEntries(Object.entries(current.isoMessages).sort(([a], [b]) => a.localeCompare(b)));
      writeFileSync(path, JSON.stringify(current, null, 2) + '\n');
      console.log(`wrote ${written} type files and ${added} entries of messages.json${ambiguousWritten.length ? `; with an ambiguous list (the name occurs twice in the repository): ${ambiguousWritten.join(', ')}` : ''}`);
    }

    if (process.argv.includes('--repair')) {
      // Two repairs of files the hub already has. A message's building blocks had an empty definition; data types and code sets lacked the rules ISO gives them.
      for (const [name, list] of entries) {
        if (!existsSync(file(name)) || list.length > 1) continue;
        const have = JSON.parse(readFileSync(file(name), 'utf8'));
        if (have.isoAttributes || have.isoAssociations) continue;
        const want = typeFile(list[0], ctx);
        let changed = false;
        for (const [k, e] of Object.entries(have.isoElements ?? {})) if (e.definition === '' && want.isoElements?.[k]?.definition) { e.definition = want.isoElements[k].definition; definitionsFilled++; changed = true; }
        if (!have.isoRules && want.isoRules && !list[0].blocks && !COMPONENTS.has(list[0].kind)) { have.isoRules = want.isoRules; rulesAdded += Object.keys(want.isoRules).length; changed = true; }
        if (changed) { write(name, have); repaired++; }
      }
      console.log(`repaired ${repaired} files: ${definitionsFilled} empty definitions filled, ${rulesAdded} rules added`);
    }
    process.exit(0);
  }

  if (process.argv.includes('--verify')) {
    const stats = {}, examples = {};
    for (const letter of readdirSync(join(hub, 'types'))) for (const file of readdirSync(join(hub, 'types', letter))) {
      const have = JSON.parse(readFileSync(join(hub, 'types', letter, file), 'utf8'));
      const sources = byName.get(have.isoType);
      if (!sources) { stats.unknown = (stats.unknown ?? 0) + 1; continue; }
      if (sources[0].kind === 'BusinessComponent') continue;
      const want = typeFile(sources[0], ctx);
      delete want.format; delete have.format; delete have.ambiguous;
      const kind = sources[0].kind ?? 'MessageDefinition';
      const ok = JSON.stringify(sortKeys(want)) === JSON.stringify(sortKeys(have));
      const k = `${kind} ${ok ? 'same' : 'differs'}`;
      stats[k] = (stats[k] ?? 0) + 1;
      if (!ok && (examples[kind]?.length ?? 0) < 2) (examples[kind] ??= []).push({ name: have.isoType, want, have });
    }
    console.log(stats);
    if (process.argv.includes('--examples')) for (const [k, list] of Object.entries(examples)) for (const e of list) console.log(`\n== ${k} ${e.name}\nwant ${JSON.stringify(e.want).slice(0, 700)}\nhave ${JSON.stringify(e.have).slice(0, 700)}`);
    process.exit(Object.keys(stats).some((k) => k.endsWith('differs') || k === 'unknown') ? 1 : 0);
  }
}

function sortKeys(o) {
  if (Array.isArray(o)) return o.map(sortKeys);
  if (o && typeof o === 'object') return Object.fromEntries(Object.keys(o).sort().map((k) => [k, sortKeys(o[k])]));
  return o;
}
