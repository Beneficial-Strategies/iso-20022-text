#!/usr/bin/env node
// Writes the text of ISO's business domain into the hub: one type file per business component, with its business attributes (`isoAttributes`)
// and business associations (`isoAssociations`). Reads the ISO 20022 repository file (the `.iso20022` eRepository, download it from iso20022.org).
//   node build/domain.mjs --repository <file.iso20022> [--hub <hub folder>] [--check]
// --check writes nothing: it says what would change (exit code 1 if anything would). Definitions are ISO's, word for word (a line break is `|`);
// a `name` is the ISO name broken into words, as for every other type. Obsolete items are not published. A name that is already a type of another
// kind (not a business component) stops the run: names are unique across kinds (SPECIFICATION.md, "The business domain").
import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const repository = arg('repository');
const hub = resolve(arg('hub', join(dirname(fileURLToPath(import.meta.url)), '..')));
const check = process.argv.includes('--check');
const DOMAIN_KEYS = new Set(['isoType', 'language', 'name', 'definition', 'isoAttributes', 'isoAssociations']); // what a business component's file has; anything else is another kind of type

/** The ISO name broken into words: at camel case, and between letters and digits (`ISODateTime` is "ISO Date Time", `BranchData5` is "Branch Data 5"). */
export const words = (n) => n
  .replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])(?!\d)/g, '$1 $2')
  .replace(/([A-Za-z])(\d)/g, '$1 $2').replace(/(\d)([A-Za-z])/g, '$1 $2');

export const unescapeXml = (s) => s.replace(/&(#x[0-9A-Fa-f]+|#\d+|quot|amp|lt|gt|apos);/g, (_, e) =>
  e[0] === '#' ? String.fromCodePoint(e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : { quot: '"', amp: '&', lt: '<', gt: '>', apos: "'" }[e]);
export const text = (s) => unescapeXml(s).replace(/\r\n|\r|\n/g, '|').replace(/^[|\s]+|[|\s]+$/g, '');
const attr = (line, name) => { const m = line.match(new RegExp(`\\s${name}="([^"]*)"`)); return m ? m[1] : undefined; };

if (import.meta.url === `file://${process.argv[1]}`) {
  if (!repository) { console.error('usage: node build/domain.mjs --repository <file.iso20022> [--hub <hub folder>] [--check]'); process.exit(2); }
  const components = [];
  let current;
  for await (const line of createInterface({ input: createReadStream(repository, 'utf8'), crlfDelay: Infinity })) {
    if (line.includes('<topLevelDictionaryEntry')) {
      current = undefined;
      if (!line.includes('xsi:type="iso20022:BusinessComponent"')) continue;
      const name = attr(line, 'name'), status = attr(line, 'registrationStatus');
      if (status === 'Obsolete') continue;
      current = { isoType: name, language: 'en', name: words(name), definition: text(attr(line, 'definition') ?? ''), isoAttributes: {}, isoAssociations: {} };
      components.push(current);
    } else if (current && line.includes('<element ')) {
      const kind = line.match(/xsi:type="iso20022:(BusinessAttribute|BusinessAssociationEnd)"/)?.[1];
      if (!kind || attr(line, 'registrationStatus') === 'Obsolete') continue;
      const name = attr(line, 'name'), definition = attr(line, 'definition');
      const map = kind === 'BusinessAttribute' ? current.isoAttributes : current.isoAssociations;
      if (name in map) throw new Error(`${current.isoType}: two ${kind} named ${name}`);
      map[name] = { name: words(name), ...(definition ? { definition: text(definition) } : {}) };
    } else if (line.includes('</topLevelDictionaryEntry>')) current = undefined;
  }

  let changed = 0, attributes = 0, associations = 0, noDefinition = 0;
  const seen = new Set();
  for (const c of components) {
    if (seen.has(c.isoType)) throw new Error(`the business component ${c.isoType} occurs twice`);
    seen.add(c.isoType);
    const file = join(hub, 'types', c.isoType[0].toUpperCase(), `${c.isoType}.json`);
    if (existsSync(file)) {
      const old = JSON.parse(readFileSync(file, 'utf8'));
      if (Object.keys(old).some((k) => !DOMAIN_KEYS.has(k))) throw new Error(`${c.isoType} is already a type of another kind (${file}); names must be unique across kinds`);
    }
    for (const m of ['isoAttributes', 'isoAssociations']) if (!Object.keys(c[m]).length) delete c[m];
    if (!c.definition) noDefinition++;
    attributes += Object.keys(c.isoAttributes ?? {}).length;
    associations += Object.keys(c.isoAssociations ?? {}).length;
    const json = JSON.stringify(c, null, 2) + '\n';
    if (existsSync(file) && readFileSync(file, 'utf8') === json) continue;
    changed++;
    if (!check) { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, json); }
  }
  console.log(`${components.length} business components, ${attributes} attributes, ${associations} associations; ${check ? 'would write' : 'wrote'} ${changed} files${noDefinition ? `; ${noDefinition} components have no definition` : ''}`);
  process.exit(check && changed ? 1 : 0);
}
