#!/usr/bin/env node
// Builds a text host: the files a static host serves for one language, at the paths of the convention (no file extensions).
//   node build/build.mjs [--spoke <language repository>] --out <folder>
//   /{TypeName}  /messages  /areas  /coverage  /manifest  /_headers
// (`/id/{repositoryId}` is not built yet: the hub does not carry repository ids.)
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const out = resolve(arg('out'));
const hub = resolve(arg('hub', join(here, '..')));
// without --spoke: the hub's own language, the ISO English
const spoke = resolve(arg('spoke', join(hub, 'build', 'en')));
const read = (f) => JSON.parse(readFileSync(f, 'utf8'));
const write = (path, value) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, JSON.stringify(value, null, 2) + '\n'); };

const work = mkdtempSync(join(tmpdir(), 'text-host-'));
const text = execFileSync('node', [join(here, 'overlay.mjs'), '--hub', hub, '--spoke', spoke, '--out', work], { encoding: 'utf8' });
const lang = read(join(spoke, 'text.config.json')).lang;
const coverage = read(join(work, 'coverage.json'));

rmSync(out, { recursive: true, force: true });
const types = {};
for (const letter of readdirSync(join(work, 'types'))) for (const file of readdirSync(join(work, 'types', letter))) {
  const t = read(join(work, 'types', letter, file));
  types[t.isoType] = t;
  write(join(out, t.isoType), t);
}
// a message has no text of its own: its name is that of its root type, without the version ("Customer Credit Transfer Initiation"), and its description is the root type's definition
const isoMessages = {};
for (const [identifier, { isoType }] of Object.entries(read(join(work, 'messages.json')).isoMessages)) {
  const root = types[isoType];
  if (!root) throw new Error(`message ${identifier}: root type ${isoType} is not in types/`);
  isoMessages[identifier] = { isoType, name: root.name.replace(/\s+V\s*\d+$/, '') };
}
// /messages: every message's name, for a list to choose from; /areas: the business areas
write(join(out, 'messages'), { isoMessages: Object.fromEntries(Object.entries(isoMessages).sort(([a], [b]) => a.localeCompare(b))) });
if (existsSync(join(work, 'areas.json'))) write(join(out, 'areas'), read(join(work, 'areas.json')));

// tools/{tool}/{name}: the text of the apps that use this text (not ISO text)
const tools = {};
for (const tool of existsSync(join(work, 'tools')) ? readdirSync(join(work, 'tools')) : []) {
  tools[tool] = [];
  for (const file of readdirSync(join(work, 'tools', tool))) {
    const name = file.replace(/\.json$/, '');
    write(join(out, 'tools', tool, name), read(join(work, 'tools', tool, file)));
    tools[tool].push(name);
  }
}
write(join(out, 'coverage'), { complete: coverage.complete, messages: Object.keys(isoMessages).sort(), types: Object.keys(types).length, ...(Object.keys(tools).length ? { tools } : {}) });

const files = [];
const walk = (d) => readdirSync(d, { withFileTypes: true }).forEach((e) => (e.isDirectory() ? walk(join(d, e.name)) : files.push(join(d, e.name))));
walk(out);
const release = createHash('sha256').update(files.sort().map((f) => readFileSync(f, 'utf8')).join('\n')).digest('hex').slice(0, 16);
write(join(out, 'manifest'), { language: lang, release, source: coverage.source, convention: 'v0' });
writeFileSync(join(out, '_headers'), `/*\n  Content-Type: application/json; charset=utf-8\n  Access-Control-Allow-Origin: *\n  Cache-Control: public, max-age=300, stale-while-revalidate=86400\n`);
rmSync(work, { recursive: true, force: true });
console.log(`${text.trim()}\nhost for ${lang}: ${readdirSync(out).length} paths in ${out}, release ${release}`);
