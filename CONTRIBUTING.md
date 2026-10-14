# Contributing to the hub

The hub holds ISO's English text (exactly), the text of our tools, the convention (`SPECIFICATION.md`) and the build that every language repository uses. Translations and regional wording live in the language repositories:

| Language | Repository |
|---|---|
| English (US) | [iso-20022-text-en-US](https://github.com/Beneficial-Strategies/iso-20022-text-en-US) |
| French | [iso-20022-text-fr](https://github.com/Beneficial-Strategies/iso-20022-text-fr) |
| German | [iso-20022-text-de](https://github.com/Beneficial-Strategies/iso-20022-text-de) |
| Spanish | [iso-20022-text-es](https://github.com/Beneficial-Strategies/iso-20022-text-es) |
| Portuguese | [iso-20022-text-pt](https://github.com/Beneficial-Strategies/iso-20022-text-pt) |

Each has forms for **glossary entries** ("when ISO 20022 says `Cheque` it should say `Check`"), corrections to definitions and offers to review, and asks which **language variety** (a country or region) a term belongs to, so that a variety can later get a repository of its own one level out. Use those, not this repository, for wording.

## What belongs here

| You want to | Open |
|---|---|
| Report that the English differs from ISO's | **The English text differs from ISO's** |
| Report a failing build, wrong coverage or host layout | **Bug in the build or the tools** |
| Propose a change to the convention or the build | **Change to the convention or the tools** |
| Propose a new language or a regional text | **Propose a new language** |

Every pull request says which issue it settles (`Closes #123`, or `Refs #123` for a tracking issue); a check fails without one, and a maintainer can add `no-issue` for a typo.

## Labels

`base-text`, `new-language`, `tracking`, `needs-triage`, `no-issue`, `maintainer-wanted`, and the usual `bug`, `enhancement`, `documentation`, `good first issue`, `help wanted`.
