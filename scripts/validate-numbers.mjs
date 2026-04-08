import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { canonicalCases, validationSources } from './number-validation-corpus.mjs';

const MAX_SUPPORTED_NUMBER = 1_000_000_000_000;

const UNIT_VALUES = new Map([
  ['cero', 0],
  ['un', 1],
  ['uno', 1],
  ['una', 1],
  ['dos', 2],
  ['tres', 3],
  ['cuatro', 4],
  ['cinco', 5],
  ['seis', 6],
  ['siete', 7],
  ['ocho', 8],
  ['nueve', 9],
]);

const SPECIAL_VALUES = new Map([
  ['diez', 10],
  ['once', 11],
  ['doce', 12],
  ['trece', 13],
  ['catorce', 14],
  ['quince', 15],
  ['dieciséis', 16],
  ['diecisiete', 17],
  ['dieciocho', 18],
  ['diecinueve', 19],
  ['veinte', 20],
  ['veintiuno', 21],
  ['veintiún', 21],
  ['veintiuna', 21],
  ['veintidós', 22],
  ['veintitrés', 23],
  ['veinticuatro', 24],
  ['veinticinco', 25],
  ['veintiséis', 26],
  ['veintisiete', 27],
  ['veintiocho', 28],
  ['veintinueve', 29],
]);

const TENS_VALUES = new Map([
  ['treinta', 30],
  ['cuarenta', 40],
  ['cincuenta', 50],
  ['sesenta', 60],
  ['setenta', 70],
  ['ochenta', 80],
  ['noventa', 90],
]);

const HUNDREDS_VALUES = new Map([
  ['cien', 100],
  ['ciento', 100],
  ['doscientos', 200],
  ['trescientos', 300],
  ['cuatrocientos', 400],
  ['quinientos', 500],
  ['seiscientos', 600],
  ['setecientos', 700],
  ['ochocientos', 800],
  ['novecientos', 900],
]);

function loadNumberUtils() {
  const source = fs.readFileSync(new URL('../src/utils/numbers.ts', import.meta.url), 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;

  const module = { exports: {} };
  new Function('exports', 'module', transpiled)(module.exports, module);
  return module.exports;
}

const { getSpanishNumberBreakdown, numberToSpanish } = loadNumberUtils();

function expectSpanish(num, expected) {
  assert.equal(numberToSpanish(num), expected, `Unexpected Spanish for ${num.toLocaleString()}`);
}

function tokenize(text) {
  return text.trim().split(/\s+/).filter(Boolean);
}

function parseSubHundred(tokens) {
  if (tokens.length === 0) return 0;
  if (tokens.length === 1) {
    const [token] = tokens;
    if (SPECIAL_VALUES.has(token)) return SPECIAL_VALUES.get(token);
    if (UNIT_VALUES.has(token)) return UNIT_VALUES.get(token);
    if (TENS_VALUES.has(token)) return TENS_VALUES.get(token);
    throw new Error(`Unknown sub-hundred token: ${token}`);
  }

  if (tokens.length === 3 && TENS_VALUES.has(tokens[0]) && tokens[1] === 'y' && UNIT_VALUES.has(tokens[2])) {
    return TENS_VALUES.get(tokens[0]) + UNIT_VALUES.get(tokens[2]);
  }

  throw new Error(`Unsupported sub-hundred form: "${tokens.join(' ')}"`);
}

function parseBelowThousand(tokens) {
  if (tokens.length === 0) return 0;
  if (tokens.length === 1 && tokens[0] === 'cero') return 0;

  const [first, ...rest] = tokens;
  if (HUNDREDS_VALUES.has(first)) {
    if (first === 'cien') {
      if (rest.length > 0) {
        throw new Error(`Invalid compound hundred form: "${tokens.join(' ')}"`);
      }
      return 100;
    }
    return HUNDREDS_VALUES.get(first) + parseSubHundred(rest);
  }

  return parseSubHundred(tokens);
}

function parseBelowMillion(tokens) {
  if (tokens.length === 0) return 0;

  const thousandIndex = tokens.indexOf('mil');
  if (thousandIndex === -1) {
    return parseBelowThousand(tokens);
  }

  const left = tokens.slice(0, thousandIndex);
  const right = tokens.slice(thousandIndex + 1);
  const thousands = left.length === 0 ? 1 : parseBelowThousand(left);

  if (thousands < 1 || thousands > 999) {
    throw new Error(`Invalid thousands coefficient: "${left.join(' ')}"`);
  }

  return thousands * 1000 + parseBelowThousand(right);
}

function parseSpanishNumber(text) {
  if (text === 'un billón') return 1_000_000_000_000;

  const tokens = tokenize(text);
  if (tokens.length === 0) {
    throw new Error('Cannot parse empty Spanish numeral');
  }

  const millionIndex = tokens.findIndex(token => token === 'millón' || token === 'millones');
  if (millionIndex !== -1) {
    const left = tokens.slice(0, millionIndex);
    const right = tokens.slice(millionIndex + 1);
    const millions = left.length === 0 ? 1 : parseBelowMillion(left);

    if (millions < 1 || millions > 999999) {
      throw new Error(`Invalid millions coefficient: "${left.join(' ')}"`);
    }

    return millions * 1_000_000 + parseBelowMillion(right);
  }

  return parseBelowMillion(tokens);
}

function validateCorpusCases() {
  const sourceIds = new Set(validationSources.map(source => source.id));
  for (const { num, expected, source } of canonicalCases) {
    assert.ok(sourceIds.has(source), `Unknown validation source "${source}" for ${num}`);
    expectSpanish(num, expected);
    assert.equal(parseSpanishNumber(expected), num, `Corpus parser mismatch for ${expected}`);
  }
}

function validateStructuralRoundTrips() {
  for (let num = 0; num <= 999999; num++) {
    const text = numberToSpanish(num);
    assert.equal(parseSpanishNumber(text), num, `Round-trip mismatch below one million for ${num}: "${text}"`);
    assert.equal(text.trim(), text, `Unexpected surrounding spaces for ${num}: "${text}"`);
    assert.ok(!text.includes('  '), `Unexpected double spaces for ${num}: "${text}"`);
  }

  for (let millionCount = 1; millionCount <= 999999; millionCount++) {
    const num = millionCount * 1_000_000;
    const text = numberToSpanish(num);
    assert.equal(parseSpanishNumber(text), num, `Round-trip mismatch for exact millions ${num}: "${text}"`);
  }
}

function validateGrammarInvariants() {
  for (let num = 101; num <= 199; num++) {
    const text = numberToSpanish(num);
    assert.ok(text.startsWith('ciento '), `Expected ciento-form for ${num}: "${text}"`);
  }

  for (let thousandCount = 2; thousandCount <= 999; thousandCount++) {
    const text = numberToSpanish(thousandCount * 1000);
    assert.ok(!/\buno mil\b/.test(text), `Invalid "uno mil" form: "${text}"`);
    assert.ok(!/\bveintiuno mil\b/.test(text), `Invalid "veintiuno mil" form: "${text}"`);
    assert.ok(!/\by uno mil\b/.test(text), `Invalid "... y uno mil" form: "${text}"`);
  }

  for (let millionCount = 2; millionCount <= 999999; millionCount++) {
    const text = numberToSpanish(millionCount * 1_000_000);
    assert.ok(!/\buno millones\b/.test(text), `Invalid "uno millones" form: "${text}"`);
    assert.ok(!/\bveintiuno millones\b/.test(text), `Invalid "veintiuno millones" form: "${text}"`);
    assert.ok(!/\by uno millones\b/.test(text), `Invalid "... y uno millones" form: "${text}"`);
  }

  assert.equal(numberToSpanish(1_000_000_000), 'mil millones');
  assert.equal(numberToSpanish(MAX_SUPPORTED_NUMBER), 'un billón');
}

function validateBreakdowns() {
  assert.deepEqual(getSpanishNumberBreakdown(0), [
    { label: 'Whole number', value: 0, spanish: 'cero' },
  ]);

  assert.deepEqual(getSpanishNumberBreakdown(1234567), [
    { label: 'Millions', value: 1000000, spanish: 'un millón' },
    { label: 'Thousands', value: 234000, spanish: 'doscientos treinta y cuatro mil' },
    { label: 'Remainder', value: 567, spanish: 'quinientos sesenta y siete' },
  ]);

  assert.deepEqual(getSpanishNumberBreakdown(1001000), [
    { label: 'Millions', value: 1000000, spanish: 'un millón' },
    { label: 'Thousands', value: 1000, spanish: 'mil' },
  ]);

  assert.deepEqual(getSpanishNumberBreakdown(1000000000000), [
    { label: 'Billón', value: 1000000000000, spanish: 'un billón' },
  ]);
}

function deterministicSample(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function validateSampledCompositeNumbers() {
  const random = deterministicSample(20260408);
  const representativeRemainders = [
    0,
    1,
    21,
    31,
    99,
    100,
    101,
    121,
    999,
    1000,
    1001,
    1021,
    21000,
    31000,
    121000,
    999999,
  ];

  for (const remainder of representativeRemainders) {
    for (const millions of [1, 2, 21, 31, 121, 999, 1000, 1500, 999999]) {
      const num = millions * 1_000_000 + remainder;
      if (num <= MAX_SUPPORTED_NUMBER) {
        const text = numberToSpanish(num);
        assert.equal(parseSpanishNumber(text), num, `Representative composite mismatch for ${num}: "${text}"`);
      }
    }
  }

  for (let i = 0; i < 25000; i++) {
    const num = Math.floor(random() * MAX_SUPPORTED_NUMBER);
    const text = numberToSpanish(num);
    assert.equal(parseSpanishNumber(text), num, `Random round-trip mismatch for ${num}: "${text}"`);
  }
}

validateCorpusCases();
validateStructuralRoundTrips();
validateGrammarInvariants();
validateBreakdowns();
validateSampledCompositeNumbers();

console.log(`Spanish number validation passed with ${canonicalCases.length} source-backed corpus cases.`);
