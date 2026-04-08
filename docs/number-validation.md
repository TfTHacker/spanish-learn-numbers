# Number Validation

This repository validates Spanish number generation against authoritative Spanish-language references and an independent parser.

## Sources

The validation corpus is defined in `scripts/number-validation-corpus.mjs` and currently draws canonical forms from:

- RAE / ASALE `cardinales`
- RAE / ASALE `uno`
- RAE / ASALE `mil`
- RAE / ASALE `veintiuno`
- RAE Español al día on apocopation with `veintiún`
- RAE / ASALE `billón`
- FundéuRAE on `mil millones`

## What The Validator Checks

The validator script at `scripts/validate-numbers.mjs` performs four classes of checks:

1. Source-backed corpus checks.
2. Independent parse round-trips for every number from `0` to `999,999`.
3. Independent parse round-trips for every exact-million value from `1,000,000` to `999,999,000,000`.
4. Grammar invariants and large sampled composite-number checks up to `1,000,000,000,000`.

## Limits

No dictionary enumerates every compound numeral up to one trillion. The project therefore combines:

- authoritative grammar and canonical examples from real reference sources
- exhaustive structural validation for the full sub-million range
- exhaustive validation of all exact-million coefficients
- parser-backed sampling for large composite numbers

That gives much stronger assurance than a small fixed unit test set, while keeping validation fast enough to run on every build.
