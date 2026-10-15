// Reads the ISO 20022 repository file (the `.iso20022` eRepository, download it from iso20022.org) line by line, without an XML library.
// Returns what the hub needs of it: the message definitions (with their building blocks) and the dictionary entries (types) with their children.
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';

export const attr = (line, name) => { const m = line.match(new RegExp(`\\s${name}="([^"]*)"`)); return m ? m[1] : undefined; };
const kindOf = (line) => line.match(/xsi:type="iso20022:([A-Za-z]+)"/)?.[1];

/**
 * @returns {{ types: Map<string, object>, messages: object[] }}
 *   types: id -> { id, kind, name, status, definition, line, elements: [{ kind, id, name, status, definition, type, simpleType, line }], codes: [{ id, name, status, line }] }
 *   messages: [{ id, name, status, identifier: 'pain.001.001.13', base: 'pain.001.001', version: 13, blocks: [{ name, complexType }] }]
 */
export async function readRepository(file) {
  const types = new Map(), messages = [];
  let type, message;
  for await (const line of createInterface({ input: createReadStream(file, 'utf8'), crlfDelay: Infinity })) {
    if (line.includes('<topLevelDictionaryEntry')) {
      type = { id: attr(line, 'xmi:id'), kind: kindOf(line), name: attr(line, 'name'), status: attr(line, 'registrationStatus'), definition: attr(line, 'definition'), raw: line, elements: [], codes: [], constraints: [] };
      types.set(type.id, type);
      if (line.includes('/>') && !line.includes('</topLevelDictionaryEntry>') && /\/>\s*$/.test(line)) type = undefined;
    } else if (type && line.includes('<messageElement ')) {
      type.elements.push({ kind: kindOf(line), id: attr(line, 'xmi:id'), name: attr(line, 'name'), status: attr(line, 'registrationStatus'), definition: attr(line, 'definition'), type: attr(line, 'type'), simpleType: attr(line, 'simpleType'), complexType: attr(line, 'complexType'), raw: line });
    } else if ((type || message) && (line.includes('<constraint ') || line.includes('<xors '))) {
      (type ?? message).constraints.push({ name: attr(line, 'name'), definition: attr(line, 'definition'), status: attr(line, 'registrationStatus') });
    } else if (type && line.includes('<code ')) {
      type.codes.push({ id: attr(line, 'xmi:id'), name: attr(line, 'name'), status: attr(line, 'registrationStatus'), definition: attr(line, 'definition'), codeName: attr(line, 'codeName'), raw: line });
    } else if (line.includes('</topLevelDictionaryEntry>')) type = undefined;
    else if (line.includes('<messageDefinition ')) {
      message = { id: attr(line, 'xmi:id'), name: attr(line, 'name'), status: attr(line, 'registrationStatus'), definition: attr(line, 'definition'), blocks: [], constraints: [], raw: line };
      messages.push(message);
    } else if (message && line.includes('<messageBuildingBlock ')) message.blocks.push({ name: attr(line, 'name'), definition: attr(line, 'definition'), status: attr(line, 'registrationStatus'), complexType: attr(line, 'complexType'), simpleType: attr(line, 'simpleType'), type: attr(line, 'type') });
    else if (message && line.includes('<messageDefinitionIdentifier ')) {
      const a = attr(line, 'businessArea'), f = attr(line, 'messageFunctionality'), fl = attr(line, 'flavour'), v = attr(line, 'version');
      message.base = `${a}.${f}.${fl}`; message.version = Number(v); message.identifier = `${a}.${f}.${fl}.${v}`;
    } else if (line.includes('</messageDefinition>')) message = undefined;
  }
  return { types, messages: messages.filter((m) => m.identifier) };
}
