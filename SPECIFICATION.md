# ISO 20022 text convention (draft v0)

How to find the localized name or definition of anything in the ISO 20022 specification, the same way for every language and every tool.
This document is the contract. It says nothing about any one consumer: a tool that has never heard of Headless can use it.

## Principles

1. **An address is a function of ISO's own identifiers only.** The name of a type, the name of one of its children, a message identifier, or a
   repository id. Never which messages a consumer implements, never how files are grouped or stored.
2. **Complete in intent, staged in coverage.** The convention covers the whole specification. What a host has published so far is stated
   (`/coverage`); growth only adds files, it never moves or renames one.
3. **Every host is complete for what it covers.** A language that has not written an entry yet still answers: with the text it is built on (the ISO
   English, or the base language). A client never needs a fallback chain to get *a* description.
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
| **Text** | The localizable properties of anything above: `name`, `definition` and, for a data type, `format`. Nothing else is localized by this convention. |
| **Hub** | The repository that holds the base text: ISO's English exactly as the specification has it, plus the `format` and `name` texts our tools generate. Every language is built on it. |
| **Language repository** | A repository that holds only what differs from the hub (or from the language it is based on). |

## Hosts

One host per language: `https://iso-20022-text-{language}.beneficialstrategies.com`, the tag in lower case (`iso-20022-text-en-us...`).
A language is published if its host answers. Hosts allow any origin (`Access-Control-Allow-Origin: *`), serve `Content-Type: application/json;
charset=utf-8` for every path below, and ignore query strings (a client may append `?v={release}` to bypass a cache).

## Addresses

| Path | Returns | Required |
|---|---|---|
| `/{TypeName}` | the **type resource** | yes |
| `/messages` | the **message index**: the name of every message, by identifier | recommended |
| `/areas` | the **business areas** (`pain`, `pacs`, ...): name and definition of each | recommended |
| `/id/{repositoryId}` | the resource of exactly that item (type, element, code, rule or message) | yes |
| `/tools/{tool}/{name}` | the text of an application that uses this text (not ISO text): a map from key to text | optional |
| `/coverage` | what this host has published | yes |
| `/manifest` | language, release, source | yes |
| `/{TypeName}/{Child}` | one element, code or rule of a type | optional, for hosts that can compute it |

A path has no file extension. Reserved first segments are lower case (`id`, `tools`, `messages`, `areas`, `coverage`, `manifest`); a type name always starts with an upper-case
letter and a message identifier contains dots, so neither can clash with them or with each other. A path that is not published answers `404`.
That means "not published yet", and the consumer may ask the MCP for the English.

**Static hosts and `/{TypeName}/{Child}`.** A file and a directory cannot share a name, so a static host cannot serve both `/{TypeName}` and
`/{TypeName}/{Child}`. The type resource therefore contains every child, and the child path is a convenience for hosts with a flat key space
(object storage) or a function.

## The type resource

A component (the English text is the hub's):

```json
{
  "isoType": "ChequeType2Code",
  "language": "en",
  "name": "Cheque Type2 Code",
  "definition": "Specifies the type of cheque.",
  "isoCodes": {
    "CCHQ": { "name": "Customer Cheque", "definition": "Cheque drawn on the account of the debtor, ..." }
  }
}
```

The same type from the `en-US` host:

```json
{
  "isoType": "ChequeType2Code",
  "language": "en-US",
  "name": "Check Type2 Code",
  "definition": "Specifies the type of check.",
  "isoCodes": {
    "CCHQ": { "name": "Customer Check", "definition": "Check drawn on the account of the debtor, ..." }
  }
}
```

A data type (it has `format` and no children):

```json
{
  "isoType": "ISODateTime",
  "language": "en",
  "name": "ISO Date Time",
  "definition": "A particular point in the progression of time defined by a mandatory date and a mandatory time component, ...",
  "format": "Use YYYY-MM-DDThh:mm:ss followed by Z or an offset such as +02:00, for example 2026-10-06T09:30:00Z"
}
```

* `isoType`, the keys of `isoElements`, `isoCodes` and `isoRules`, and `isoName` are ISO's own identifiers and are never translated. `isoType` is the ISO name of the type (the name in the address), each key of `isoElements` is the ISO name of an element of the type, each key of `isoCodes` is a code value of the code set, each key of `isoRules` is an ISO constraint name, and `isoName` is the ISO long name of that code. The `iso` prefix says that these values must match something in the ISO 20022 specification.
* `isoElements`, `isoCodes` and `isoRules` are separate maps, because an element and a rule of one type can share a name (it happens, in two types). A
  type has isoElements (a component or choice) or isoCodes (a code set), and any number of isoRules. An empty map may be left out.
* `name` and `definition` are present together; a rule has only a `definition`.
* A code carries `isoName`, ISO's own long name for it (`NewAccountOpening` for the code `NEWA`), next to its `name` (the long name in words, "New Account Opening")
  and `definition`. A consumer finds a code by its value **or** by its `isoName`: it indexes both. `isoName` is never translated and the glossary never touches it.
* A data type has `name`, `definition` and `format`, and no children.
* Text keeps the ISO convention that `|` marks a line break inside a definition.
* Where each text comes from, in the hub: a `definition` is ISO's own text, word for word. A `name` is the ISO element, type or code name broken into words at its
  camel case and between letters and digits (`PostCode` is "Post Code", `BranchData5` is "Branch Data 5", `Max35Text` is "Max 35 Text"), and a `format` is written by our tools. Both are ours, not ISO's. A language
  may replace any of them.
* The resource carries no review or provenance marker. Who wrote a text, who approved it and when is the history of the repository it lives in; a
  marker per text can be added later if it proves needed.

### `format`

`format` says what a value of a data type must look like. It is written to stand alone as an error message, so that the text a person reads is the
same whichever application finds the problem: a form in a browser, a C# API that rejects a request, a Go service that finds a pattern mismatch. An
application that detects a malformed value reports the `format` of the field's type and does not write a text of its own.

* It is a property of the **type**, not of an element: every element of that type has it. It is present on text, number, amount, date, time and
  boolean types, and absent from components, choices and code sets (their elements and codes are the guidance).
* It states the requirement: "Required format is 1 to 35 characters", "Required format is 4 letters or digits", "Required format is digits with an
  optional decimal point, for example 1500.25, at most 18 digits in total, of which at most 5 after the decimal point, not negative", or, for a
  value with a well-known shape, its name and an example ("Not a valid BIC (8 or 11 characters). Expected: ... Example: DEUTDEFF / DEUTDEFF500").
  Texts for dates and times and for booleans are written out ("Use YYYY-MM-DD, for example 2026-10-06").
* In the hub it is written once, in English, and generated from the facts ISO publishes for the type (its pattern, length limits and digit limits).
  Where the pattern cannot be described in words, the text says only what can be said. A language states its own `format` where it wants to say
  it differently, and otherwise inherits the hub's (translated by the language's glossary where it has one).
* The convention does not say how a consumer finds out which type a field has; it is the type named by the element, as in the message definition.


## Text of tools

An application that shows this text has words of its own (buttons, dialogs, help, messages). So that it need not carry them in code, the host may serve them under
`/tools/{tool}/{name}`, for example `/tools/explorer/page` and `/tools/explorer/controls` for the ISO 20022 Explorer. A resource is one JSON object: keys
the tool defines, each mapping to a text, in which `{name}` marks a value the tool fills in (`"draft — {n} problem(s)"`). A language answers every key of the
hub's English. Nothing here is ISO text and nothing in the address comes from ISO's identifiers: `tools` is a namespace, and a tool's keys are the tool's own
contract. `/coverage` lists the tools and names a host serves (`"tools": { "explorer": ["controls", "page"] }`).

## Messages and business areas

A message has no text of its own: its name and its description are those of its **root type**, the type its definition is named for
(`pain.001.001.13` is `CustomerCreditTransferInitiationV13`). So a language translates the type once, and the message follows.

`/messages` is the index a list of messages is made from, one file instead of one per message:
`{ "isoMessages": { "pain.001.001.13": { "isoType": "CustomerCreditTransferInitiationV13", "name": "Customer Credit Transfer Initiation" } } }`. The `name` is the root
type's name without its version. The description (the root type's `definition`) is in the type resource.

Which types a message uses is not text and is not published here: it is a function of the ISO data, which a consumer already has (its own model of the message, or the
ISO 20022 MCP: `iso20022://element/{message identifier}/downward-dependency-requirements`). A consumer fetches `/{TypeName}` for each type it shows; every resource is
small, static and cacheable, and a type used by many messages is fetched once.

`/areas` has the business areas of ISO 20022, which are ISO's own names and definitions, not a tool's:
`{ "isoAreas": { "pain": { "name": "Payments Initiation", "definition": "Messages that support the initiation of a payment..." } } }`. The keys of `isoAreas` and
`isoMessages` are ISO's identifiers and are never translated.

## Names that are not unique

Across the whole dictionary (23,501 entries) two type names occur twice, each a pair of different items of the same kind, and one code value repeats
within a code set. Their resources are published with an `ambiguous` list, and the right item is always reachable by repository id:

| Name | Where | Why |
|---|---|---|
| `ExternalTransactorTypeCode` | type | two code sets |
| `Exact2AlphaNumericText` | type | two text types |
| `CTP` in `ExternalLocalInstrument1Code` and `ExternalLocalInstrumentCode`, `NCON` in `PendingFailingReasonV2Code` | code | two codes with one value |

```json
{ "isoType": "ExternalTransactorTypeCode", "language": "fr", "ambiguous": [ { "id": "_7ZuP4BT6EfC_aaedwHHlmw", "definition": "..." }, { "id": "_K2qZcCq8EfCD0_iZ8tw-zA", "definition": "..." } ] }
```

## Coverage and manifest

`/coverage`: `{ "complete": false, "messages": ["pain.001.001.13", ...], "types": 5555 }`. The types published are those of the listed messages
and everything they use. `complete: true` means the whole specification.

`/manifest`: `{ "language": "fr", "release": "<hash of the published files>", "source": { "english": "ISO 20022 repository, snapshot 2026-09-04" }, "convention": "v0" }`.

## Caching

Paths are not versioned, so responses are mutable: `Cache-Control: public, max-age=300, stale-while-revalidate=86400`. A client that wants
certainty compares `/manifest`.`release` and appends `?v={release}`.

## The MCP

The MCP delivers the specification's own text, in English, and **nothing localized**; it never serves the resources above. It can be *aware* of
this convention, so that a client that has something from the MCP can find its localized text without guessing: the MCP's answers already carry
the ISO names the addresses are made of (a type's name, a child's element name, a message identifier), and the host pattern and paths above are
all a client needs. The hub's English was generated from the MCP's data. How the MCP states the convention, in its documentation or by
returning a pointer with an element, is left open.

## Informative: how the text is maintained

Not part of the convention; a repository may keep its text any way it likes as long as the host publishes the resources above. The intended shape, so that
people can care for a language without knowing Headless or any other consumer:

* **The hub** (`iso-20022-text`) holds the base: the business areas (`areas.json`), the text of each tool (`tools/{tool}/{name}.json`), one file per type named for the type and grouped by its first letter (`types/P/PostalAddress27.json`), `messages.json`
  (every message's identifier and root type) and `coverage.json`. Its definitions are ISO's, exactly. It also holds the tool that builds what a host serves.
* **A language repository** (`iso-20022-text-{language}`) holds **only what differs**. It never repeats a structure to change one text:
  * `glossary.json`: rules applied automatically, as word stems (`authoris` -> `authoriz`), whole words (`cheque` -> `check`) and phrases
    (`Town Name` -> `City Name`), plus `keep`, the words the language leaves as they are (`BIC`). `applyTo` says where they apply: `names` (the names of types,
    elements and codes: the display names and the values of a dropdown) and `texts` (definitions and formats). A regional language applies both; a translation
    applies `names` only, because its definitions are translated. Numbers in a name are never changed. One line fixes a word everywhere.
  * `types/{first letter}/{Type}.json`: explicit exceptions, holding only the entries and properties that differ (for example
    `{ "isoType": "ChequeType2Code", "definition": "Specifies the type of check." }`). An exception wins over a glossary rule.
  * `areas.json`: the names and definitions of the business areas that the language changes (`{ "isoAreas": { "pain": { "name": "..." } } }`).
  * `tools/{tool}/{name}.json`: the keys of a tool's text that the language changes (only those). A regional language may apply its glossary to them
    (`applyTo` has `tools`).
  * `text.config.json`: the language tag and the language it is based on.
* **Starting a language.** The first step is to make every word of the names a glossary entry: `build/glossary.mjs vocabulary` lists the words of the hub's
  names (with how often each occurs), and `build/glossary.mjs missing --spoke <repository>` lists those the language's glossary does not cover yet. With
  the glossary complete, every name and every dropdown value is produced by the build. Names are therefore never stored in a language repository: a change to
  the glossary reaches all of them the next time the build runs. Word-for-word replacement does not reorder a phrase, so where a language needs a different
  order the phrase goes in the glossary, or the name is written as an explicit exception.
* **Translating definitions.** Definitions are translated with AI tools and written as explicit exceptions (`types/`). The translation is given the glossary and must use
  its terms, so that a word is rendered the same in a name and in a definition. People review the result as a pull request.
* **The build** takes the hub, applies the language's glossary, then its exceptions, and writes complete type resources. They are build output: never
  edited by hand and not stored in a repository.
* Which messages a host publishes is chosen at build time and stated in `/coverage`. Growth adds files, it never renames one.

Review and approval are the repository's own (pull requests, code owners, history). A per-text record of review state is deliberately left out of v0.

## Open points

* Whether `name` should be ISO's own name (`PostalAddress`) and the words form be left to the consumer, so that the hub holds nothing that is not ISO's
  except `format`.
* The `format` of types whose pattern cannot be described in words, and of types whose rules are not a pattern; the wording of every `format` is open for revision.
* Whether a per-text review marker is added later, and how a client would tell an untranslated entry from a translated one.
* The spelling of the language tag in a hostname (`en-us`) and how a client finds out which tags exist (a list at the hub?).
* How the MCP makes clients aware of the convention (documentation only, or a pointer in its answers).
* Storage once coverage outgrows free static hosting (object storage behind the same hostname and paths: nothing published changes).
* ISO's terms for republishing its text and its definitions.

## Status, license and warranty

This convention, and the text served under it, are provided **free of charge and as is**, under the MIT license (see `LICENSE`), without warranty of
any kind. We make our best-faith effort toward accuracy; translations may be machine drafts that no person has reviewed, and must not be relied on for legal,
financial or compliance decisions. The controls are lax at present and are meant to improve over time should the libraries gain adoption and
sponsorship. ISO 20022 and its text belong to ISO, and ISO's own terms apply to them. This is not legal advice.
