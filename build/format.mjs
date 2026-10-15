// The `format` of a data type: the text that says what a value must look like, written once, in English, from the facts ISO publishes for the type
// (its pattern, length limits and digit limits). See SPECIFICATION.md, "format". Where a pattern cannot be put into words, the text says only what can be said.
import { attr } from './repository.mjs';

const unescape = (s) => s.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&apos;/g, "'").replace(/&#xA;/g, '\n').replace(/&#xD;/g, '\r');

// patterns that have a name in the real world and an example, written by hand
const KNOWN = new Map([
  ['[A-Z0-9]{4,4}[A-Z]{2,2}[A-Z0-9]{2,2}([A-Z0-9]{3,3}){0,1}', 'Not a valid BIC (8 or 11 characters). Expected: 4 uppercase letters or digits, then 2 uppercase letters, then 2 uppercase letters or digits, then optionally 3 uppercase letters or digits. Example: DEUTDEFF / DEUTDEFF500'],
  ['[A-Z]{2,2}[0-9]{2,2}[a-zA-Z0-9]{1,30}', 'Not a valid IBAN. Expected: 2 uppercase letters, then 2 digits, then 1 to 30 letters or digits. Example: DE89370400440532013000'],
  ['[A-Z0-9]{18,18}[0-9]{2,2}', 'Not a valid LEI (20 characters). Expected: 18 uppercase letters or digits, then 2 digits. Example: 529900T8BM49AURSDO55'],
  ['(\\+|-)?[\\d]{1,3}(\\.[\\d]{1,8})?/(\\+|-)?[\\d]{1,3}(\\.[\\d]{1,8})?', 'Required format is a latitude and a longitude in decimal degrees, separated by "/": each with an optional sign, 1 to 3 digits, and optionally a decimal point with 1 to 8 digits. Example: +48.8566/+2.3522'],
]);

// ---- a pattern, as a small tree --------------------------------------------------------------------------------------------------------------------------
function parse(p) {
  let i = 0;
  const alternatives = () => { const alts = [sequence()]; while (p[i] === '|') { i++; alts.push(sequence()); } return alts; };
  const sequence = () => {
    const items = [];
    while (i < p.length && p[i] !== '|' && p[i] !== ')') {
      const atom = p[i] === '(' ? group() : p[i] === '[' ? charClass() : p[i] === '.' ? (i++, { type: 'any' }) : p.startsWith('\\d', i) ? (i += 2, { type: 'class', members: [{ ch: '\\d' }] }) : { type: 'lit', ch: literal() };
      const q = quantifier();
      items.push({ atom, ...q });
    }
    return items;
  };
  const group = () => { i++; if (p.startsWith('?:', i)) i += 2; const alts = alternatives(); if (p[i] !== ')') throw new Error('unbalanced'); i++; return { type: 'group', alts }; };
  const literal = () => { if (p[i] === '\\') { i++; const c = p[i++]; return c === 'd' ? '\\d' : c; } return p[i++]; };
  const charClass = () => {
    i++; const members = []; if (p[i] === '^') throw new Error('negated class');
    while (p[i] !== ']') {
      if (i >= p.length) throw new Error('unbalanced');
      const a = p[i] === '\\' ? (i++, '\\' + p[i++]) : p[i++];
      if (p[i] === '-' && p[i + 1] !== ']') { i++; const b = p[i] === '\\' ? (i++, p[i++]) : p[i++]; members.push({ range: [a, b] }); } else members.push({ ch: a.length === 2 ? a : a });
    }
    i++; return { type: 'class', members };
  };
  const quantifier = () => {
    if (p[i] === '?') { i++; return { min: 0, max: 1 }; }
    if (p[i] === '*') { i++; return { min: 0, max: Infinity }; }
    if (p[i] === '+') { i++; return { min: 1, max: Infinity }; }
    if (p[i] === '{') { const end = p.indexOf('}', i); const [a, b] = p.slice(i + 1, end).split(','); i = end + 1; return { min: Number(a), max: b === undefined ? Number(a) : b === '' ? Infinity : Number(b) }; }
    return { min: 1, max: 1 };
  };
  const alts = alternatives();
  if (i < p.length) throw new Error('trailing');
  return alts;
}

// ---- words -----------------------------------------------------------------------------------------------------------------------------------------------
const shown = (c) => (c === '\\n' ? '\\n' : c === '\\r' ? '\\r' : c.startsWith('\\') ? c.slice(1) : c);

function describeClass(members, plural) {
  let lower = false, upper = false, digit = false, white = false, hexLower = false, hexUpper = false;
  const extras = [];
  for (const m of members) {
    if (m.range) {
      const [a, b] = m.range;
      if (a === 'a' && b === 'z') lower = true; else if (a === 'A' && b === 'Z') upper = true; else if (a === '0' && b === '9') digit = true;
      else if (a === 'a' && b === 'f') hexLower = true; else if (a === 'A' && b === 'F') hexUpper = true;
      else extras.push(`${shown(a)}-${shown(b)}`);
    } else if (m.ch === '\\d') digit = true; else if (m.ch === '\\s') white = true; else extras.push(shown(m.ch));
  }
  if (hexLower && digit && !lower && !upper && !extras.length && !hexUpper) return `lowercase hexadecimal digit${plural ? 's' : ''}`;
  if (hexUpper && digit && !lower && !upper && !extras.length && !hexLower) return `uppercase hexadecimal digit${plural ? 's' : ''}`;
  if (hexLower) extras.unshift('a-f'); if (hexUpper) extras.push('A-F');
  const noun = (s) => (plural ? s + 's' : s);
  const cats = [];
  if (upper && lower) cats.push(noun('letter')); else if (upper) cats.push(noun('uppercase letter')); else if (lower) cats.push(noun('lowercase letter'));
  if (digit) cats.push(noun('digit'));
  if (white) cats.push('whitespace');
  const any = extras.length ? `any of ${extras.join(' ')}` : '';
  return [cats.join(' or '), any].filter(Boolean).join(' or ');
}

function count(q) {
  if (q.min === q.max) return String(q.min);
  if (q.max === Infinity) return q.min === 0 ? 'any number of' : `${q.min} or more`;
  return `${q.min} to ${q.max}`;
}

function describeItem(item) {
  const { atom } = item;
  if (atom.type === 'lit') {
    const once = `the character "${shown(atom.ch)}"`;
    return item.min === 1 && item.max === 1 ? once : item.min === 0 && item.max === 1 ? `optionally ${once}` : `${count(item)} times ${once}`;
  }
  if (atom.type === 'any') return item.max === Infinity ? 'any characters' : `${count(item)} characters of any kind`;
  if (atom.type === 'class') {
    const single = item.max === 1;
    const what = describeClass(atom.members, !single);
    const onlyAny = !/^(letter|uppercase|lowercase|digit|whitespace|lowercase hex|uppercase hex)/.test(what);
    if (item.min === 0 && item.max === 1) return `optionally ${what}`;
    const n = count(item);
    if (n === 'any number of') return `any number of ${what}`;
    return onlyAny || /^\d+$/.test(n) || /to|more/.test(n) ? `${n} ${what}` : `${n} ${what}`;
  }
  // a group
  const inner = atom.alts.map((a) => a.map(describeItem).join(', then ')).join('; or ');
  if (item.min === 1 && item.max === 1) return inner;
  if (item.min === 0 && item.max === 1) return `optionally ${inner}`;
  if (item.max === Infinity && item.min === 0) return `any number of repetitions of (${inner})`;
  return `${count(item)} repetitions of (${inner})`;
}

/** The words for a pattern (without "Required format is"), or undefined when it cannot be put into words. */
export function describePattern(pattern) {
  let tree;
  try { tree = parse(pattern); } catch { return undefined; }
  // pairs of hexadecimal digits: ([0-9A-F][0-9A-F]){m,n}
  if (tree.length === 1 && tree[0].length === 1 && tree[0][0].atom.type === 'group') {
    const [{ atom, min, max }] = tree[0], inner = atom.alts;
    if (inner.length === 1 && inner[0].length === 2 && inner[0].every((x) => x.atom.type === 'class' && x.min === 1 && x.max === 1 && describeClass(x.atom.members, false) === 'uppercase hexadecimal digit')) {
      const n = min === max ? `${min}` : `${min} to ${max}`;
      return max === 1 ? '1 byte, written as 2 uppercase hexadecimal digits (0-9, A-F)' : `${n} bytes, each written as 2 uppercase hexadecimal digits (0-9, A-F)`;
    }
  }
  return tree.map((alt) => alt.map(describeItem).join(', then ')).join('; or ');
}

// ---- the format of a type --------------------------------------------------------------------------------------------------------------------------------
/** @param t a dictionary entry from readRepository (kind, raw line) */
// types whose kind says one thing and whose definition another
const BY_NAME = new Map([
  ['JulianDate', 'Use the format yddd, where y is the last digit of the year and ddd the day of the year from 001 to 366, for example 6279'],
]);

export function formatOf(t) {
  if (BY_NAME.has(t.name)) return BY_NAME.get(t.name);
  const a = (n) => { const v = attr(t.raw, n); return v === undefined ? undefined : unescape(v); };
  const pattern = a('pattern')?.replace(/\s+$/, ''), minLength = a('minLength'), maxLength = a('maxLength'), totalDigits = a('totalDigits'), fractionDigits = a('fractionDigits'), minInclusive = a('minInclusive');
  switch (t.kind) {
    case 'Indicator': return 'Use true or false';
    case 'Date': return 'Use the format YYYY-MM-DD, for example 2026-10-06';
    case 'DateTime': return pattern === '.*Z' ? 'Use YYYY-MM-DDThh:mm:ssZ, in UTC (ending in Z), for example 2026-10-06T09:30:00Z' : 'Use YYYY-MM-DDThh:mm:ss followed by Z or an offset such as +02:00, for example 2026-10-06T09:30:00Z';
    case 'Time': return 'Use hh:mm:ss, with fractions of a second and Z or an offset such as +02:00 if needed, for example 09:30:00Z';
    case 'YearMonth': { const w = pattern && describePattern(pattern); return w ? `Required format is ${w}` : 'Required format is 4 digits, then the character "-", then 2 digits (01 to 12)'; }
    case 'Year': return 'Required format is 4 digits';
    case 'Month': return 'Required format is 2 digits, from 01 to 12';
    case 'Amount': case 'Quantity': case 'Rate': {
      if (totalDigits === undefined) return undefined;
      const digits = `${totalDigits} ${totalDigits === '1' ? 'digit' : 'digits'}`;
      const maxInclusive = a('maxInclusive');
      if (Number(fractionDigits ?? 0) === 0) return `Required format is a whole number, using digits only, at most ${digits} in total${minInclusive !== undefined && maxInclusive !== undefined && minInclusive !== '0' ? `, from ${minInclusive} to ${maxInclusive}` : ''}`;
      return `Required format is digits with an optional decimal point, for example 1500.25, at most ${digits} in total, of which at most ${fractionDigits} after the decimal point${minInclusive === '0' ? ', not negative' : ''}`;
    }
    case 'Binary': return maxLength === undefined ? undefined : `Required format is at most ${maxLength} characters`;
    case 'Text': case 'IdentifierSet': {
      if (pattern !== undefined) {
        if (KNOWN.has(pattern)) return KNOWN.get(pattern);
        const words = describePattern(pattern);
        if (words) return `Required format is ${words}`;
        // a pattern that cannot be put into words: say only what can be said
      }
      if (minLength !== undefined && maxLength !== undefined) return `Required format is ${minLength} to ${maxLength} characters`;
      if (maxLength !== undefined) return `Required format is at most ${maxLength} characters`;
      return undefined;
    }
    default: return undefined; // components, choices, code sets, schemas: their elements and codes are the guidance
  }
}
