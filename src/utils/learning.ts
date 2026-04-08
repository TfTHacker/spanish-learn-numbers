import { CardData, SessionHistory, TRICKY_NUMBERS } from '../types';

export const MS_PER_DAY = 24 * 60 * 60 * 1000;
export const DEFAULT_RETRY_INTERVAL_MS = 60 * 1000;
export const INTERVAL_HARD = 1;
export const INTERVAL_GOOD_FIRST = 1;
export const INTERVAL_GOOD_SECOND = 6;

export type PracticeAction = 'again' | 'hard' | 'good';

export interface CramCard {
  number: number;
}

export interface CramSessionState {
  allNumbers: number[];
  unknownCards: CramCard[];
  totalCards: number;
  knownCount: number;
  sessionCorrect: number;
  sessionReviewed: number;
  isShuffled: boolean;
}

export interface ListenLearnDisplayState {
  answerVisible: boolean;
  answerMarkup: string;
}

type ShuffleFn = <T>(items: T[]) => T[];

export function createPracticeCard(number: number, direction: 'forward' | 'reverse'): CardData {
  return {
    id: `n${number}-${direction}`,
    number,
    direction,
    group: '',
    interval: 0,
    ease: 2.5,
    dueDate: 0,
    reviews: 0,
    correct: 0,
    isTricky: TRICKY_NUMBERS.has(number),
    lastReviewed: null
  };
}

export function ensurePracticeCards(cards: CardData[], numbers: number[]): CardData[] {
  const existingIds = new Set(cards.map(card => card.id));
  const nextCards = [...cards];

  for (const number of numbers) {
    for (const direction of ['forward', 'reverse'] as const) {
      const id = `n${number}-${direction}`;
      if (!existingIds.has(id)) {
        nextCards.push(createPracticeCard(number, direction));
        existingIds.add(id);
      }
    }
  }

  return nextCards;
}

export function getDuePracticeCards(cards: CardData[], numbers: number[], now: number): CardData[] {
  const allowedNumbers = new Set(numbers);
  return cards.filter(
    card => allowedNumbers.has(card.number) && card.direction === 'forward' && card.dueDate <= now
  );
}

export function applyPracticeAction(card: CardData, action: PracticeAction, now: number): CardData {
  const updatedCard: CardData = {
    ...card,
    reviews: card.reviews + 1,
    lastReviewed: now
  };

  if (action === 'again') {
    updatedCard.dueDate = now + DEFAULT_RETRY_INTERVAL_MS;
    return updatedCard;
  }

  updatedCard.correct = card.correct + 1;

  if (action === 'hard') {
    updatedCard.ease = Math.max(1.3, card.ease - 0.15);
    updatedCard.interval = INTERVAL_HARD;
    updatedCard.dueDate = now + INTERVAL_HARD * MS_PER_DAY;
    return updatedCard;
  }

  updatedCard.ease = Math.min(3.0, card.ease + 0.1);
  if (card.interval === 0) {
    updatedCard.interval = INTERVAL_GOOD_FIRST;
  } else if (card.interval === 1) {
    updatedCard.interval = INTERVAL_GOOD_SECOND;
  } else {
    updatedCard.interval = Math.round(card.interval * updatedCard.ease);
  }
  updatedCard.dueDate = now + updatedCard.interval * MS_PER_DAY;
  return updatedCard;
}

export function trimSessionHistory(history: SessionHistory[], now: number): SessionHistory[] {
  const thirtyDaysAgo = now - 30 * MS_PER_DAY;
  return history.filter(entry => new Date(entry.date).getTime() > thirtyDaysAgo);
}

export function buildCramSession(
  allNumbers: number[],
  isShuffled: boolean,
  shuffleArray: ShuffleFn
): CramSessionState {
  let unknownCards = allNumbers.map(number => ({ number }));

  if (isShuffled) {
    unknownCards = shuffleArray(unknownCards);
  }

  return {
    allNumbers,
    unknownCards,
    totalCards: unknownCards.length,
    knownCount: 0,
    sessionCorrect: 0,
    sessionReviewed: 0,
    isShuffled
  };
}

export function applyCramAgain(state: CramSessionState): CramSessionState {
  if (state.unknownCards.length === 0) return state;

  const [current, ...rest] = state.unknownCards;
  return {
    ...state,
    unknownCards: [...rest, { number: current.number }],
    sessionReviewed: state.sessionReviewed + 1
  };
}

export function applyCramGood(state: CramSessionState): CramSessionState {
  if (state.unknownCards.length === 0) return state;

  return {
    ...state,
    unknownCards: state.unknownCards.slice(1),
    knownCount: state.knownCount + 1,
    sessionCorrect: state.sessionCorrect + 1,
    sessionReviewed: state.sessionReviewed + 1
  };
}

export function restartCramSession(
  state: CramSessionState,
  shuffleArray: ShuffleFn
): CramSessionState {
  return buildCramSession(state.allNumbers, state.isShuffled, shuffleArray);
}

export function getListenLearnDisplayState(
  isEsOnly: boolean,
  showAnswer: boolean,
  secondText: string
): ListenLearnDisplayState {
  if (isEsOnly) {
    return {
      answerVisible: false,
      answerMarkup: ''
    };
  }

  return {
    answerVisible: true,
    answerMarkup: showAnswer
      ? `<div class="lsn-slideshow-second">${secondText}</div>`
      : `<div class="lsn-slideshow-waiting">...</div>`
  };
}
