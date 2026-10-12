# ISO 20022 text convention (draft v0)

How to find the localized name or definition of anything in the ISO 20022 specification, the same way for every language, every tool and the
MCP. This document is the contract. It says nothing about any one consumer: a tool that has never heard of Headless can use it.

## Principles

1. **An address is a function of ISO's own identifiers only.** The name of a type, the name of one of its children, a message identifier, or a
   repository id. Never which messages a consumer implements, never how files are grouped or stored.
2. **Complete in intent, staged in coverage.** The convention covers the whole specification. What a host has published so far is stated
   (`/coverage`); growth only adds files, it never moves or renames one.
3. **Every host is complete for what it covers.** A language that has not translated an entry yet still answers: with the ISO English, marked
   as English. A client never needs a fallback chain to get *a* description.
4. **Plain files.** Everything is a JSON file that a static host can serve. Anything that needs computation is optional.

## Vocabulary

| Term | Meaning |
|---|---|
| **Type** | Any entry of the ISO dictionary that has a name: a message component, a choice component, a code set, or a data type (text, amount, date, ...). Its name is unique across all kinds (23,501 entries; two exceptions, below). |
| **Element** | A member of a component or a choice, named by its ISO element name (`Name`, `PostalAddress`). |
| **Code** | A value of a code set, named by its code value (`CHK`, `BIZZ`). |
| **Rule** | A constraint of a type, named by its ISO constraint name. |
| **Message** | A message definition, named by its identifier (`pain.001.001.13`). |
| **Language** | A BCP 47 tag: `en`, `fr`, `es-MX`, `en-US`. `en` is the ISO English as published. |
| **Text** | The two localizable properties of anything above: `name` and `definition`. Nothing else is localized by this convention. |

## Hosts

One host per language: `https://iso-20022-text-{language}.beneficialstrategies.com`, the tag in lower case (`iso-20022-text-en-us...`).
A language is published if its host answers. Hosts allow any origin (`Access-Control-Allow-Origin: *`), serve `Content-Type: application/json;
charset=utf-8` for every path below, and ignore query strings (a client may append `?v={release}` to bypass a cache).

## Addresses

| Path | Returns | Required |
|---|---|---|
| `/{TypeName}` | the **type resource** | yes |
| `/{message identifier}` | the **message bundle** | recommended |
| `/id/{repositoryId}` | the resource of exactly that item (type, element, code, rule or message) | yes |
| `/coverage` | what this host has published | yes |
| `/manifest` | language, release, source | yes |
| `/{TypeName}/{Child}` | one element, code or rule of a type | optional, for hosts that can compute it |

A path has no file extension. Reserved first segments are lower case (`id`, `coverage`, `manifest`); a type name always starts with an upper-case
letter and a message identifier contains dots, so neither can clash with them or with each other. A path that is not published answers `404`.
That means "not published yet", and the consumer may ask the MCP for the English.

**Static hosts and `/{TypeName}/{Child}`.** A file and a directory cannot share a name, so a static host cannot serve both `/{TypeName}` and
`/{TypeName}/{Child}`. The type resource therefore contains every child, and the child path is a convenience for hosts with a flat key space
(object storage) or a function, and for the MCP.

## The type resource

The example is illustrative: its French is not a published translation.

```json
{
  "type": "PostalAddress27",
  "language": "fr",
  "name": "Adresse postale",
  "definition": "Informations qui localisent et identifient une adresse précise, telles que décrites par un service postal.",
  "status": "machine",
  "elements": { "PostCode": { "name": "Code postal", "definition": "...", "status": "machine" } },
  "codes":    { "CHK": { "name": "Chèque", "definition": "...", "status": "machine" } },
  "rules":    { "SomeRule": { "definition": "...", "status": "machine" } }
}
```

* `elements`, `codes` and `rules` are separate maps, because an element and a rule of one type can share a name (it happens, in two types). A
  type has elements (a component or choice) or codes (a code set), and any number of rules. An empty map may be left out.
* `name` and `definition` are present together; a rule has only a `definition`.
* `status` is one of `reviewed` (a person has approved it), `machine` (a machine draft) or `english` (not translated: the text is the ISO English).
  It is the same for the `name` and the `definition` of one entry.
* A data type has `name` and `definition` and no children.
* Text keeps the ISO convention that `|` marks a line break inside a definition.

## The message bundle

`/{identifier}` returns the message's own text and every type it uses, as `{ "message": { "identifier", "name", "definition", "status" },
"types": { "{TypeName}": <type resource>, ... } }`. It is derived (the closure of types of the message definition, which is a function of the ISO
data), so a form can fetch one file instead of one per type. A host that does not publish bundles answers `404` and the consumer fetches the types.

## Names that are not unique

Across the whole dictionary (23,501 entries) two type names occur twice, each a pair of different items of the same kind, and one code value repeats
within a code set. Their resources are published with an `ambiguous` list, and the right item is always reachable by repository id:

| Name | Where | Why |
|---|---|---|
| `ExternalTransactorTypeCode` | type | two code sets |
| `Exact2AlphaNumericText` | type | two text types |
| `CTP` in `ExternalLocalInstrument1Code` and `ExternalLocalInstrumentCode`, `NCON` in `PendingFailingReasonV2Code` | code | two codes with one value |

```json
{ "type": "ExternalTransactorTypeCode", "language": "fr", "ambiguous": [ { "id": "_7ZuP4BT6EfC_aaedwHHlmw", "definition": "..." }, { "id": "_K2qZcCq8EfCD0_iZ8tw-zA", "definition": "..." } ] }
```

## Coverage and manifest

`/coverage`: `{ "complete": false, "messages": ["pain.001.001.13", ...], "types": 5555 }`. The types published are those of the listed messages
and everything they use. `complete: true` means the whole specification.

`/manifest`: `{ "language": "fr", "release": "<hash of the published files>", "source": { "english": "ISO 20022 repository, snapshot 2026-09-04" }, "convention": "v0" }`.

## Caching

Paths are not versioned, so responses are mutable: `Cache-Control: public, max-age=300, stale-while-revalidate=86400`. A client that wants
certainty compares `/manifest`.`release` and appends `?v={release}`.

## The MCP

The MCP answers the same resolution for any element: `iso20022://element/{id}/details?lang={language}` (the element with `name` and `definition`
in that language and their `status`), and `iso20022://text/{language}/{TypeName}[/{Child}]`, which returns the resources above. *Proposal, to
be agreed with the MCP's maintainers.*

## Informative: how a language is maintained

Not part of the convention; a language may keep its text any way it likes as long as it publishes the resources above. The intended shape, so that
people can care for a language without knowing Headless or any other consumer: one repository per language (`iso-20022-text-{language}`), one
file per type named for the type and grouped by its first letter (`P/PostalAddress27.json`), holding only the entries that differ from the ISO
English (a regional language) or the translation, plus the tools that overlay them on the complete ISO English at deploy time. The English base
is generated from the specification data (the MCP), never edited by hand. A convenience for translators, translating an element name once so that
it fills every element of that name unless overridden, belongs to the maintenance layer, not to this convention.

## Open points

* The spelling of the language tag in a hostname (`en-us`) and how a client finds out which tags exist (a list at the hub?).
* Whether `/{identifier}` bundles are required once coverage includes messages.
* The MCP resource shape above.
* Storage once coverage outgrows free static hosting (object storage behind the same hostname and paths: nothing published changes).
* ISO's terms for republishing its text and its definitions.

## Status, license and warranty

This convention, and the text served under it, are provided **free of charge and as is**, under the MIT license (see `LICENSE`), without warranty of
any kind. We make our best-faith effort toward accuracy; translations are machine drafts until marked reviewed, and must not be relied on for legal,
financial or compliance decisions. The controls are lax at present and are meant to improve over time should the libraries gain adoption and
sponsorship. ISO 20022 and its text belong to ISO, and ISO's own terms apply to them. This is not legal advice.
