#!/usr/bin/env node
// What the hub should publish, from the ISO 20022 repository file, and what of it is missing.
//   node build/coverage.mjs --repository <file.iso20022> [--hub <hub folder>] [--list missing|target] [--check] [--write]
// The target: the latest registered version of every message, any provisionally registered version newer than it, every type those messages use however deep
// (components, choices, code sets, data types), and every business component. --check exits 1 when something of the target is missing from the hub.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readRepository } from './repository.mjs';

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };

/** The messages to publish: per message (identifier without version), its latest registered version, and each provisional version newer than that. */
export function targetMessages(messages) {
  const byBase = new Map();
  for (const m of messages) (byBase.get(m.base) ?? byBase.set(m.base, []).get(m.base)).push(m);
  const target = [];
  for (const versions of byBase.values()) {
    versions.sort((a, b) => a.version - b.version);
    const registered = versions.filter((m) => m.status === 'Registered');
    const latest = registered.at(-1);
    for (const m of versions) if (m.status !== 'Obsolete' && (!latest || m.version >= latest.version)) target.push(m);
  }
  return target;
}

/** Every type (by id) that the messages use, however deep. */
export function descendants(types, messages) {
  const seen = new Set(), stack = [];
  const visit = (id) => { if (id && types.has(id) && !seen.has(id)) { seen.add(id); stack.push(id); } };
  for (const m of messages) for (const b of m.blocks) { visit(b.complexType); visit(b.simpleType); visit(b.type); }
  while (stack.length) for (const e of types.get(stack.pop()).elements) { visit(e.type); visit(e.simpleType); visit(e.complexType); }
  return seen;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const repository = arg('repository');
  if (!repository) { console.error('usage: node build/coverage.mjs --repository <file.iso20022> [--hub <hub folder>] [--list missing|target] [--check]'); process.exit(2); }
  const hub = resolve(arg('hub', join(dirname(fileURLToPath(import.meta.url)), '..')));
  const { types, messages } = await readRepository(repository);

  const target = targetMessages(messages);
  const used = descendants(types, target);
  const wanted = new Map(); // type name -> kind
  for (const id of used) wanted.set(types.get(id).name, types.get(id).kind);
  for (const m of target) wanted.set(m.name, 'MessageDefinition'); // a message's text is that of its root type, named for the message definition
  for (const t of types.values()) if (t.kind === 'BusinessComponent') wanted.set(t.name, t.kind);

  const have = new Set();
  const dir = join(hub, 'types');
  for (const letter of readdirSync(dir)) for (const file of readdirSync(join(dir, letter))) have.add(file.replace(/\.json$/, ''));
  const hubMessages = JSON.parse(readFileSync(join(hub, 'messages.json'), 'utf8')).isoMessages;

  const missingMessages = target.filter((m) => !(m.identifier in hubMessages));
  const missingTypes = [...wanted].filter(([n]) => !have.has(n));
  const kinds = (pairs) => Object.entries(pairs.reduce((c, [, k]) => (c[k] = (c[k] ?? 0) + 1, c), {})).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(', ');
  const provisionalNewer = target.filter((m) => m.status !== 'Registered');

  console.log(`ISO repository: ${messages.length} message definitions of ${new Set(messages.map((m) => m.base)).size} messages, ${types.size} dictionary entries`);
  console.log(`target: ${target.length} messages (${provisionalNewer.length} provisional newer than the latest registered), ${wanted.size} types (${used.size} used by them, ${target.length} message root types, and the business components)`);
  console.log(`hub: ${Object.keys(hubMessages).length} messages, ${have.size} types`);
  console.log(`missing: ${missingMessages.length} messages, ${missingTypes.length} types${missingTypes.length ? ` (${kinds(missingTypes)})` : ''}`);
  const extraMessages = Object.keys(hubMessages).filter((id) => !target.some((m) => m.identifier === id));
  console.log(`in the hub but not in the target: ${extraMessages.length} messages${extraMessages.length ? ` (${extraMessages.slice(0, 5).join(', ')}${extraMessages.length > 5 ? ', ...' : ''})` : ''}`);
  if (process.argv.includes('--write')) {
    const path = join(hub, 'coverage.json');
    const coverage = JSON.parse(readFileSync(path, 'utf8'));
    coverage.complete = !missingMessages.length && !missingTypes.length;
    writeFileSync(path, JSON.stringify(coverage, null, 2) + '\n');
    console.log(`coverage.json: complete ${coverage.complete}`);
  }
  const list = arg('list');
  if (list === 'missing') { for (const m of missingMessages) console.log(`message\t${m.identifier}\t${m.name}\t${m.status}`); for (const [n, k] of missingTypes) console.log(`type\t${n}\t${k}`); }
  if (list === 'target') for (const m of target) console.log(`message\t${m.identifier}\t${m.name}\t${m.status}`);
  process.exit(process.argv.includes('--check') && (missingMessages.length || missingTypes.length) ? 1 : 0);
}
