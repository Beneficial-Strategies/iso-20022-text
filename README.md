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
| `types/<first letter>/<Type>.json` | one file per type: its `name` and `definition`, and the `isoElements`, `isoCodes` and `isoRules` of it; data types also carry `format`, the text that says what a value must look like |
| `areas.json` | the business areas (pain, camt, ...): name and definition of each, served at `/areas` |
| `messages.json` | every message's identifier and root type (a message's name and description are its root type's; served at `/messages` with each name) |
| `tools/<tool>/<name>.json` | the text of an application that uses this text, key -> text (today: the ISO 20022 Explorer, `tools/explorer/page.json` and `controls.json`); served at `/tools/<tool>/<name>` |
| `coverage.json` | whether the publication is complete, and the source of the English (the messages and types published are counted by the build) |
| `build/glossary.mjs` | lists the words of the names, and the ones a language's glossary does not cover yet |
| `build/overlay.mjs` | builds what a language host serves: this text, then the language repository's `glossary.json` rules, then its explicit entries |

Definitions are ISO's, word for word (with `|` for a line break, as ISO writes it). A `name` is the ISO element, type or code name broken into words (`BranchData5` is "Branch Data 5"), and
`format` is generated from the ISO pattern of the type; both are ours, not ISO's. A text is written once here and reused by every application that needs it,
so an error message for a malformed BIC is the same in a UI, a C# API or any other consumer.

Coverage so far: `pain.001.001.13` and the 170 types it uses.

## Deployment

Each repository deploys its own text host as a Cloudflare Worker with static assets (no Worker code), using Cloudflare Workers Builds: the `main` branch
deploys, other branches get preview addresses. The host names are `https://iso-20022-text-{language}.beneficialstrategies.com`, the tag in lower case.
This repository deploys `en`, the ISO English as published (`wrangler.jsonc`, built by `node build/build.mjs --out site`). The language repositories fetch
this one when they build, so a change here reaches a language host the next time that language's repository builds (`HUB_REF` and `HUB_REPO` choose another
version of this repository, for a preview). `iso-20022-text.beneficialstrategies.com` itself is not a language host.

## Status, license and warranty

This text and everything in these repositories are provided **free of charge and as is**, under the MIT license (see `LICENSE`), without warranty
of any kind. We make our best-faith effort toward accurate text, but it is not verified by a professional translator, and entries may be machine drafts that no person has reviewed. **Do not rely on it for legal, financial or compliance decisions**: the authoritative text is ISO's English.

**The controls here are lax at present**: there is no formal review process, release gating or ownership policy beyond what you can see in these
repositories. We intend to improve them over time (named maintainers per language and area, required reviews, release checks) should the libraries
gain adoption and sponsorship. Taking over the care of a language, or of an area of one, is welcome.

ISO 20022 and its text belong to ISO, and ISO's own terms apply to them. The license covers what is written in these repositories, not ISO's text.
This is not legal advice.
