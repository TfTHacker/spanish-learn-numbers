// Practice Panel - SRS flashcard practice

import { Notice } from 'obsidian';
import LearnSpanishNumbersPlugin from '../plugin';
import { APP_ICONS, iconOnly } from '../ui/icons';
import { LearnSpanishNumbersView } from '../view';
import { DEFAULT_RANGES, CardData } from '../types';
import { applyPracticeAction, ensurePracticeCards, getDuePracticeCards } from '../utils/learning';
import { numberToSpanish } from '../utils/numbers';

export class PracticePanel {
  private plugin: LearnSpanishNumbersPlugin;
  private container: HTMLElement;
  private view: LearnSpanishNumbersView;

  constructor(plugin: LearnSpanishNumbersPlugin, container: HTMLElement, view: LearnSpanishNumbersView) {
    this.plugin = plugin;
    this.container = container;
    this.view = view;
  }

  render() {
    this.container.innerHTML = `
      <div class="lsn-wrap">
        <button id="btn-home" class="lsn-home-btn" aria-label="Home">${iconOnly(APP_ICONS.home)}</button>
      </div>
    `;

    this.container.querySelector('#btn-home')?.addEventListener('click', async () => {
      await this.plugin.saveSettings();
      this.plugin.currentPanel = 'dashboard';
      this.plugin.render();
    });

    this.startPractice();
  }

  private startPractice() {
    const ranges = this.plugin.settings.customNumberRanges || DEFAULT_RANGES;
    const validation = this.plugin.validateCustomRanges(ranges);
    
    if (!validation.valid || !validation.numbers?.length) {
      new Notice(`Invalid ranges: ${validation.error || 'Check settings'}`);
      return;
    }

    const numbers = validation.numbers!;
    this.plugin.cards = ensurePracticeCards(this.plugin.cards, numbers);

    // Get due cards for the numbers in our range
    const now = Date.now();
    const due = getDuePracticeCards(this.plugin.cards, numbers, now);
    
    if (due.length === 0) {
      new Notice('No cards due for practice!');
      this.plugin.currentPanel = 'dashboard';
      this.plugin.render();
      return;
    }
    
    // Shuffle using plugin's shuffle method
    const shuffledDue = this.plugin.shuffleArray(due);
    this.plugin.markTestedToday();
    void this.plugin.saveSettings();
    
    this.doPractice(shuffledDue, 0, 0);
  }

  private doPractice(cards: CardData[], correct: number, total: number) {
    if (cards.length === 0) {
      this.plugin.updateStreak();
      // Record session history
      this.plugin.addSessionHistory({
        cardsReviewed: total,
        correct,
        mode: 'srs',
        groups: []
      });
      this.plugin.currentPanel = 'dashboard';
      this.plugin.saveSettings();
      new Notice(`Session complete! ${correct}/${total} correct`);
      this.plugin.render();
      return;
    }

    const card = cards[0];
    const spanish = numberToSpanish(card.number);
    const question = card.number.toLocaleString();
    const answer = spanish;
    const totalCards = total + cards.length;

    this.container.innerHTML = `
      <div class="lsn-wrap">
        <div class="lsn-text-center lsn-mb-16">
          <span class="lsn-text-muted lsn-text-muted-sm">${totalCards} cards remaining</span>
        </div>
        <div class="lsn-question-box lsn-practice-question-box">
          <div class="lsn-question-text lsn-word-break">${question}</div>
        </div>
        <div class="lsn-practice-answer-stage lsn-mb-24">
          <div id="answer-area" class="lsn-answer-box lsn-practice-answer-box lsn-practice-answer-pending">
            <div class="lsn-answer-text lsn-word-break">${answer}</div>
            <button id="btn-play-answer" class="lsn-btn-icon-lg" aria-label="Play audio">${iconOnly(APP_ICONS.audio, 'lsn-icon-lg')}</button>
          </div>
          <div class="lsn-practice-controls">
            <button id="btn-reveal" class="lsn-btn-reveal lsn-practice-primary-action">Show Answer</button>
            <div id="review-actions" class="lsn-btn-grid-3 lsn-practice-review-actions lsn-hidden">
            <button id="btn-again" class="lsn-btn-warning">Again</button>
            <button id="btn-hard" class="lsn-btn-hard">Hard</button>
            <button id="btn-good" class="lsn-btn-primary">Good</button>
            </div>
          </div>
        </div>
        <div class="lsn-footer-actions">
          <div class="lsn-footer-actions-left">
            <button id="btn-skip" class="lsn-home-btn-text">Skip</button>
          </div>
          <button id="btn-home" class="lsn-home-btn-text" aria-label="Home">${iconOnly(APP_ICONS.home)}</button>
        </div>
      </div>
    `;

    // Reveal answer
    this.container.querySelector('#btn-reveal')?.addEventListener('click', () => {
      const answerArea = this.container.querySelector('#answer-area') as HTMLElement;
      const revealBtn = this.container.querySelector('#btn-reveal') as HTMLButtonElement;
      const reviewActions = this.container.querySelector('#review-actions') as HTMLElement;
      answerArea.classList.remove('lsn-practice-answer-pending');
      revealBtn.classList.add('lsn-hidden');
      reviewActions.classList.remove('lsn-hidden');
      // Play audio for the Spanish word (regardless of direction)
      this.plugin.playAudio(spanish);
    });

    // Play audio button
    this.container.querySelector('#btn-play-answer')?.addEventListener('click', () => {
      this.plugin.playAudio(spanish, undefined, true);
    });

    // Again - put at back of queue with short interval
    this.container.querySelector('#btn-again')?.addEventListener('click', () => {
      Object.assign(card, applyPracticeAction(card, 'again', Date.now()));
      this.doPractice([...cards.slice(1), card], correct, total + 1);
    });

    // Hard - decrease ease, shorter interval
    this.container.querySelector('#btn-hard')?.addEventListener('click', () => {
      Object.assign(card, applyPracticeAction(card, 'hard', Date.now()));
      this.doPractice(cards.slice(1), correct + 1, total + 1);
    });

    // Good - standard SM-2 progression
    this.container.querySelector('#btn-good')?.addEventListener('click', () => {
      Object.assign(card, applyPracticeAction(card, 'good', Date.now()));
      this.doPractice(cards.slice(1), correct + 1, total + 1);
    });

    // Skip - move to end without recording
    this.container.querySelector('#btn-skip')?.addEventListener('click', () => {
      this.doPractice([...cards.slice(1), card], correct, total);
    });

    // Home - save and go back
    this.container.querySelector('#btn-home')?.addEventListener('click', async () => {
      await this.plugin.saveSettings();
      this.plugin.currentPanel = 'dashboard';
      this.plugin.render();
    });
  }
}
