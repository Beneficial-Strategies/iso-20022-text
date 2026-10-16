# ISO 20022 text (hub)

The place where the language text of the ISO 20022 message explorer and library is gathered and served. The text itself lives in one
repository per language, so that the people who care for a language have their own repository, review rules and release schedule:

| Language | Repository |
|---|---|
| English (US) | [iso-20022-text-en-US](https://github.com/Beneficial-Strategies/iso-20022-text-en-US) |
| French | [iso-20022-text-fr](https://github.com/Beneficial-Strategies/iso-20022-text-fr) |
| German | [iso-20022-text-de](https://github.com/Beneficial-Strategies/iso-20022-text-de) |
| Spanish | [iso-20022-text-es](https://github.com/Beneficial-Strategies/iso-20022-text-es) |
| Portuguese | [iso-20022-text-pt](https://github.com/Beneficial-Strategies/iso-20022-text-pt) |

**[SPECIFICATION.md](SPECIFICATION.md)** is the convention for finding any localized name or definition (draft).

Each language repository deploys its own text host; the library and tools load the text of a language at run time from that host instead of carrying it
(see Deployment below). There is no list of releases here: a language host is whatever its repository's `main` branch built last.

## What is here

This repository holds **the text exactly as the ISO 20022 specification has it**, in English, plus the texts our tools generate. A language repository
holds only what differs from it.

| Path | What |
|---|---|
| `types/<first letter>/<Type>.json` | one file per type: its `name` and `definition`, and the `isoElements`, `isoCodes`, `isoRules`, or (a business component) `isoAttributes` and `isoAssociations` of it; data types also carry `format`, the text that says what a value must look like |
| `build/repository.mjs` | reads the ISO 20022 repository file (the `.iso20022` eRepository from iso20022.org), line by line, without dependencies |
| `build/coverage.mjs` | what the hub should publish (the latest registered version of every message, every type those messages use however deep, every business component) and what of it is missing: `node build/coverage.mjs --repository <file.iso20022> --check`; `--write` sets `complete` in `coverage.json` |
| `build/types.mjs` | writes the types and messages the hub lacks, from the repository file and the library's snapshot (for the code values): `--write-missing`; `--repair` fills the few things earlier files lacked; `--verify` regenerates every file and says which differ |
| `build/format.mjs` | the `format` text of a data type, from the facts ISO publishes for it (pattern, length, digits) |
| `build/domain.mjs` | writes the business domain (every business component with its attributes and associations) into `types/` from the ISO 20022 repository file: `node build/domain.mjs --repository <file.iso20022>`; `--check` says whether anything would change |
| `areas.json` | the business areas (pain, camt, ...): name and definition of each, served at `/areas` |
| `messages.json` | every message's identifier and root type (a message's name and description are its root type's; served at `/messages` with each name) |
| `tools/<tool>/<name>.json` | the text of an application that uses this text, key -> text (today: the ISO 20022 Explorer, `tools/explorer/page.json` and `controls.json`); served at `/tools/<tool>/<name>` |
| `coverage.json` | whether the publication is complete, and the source of the English (the messages and types published are counted by the build) |
| `build/glossary.mjs` | lists the words of the names, and the ones a language's glossary does not cover yet |
| `build/overlay.mjs` | builds what a language host serves: this text, then the language repository's `glossary.json` rules, then its explicit entries |

Definitions are ISO's, word for word (with `|` for a line break, as ISO writes it). A `name` is the ISO element, type or code name broken into words (`BranchData5` is "Branch Data 5"), and
`format` is generated from the ISO pattern of the type; both are ours, not ISO's. A text is written once here and reused by every application that needs it,
so an error message for a malformed BIC is the same in a UI, a C# API or any other consumer.

Coverage so far: the most recent version of each message and every type it uses, and the entirety of the domain model (the business components, with their business attributes and associations). `/coverage` says whether the publication is complete.

## Updating from a new ISO release

1. Download the new `.iso20022` repository file and the matching `spec-snapshot.tsv` (Iso20022Library, `snapshot-sync/`).
2. `node build/coverage.mjs --repository <file>` says what is new (messages, types) and what the hub has that the release no longer has.
3. `node build/types.mjs --repository <file> --snapshot <tsv> --write-missing`, then `node build/domain.mjs --repository <file>`; `--repair` once if an older file is incomplete.
4. `node build/coverage.mjs --repository <file> --check --write`, so `coverage.json` says `complete` only when nothing is missing.
5. The glossary build lists the words the language repositories do not cover yet (`node build/glossary.mjs missing --spoke <language repository>`): file the language work from it.

A message counts as published when its latest registered version is. A provisionally registered message definition is published only if no registered version is newer (at the snapshot of 2026-09-04 every provisional definition was an older version); the provisional status of elements and codes inside a registered message is not marked in the text.

## Deployment

Each repository deploys its own text host as a Cloudflare Worker with static assets (no Worker code), using Cloudflare Workers Builds: the `main` branch
deploys, other branches get preview addresses. The host names are `https://iso-20022-text-{language}.beneficialstrategies.com`, the tag in lower case.
This repository deploys `en`, the ISO English as published (`wrangler.jsonc`, built by `node build/build.mjs --out site`). The language repositories fetch
this one when they build, so a change here reaches a language host the next time that language's repository builds (`HUB_REF` and `HUB_REPO` choose another
version of this repository, for a preview). `iso-20022-text.beneficialstrategies.com` itself is not a language host.

All six repositories (this one, `-en-US`, `-fr`, `-de`, `-es`, `-pt`) are connected to Workers Builds: a pull request gets a "Workers Builds" check and a preview address, and a merge to `main` deploys the host.

To try a language repository against a hub branch before the hub is merged, run that repository's build with `HUB_REF` set (a branch or tag of this repository; `HUB_REPO` is the address of a fork). For example, to see French with the branch `feat/my-change`:

```
cd iso-20022-text-fr
HUB_REF=feat/my-change sh -c 'rm -rf .hub && git clone --depth 1 --branch "$HUB_REF" https://github.com/Beneficial-Strategies/iso-20022-text .hub && node .hub/build/build.mjs --spoke . --out site'
npx wrangler dev
```

On Cloudflare, the same variable set as a build variable of the preview does it for a pull request.

## Help keep the text maintained

The base text here is ISO's, and each language is cared for in its own repository. Every one has the same forms: a **glossary entry** ("when ISO 20022 says `Cheque` it should say `Check` in my language"), a correction to a definition, and an offer to review or maintain. They also ask which **variety** of the language (Brazil, Portugal, Quebec, Switzerland...) a term belongs to, so that regional differences are captured and a variety that needs it can get its own text.

| Language | Glossary entry | Offer to help |
|---|---|---|
| Portuguese | [open](https://github.com/Beneficial-Strategies/iso-20022-text-pt/issues/new?template=glossary.yml) | [open](https://github.com/Beneficial-Strategies/iso-20022-text-pt/issues/new?template=volunteer.yml) |
| Spanish | [open](https://github.com/Beneficial-Strategies/iso-20022-text-es/issues/new?template=glossary.yml) | [open](https://github.com/Beneficial-Strategies/iso-20022-text-es/issues/new?template=volunteer.yml) |
| French | [open](https://github.com/Beneficial-Strategies/iso-20022-text-fr/issues/new?template=glossary.yml) | [open](https://github.com/Beneficial-Strategies/iso-20022-text-fr/issues/new?template=volunteer.yml) |
| German | [open](https://github.com/Beneficial-Strategies/iso-20022-text-de/issues/new?template=glossary.yml) | [open](https://github.com/Beneficial-Strategies/iso-20022-text-de/issues/new?template=volunteer.yml) |
| English (US) | [open](https://github.com/Beneficial-Strategies/iso-20022-text-en-US/issues/new?template=glossary.yml) | [open](https://github.com/Beneficial-Strategies/iso-20022-text-en-US/issues/new?template=volunteer.yml) |

A language that is not here yet: **[propose it](https://github.com/Beneficial-Strategies/iso-20022-text/issues/new?template=new-language.yml)**. Co-maintainers and sponsors change what this text can become: contact support@beneficialstrategies.com. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Status, license and warranty

This text and everything in these repositories are provided **free of charge and as is**, under the MIT license (see `LICENSE`), without warranty
of any kind. We make our best-faith effort toward accurate text, but it is not verified by a professional translator, and entries may be machine drafts that no person has reviewed. **Do not rely on it for legal, financial or compliance decisions**: the authoritative text is ISO's English.

**The controls here are lax at present**: there is no formal review process, release gating or ownership policy beyond what you can see in these
repositories. We intend to improve them over time (named maintainers per language and area, required reviews, release checks) should the libraries
gain adoption and sponsorship. Taking over the care of a language, or of an area of one, is welcome.

**ISO 20022 material.** The ISO 20022 specification, its schemas, code sets and their text are ISO's. ISO and its Registration Authority publish them to be used and reproduced freely under the [ISO 20022 Terms of use](https://www.iso20022.org/terms-use) and the [Intellectual Property Rights Policy](https://www.iso20022.org/intellectual-property-rights). **This is not the official ISO 20022 site. The sole source of up-to-date material is <https://www.iso20022.org/>.** ISO's material is provided "as is", without warranty. The license of these repositories covers what we wrote, not ISO's material. This is not legal advice.
