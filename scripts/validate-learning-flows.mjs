import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const moduleCache = new Map();

function loadModuleFromUrl(url) {
  const cacheKey = url.href;
  if (moduleCache.has(cacheKey)) {
    return moduleCache.get(cacheKey);
  }

  const source = fs.readFileSync(url, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;

  const module = { exports: {} };
  moduleCache.set(cacheKey, module.exports);

  const localRequire = (specifier) => {
    if (specifier.startsWith('.')) {
      const resolved = new URL(
        specifier.endsWith('.ts') || specifier.endsWith('.js') || specifier.endsWith('.mjs')
          ? specifier
          : `${specifier}.ts`,
        url
      );
      return loadModuleFromUrl(resolved);
    }

    throw new Error(`Unsupported dependency in regression validator: ${specifier}`);
  };

  new Function('exports', 'module', 'require', transpiled)(module.exports, module, localRequire);
  moduleCache.set(cacheKey, module.exports);
  return module.exports;
}

function loadModule(relativePath) {
  return loadModuleFromUrl(new URL(relativePath, import.meta.url));
}

const learning = loadModule('../src/utils/learning.ts');
const ranges = loadModule('../src/utils/ranges.ts');
const { TRICKY_NUMBERS } = loadModule('../src/types.ts');

const {
  DEFAULT_RETRY_INTERVAL_MS,
  INTERVAL_GOOD_FIRST,
  INTERVAL_GOOD_SECOND,
  INTERVAL_HARD,
  MS_PER_DAY,
  applyCramAgain,
  applyCramGood,
  applyPracticeAction,
  buildCramSession,
  createPracticeCard,
  ensurePracticeCards,
  getDuePracticeCards,
  getListenLearnDisplayState,
  restartCramSession,
  trimSessionHistory,
} = learning;
const { validateCustomRanges } = ranges;

function expectEqual(actual, expected, message) {
  assert.deepEqual(actual, expected, message);
}

function testPracticeCardCreation() {
  const cards = ensurePracticeCards([], [15, 21]);
  assert.equal(cards.length, 4, 'Expected forward and reverse cards for each number');
  const cardIds = cards.map(card => card.id).sort();
  expectEqual(cardIds, ['n15-forward', 'n15-reverse', 'n21-forward', 'n21-reverse']);
  assert.equal(cards.find(card => card.id === 'n15-forward')?.isTricky, TRICKY_NUMBERS.has(15));
  assert.equal(cards.find(card => card.id === 'n21-forward')?.isTricky, TRICKY_NUMBERS.has(21));
}

function testPracticeNoDuplicateCards() {
  const original = [createPracticeCard(7, 'forward')];
  const cards = ensurePracticeCards(original, [7]);
  assert.equal(cards.length, 2, 'Existing practice cards should not be duplicated');
  assert.equal(cards.filter(card => card.id === 'n7-forward').length, 1);
}

function testPracticeDueFiltering() {
  const cards = [
    { ...createPracticeCard(1, 'forward'), dueDate: 10 },
    { ...createPracticeCard(1, 'reverse'), dueDate: 20 },
    { ...createPracticeCard(2, 'forward'), dueDate: 30 },
  ];
  const due = getDuePracticeCards(cards, [1, 2], 20);
  expectEqual(due.map(card => card.id), ['n1-forward']);
}

function testPracticeAgain() {
  const now = 1000;
  const updated = applyPracticeAction(createPracticeCard(5, 'forward'), 'again', now);
  assert.equal(updated.reviews, 1);
  assert.equal(updated.correct, 0);
  assert.equal(updated.interval, 0);
  assert.equal(updated.dueDate, now + DEFAULT_RETRY_INTERVAL_MS);
}

function testPracticeHard() {
  const now = 5000;
  const card = { ...createPracticeCard(8, 'reverse'), ease: 1.35, interval: 10 };
  const updated = applyPracticeAction(card, 'hard', now);
  assert.equal(updated.reviews, 1);
  assert.equal(updated.correct, 1);
  assert.equal(updated.ease, 1.3, 'Ease should floor at 1.3');
  assert.equal(updated.interval, INTERVAL_HARD);
  assert.equal(updated.dueDate, now + INTERVAL_HARD * MS_PER_DAY);
}

function testPracticeGoodProgression() {
  const now = 10000;
  const first = applyPracticeAction(createPracticeCard(12, 'forward'), 'good', now);
  assert.equal(first.interval, INTERVAL_GOOD_FIRST);
  assert.equal(first.correct, 1);
  assert.equal(first.ease, 2.6);

  const second = applyPracticeAction(first, 'good', now + MS_PER_DAY);
  assert.equal(second.interval, INTERVAL_GOOD_SECOND);
  assert.equal(second.correct, 2);
  assert.equal(second.ease, 2.7);

  const third = applyPracticeAction(second, 'good', now + 2 * MS_PER_DAY);
  assert.equal(third.interval, Math.round(INTERVAL_GOOD_SECOND * third.ease));
  assert.equal(third.correct, 3);
}

function deterministicShuffle(items) {
  return [...items].reverse();
}

function testCramSessionBuild() {
  const state = buildCramSession([1, 2, 3], false, deterministicShuffle);
  assert.equal(state.totalCards, 3);
  assert.equal(state.isShuffled, false);
  expectEqual(state.unknownCards.map(card => card.number), [1, 2, 3], 'Sequential cram mode should preserve order');
}

function testCramSessionShuffle() {
  const state = buildCramSession([1, 2, 3], true, deterministicShuffle);
  expectEqual(state.unknownCards.map(card => card.number), [3, 2, 1], 'Shuffled cram mode should use the provided shuffle order');
}

function testCramAgain() {
  const start = buildCramSession([11, 12, 13], false, deterministicShuffle);
  const next = applyCramAgain(start);
  assert.equal(next.sessionReviewed, 1);
  assert.equal(next.sessionCorrect, 0);
  assert.equal(next.knownCount, 0);
  expectEqual(next.unknownCards.map(card => card.number), [12, 13, 11]);
}

function testCramGood() {
  const start = buildCramSession([21, 22], false, deterministicShuffle);
  const next = applyCramGood(start);
  assert.equal(next.sessionReviewed, 1);
  assert.equal(next.sessionCorrect, 1);
  assert.equal(next.knownCount, 1);
  expectEqual(next.unknownCards.map(card => card.number), [22]);
}

function testCramRestartPreservesOrderMode() {
  const sequential = buildCramSession([30, 31, 32], false, deterministicShuffle);
  const restartedSequential = restartCramSession(sequential, deterministicShuffle);
  assert.equal(restartedSequential.isShuffled, false);
  expectEqual(restartedSequential.unknownCards.map(card => card.number), [30, 31, 32], 'Restart should preserve sequential mode');

  const shuffled = buildCramSession([30, 31, 32], true, deterministicShuffle);
  const restartedShuffled = restartCramSession(shuffled, deterministicShuffle);
  assert.equal(restartedShuffled.isShuffled, true);
  expectEqual(restartedShuffled.unknownCards.map(card => card.number), [32, 31, 30], 'Restart should preserve shuffle mode');
}

function testHistoryTrimming() {
  const now = Date.parse('2026-04-08T12:00:00.000Z');
  const history = [
    { date: '2026-04-08T11:00:00.000Z', cardsReviewed: 1, correct: 1, mode: 'srs', groups: [] },
    { date: '2026-03-15T11:00:00.000Z', cardsReviewed: 2, correct: 2, mode: 'cram', groups: ['1-10'] },
    { date: '2026-03-01T11:00:00.000Z', cardsReviewed: 3, correct: 3, mode: 'srs', groups: [] },
  ];
  const trimmed = trimSessionHistory(history, now);
  assert.equal(trimmed.length, 2, 'History entries older than 30 days should be discarded');
  expectEqual(trimmed.map(entry => entry.date), ['2026-04-08T11:00:00.000Z', '2026-03-15T11:00:00.000Z']);
}

function testListenLearnDisplayPhases() {
  const hidden = getListenLearnDisplayState(false, false, 'uno');
  assert.equal(hidden.answerVisible, true);
  assert.equal(hidden.answerMarkup, '<div class="lsn-slideshow-waiting">...</div>');

  const revealed = getListenLearnDisplayState(false, true, 'uno');
  assert.equal(revealed.answerVisible, true);
  assert.equal(revealed.answerMarkup, '<div class="lsn-slideshow-second">uno</div>');

  const esOnly = getListenLearnDisplayState(true, false, 'unused');
  assert.equal(esOnly.answerVisible, false);
  assert.equal(esOnly.answerMarkup, '');
}

function testRangeValidation() {
  assert.deepEqual(validateCustomRanges('1-3, 3, [5], 7'), {
    valid: true,
    numbers: [1, 2, 3, 5, 7],
  });

  assert.deepEqual(validateCustomRanges('[1-3], [5, 7]').numbers, [1, 2, 3, 5, 7]);
  assert.equal(validateCustomRanges('').valid, false);
  assert.equal(validateCustomRanges('10-1').valid, false);
  assert.equal(validateCustomRanges('0-5000').valid, false, 'Expanded ranges over 5,000 values should be rejected');
  assert.equal(validateCustomRanges('1000000000001').valid, false, 'Numbers over one trillion should be rejected');
}

testPracticeCardCreation();
testPracticeNoDuplicateCards();
testPracticeDueFiltering();
testPracticeAgain();
testPracticeHard();
testPracticeGoodProgression();
testCramSessionBuild();
testCramSessionShuffle();
testCramAgain();
testCramGood();
testCramRestartPreservesOrderMode();
testHistoryTrimming();
testListenLearnDisplayPhases();
testRangeValidation();

console.log('Learning flow regression validation passed.');
