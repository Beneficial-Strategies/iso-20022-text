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

`languages.json` pins the release (a commit) of each language that this hub serves. The hub builds the files a text host serves from those
pinned versions and the library's source artifact (the English), and deploys them, so that the library can load the text of a language at run
time from a text host instead of carrying it. The design and the proof of concept are described in
[Iso20022Headless: docs/text-packs-poc.md](https://github.com/Beneficial-Strategies/Iso20022Headless/blob/poc/text-packs/docs/text-packs-poc.md)
(on the `poc/text-packs` branch until it is merged).

## Status

**Nothing here builds or deploys yet.** This repository holds the list of languages and their pinned versions, and nothing else. The
proof of concept builds the files in the Iso20022Headless repository; moving that build here is the next step.

## Status, license and warranty

This text and everything in these repositories are provided **free of charge and as is**, under the MIT license (see `LICENSE`), without warranty
of any kind. We make our best-faith effort toward accurate text, but it is not verified by a professional translator, and until an entry is marked
reviewed it is a machine draft. **Do not rely on it for legal, financial or compliance decisions**: the authoritative text is ISO's English.

**The controls here are lax at present**: there is no formal review process, release gating or ownership policy beyond what you can see in these
repositories. We intend to improve them over time (named maintainers per language and area, required reviews, release checks) should the libraries
gain adoption and sponsorship. Taking over the care of a language, or of an area of one, is welcome.

ISO 20022 and its text belong to ISO, and ISO's own terms apply to them. The license covers what is written in these repositories, not ISO's text.
This is not legal advice.
