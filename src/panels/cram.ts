// Cram Panel - Drill until all cards are known

import { Notice } from 'obsidian';
import LearnSpanishNumbersPlugin from '../plugin';
import { FOCUSED_RANGE_PRESETS } from '../types';
import { APP_ICONS, iconOnly, iconWithLabel } from '../ui/icons';
import { LearnSpanishNumbersView } from '../view';
import { applyCramAgain, applyCramGood, buildCramSession, CramCard, CramSessionState, restartCramSession } from '../utils/learning';
import { numberToSpanish } from '../utils/numbers';

export class CramPanel {
  private plugin: LearnSpanishNumbersPlugin;
  private container: HTMLElement;
  private view: LearnSpanishNumbersView;
  private setupIsShuffled: boolean = false;
  private session: CramSessionState = {
    allNumbers: [],
    unknownCards: [],
    totalCards: 0,
    knownCount: 0,
    sessionCorrect: 0,
    sessionReviewed: 0,
    isShuffled: false
  };

  constructor(plugin: LearnSpanishNumbersPlugin, container: HTMLElement, view: LearnSpanishNumbersView) {
    this.plugin = plugin;
    this.container = container;
    this.view = view;
  }

  render() {
    this.showSetup();
  }

  private formatRecentLabel(inputText: string, shuffled: boolean) {
    const normalizedInput = inputText.replace(/\s+/g, ' ').trim();
    const shortInput = normalizedInput.length > 42 ? `${normalizedInput.slice(0, 42).trimEnd()}...` : normalizedInput;
    return `${shortInput} | ${shuffled ? 'Shuffle' : 'Sequential'}`;
  }

  private showSetup() {
    const lastRanges = this.plugin.settings.lastCramRanges || this.plugin.settings.customNumberRanges || '1-20';
    const recentConfigs = this.plugin.settings.cramRecentConfigs ?? [];
    let isShuffled = this.setupIsShuffled;

    this.container.innerHTML = `
      <div class="lsn-wrap">
        <h2 class="lsn-title-lg lsn-mb-24">Cram Test</h2>
        <p class="lsn-subtitle">Drill until you know all the cards!</p>
        <div class="lsn-card-sm">
          <div class="lsn-label">Number Range</div>
          <div class="lsn-example">Enter numbers or ranges separated by commas.</div>
          <div class="lsn-label">Focused Presets</div>
          <div class="lsn-preset-grid lsn-preset-grid-compact lsn-mb-16">
            ${FOCUSED_RANGE_PRESETS.map((preset) => `
              <button type="button" class="lsn-preset-btn lsn-preset-btn-compact" data-preset="${preset.id}" title="${preset.label}">
                <span class="lsn-preset-range">${preset.compactLabel ?? preset.ranges}</span>
              </button>
            `).join('')}
          </div>
          ${recentConfigs.length > 0 ? `
            <div class="lsn-label">Recents</div>
            <select id="cram-history-select" class="lsn-input lsn-mb-16">
              <option value="">Choose a recent setup...</option>
              ${recentConfigs.map((config, index) => `
                <option value="${index}">${this.formatRecentLabel(config.inputText, config.shuffled)}</option>
              `).join('')}
            </select>
          ` : ''}
          <textarea id="cram-ranges" class="lsn-textarea" placeholder="1-10, 20-30, 5, 10, 15">${lastRanges}</textarea>

          <div class="lsn-mt-16">
            <label class="lsn-label">Order:</label>
            <div style="display:flex;gap:8px;">
              <button id="order-seq" class="lsn-btn-order lsn-btn-with-icon lsn-btn-order-active">${APP_ICONS.sequential}<span>Sequential</span></button>
              <button id="order-shuf" class="lsn-btn-order lsn-btn-with-icon">${APP_ICONS.shuffle}<span>Shuffle</span></button>
            </div>
          </div>

          <button id="btn-start" class="lsn-btn-start lsn-mt-16">Start Cram</button>
        </div>
        <div class="lsn-footer-actions">
          <div class="lsn-footer-actions-left"></div>
          <button id="btn-home" class="lsn-home-btn-text" aria-label="Home">${iconOnly(APP_ICONS.home)}</button>
        </div>
      </div>
    `;

    const updateOrderButtons = () => {
      const seqBtn = this.container.querySelector('#order-seq') as HTMLElement;
      const shufBtn = this.container.querySelector('#order-shuf') as HTMLElement;
      if (isShuffled) {
        seqBtn.classList.remove('lsn-btn-order-active');
        shufBtn.classList.add('lsn-btn-order-active');
      } else {
        seqBtn.classList.add('lsn-btn-order-active');
        shufBtn.classList.remove('lsn-btn-order-active');
      }
    };

    updateOrderButtons();

    const rangesEl = this.container.querySelector('#cram-ranges') as HTMLTextAreaElement;
    const historyEl = this.container.querySelector('#cram-history-select') as HTMLSelectElement | null;

    this.container.querySelectorAll('[data-preset]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const presetId = (btn as HTMLElement).dataset.preset;
        const preset = FOCUSED_RANGE_PRESETS.find((item) => item.id === presetId);
        if (!preset) return;
        rangesEl.value = preset.ranges;
      });
    });

    historyEl?.addEventListener('change', async () => {
      const selectedIndex = Number(historyEl.value);
      if (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex >= recentConfigs.length) {
        return;
      }

      const selectedConfig = recentConfigs[selectedIndex];
      rangesEl.value = selectedConfig.inputText;
      isShuffled = selectedConfig.shuffled;
      this.setupIsShuffled = selectedConfig.shuffled;
      this.plugin.settings.lastCramRanges = selectedConfig.inputText;
      updateOrderButtons();
      await this.plugin.saveSettings();
    });

    this.container.querySelector('#order-seq')?.addEventListener('click', () => {
      isShuffled = false;
      this.setupIsShuffled = false;
      updateOrderButtons();
    });

    this.container.querySelector('#order-shuf')?.addEventListener('click', () => {
      isShuffled = true;
      this.setupIsShuffled = true;
      updateOrderButtons();
    });

    this.container.querySelector('#btn-home')?.addEventListener('click', () => {
      this.plugin.currentPanel = 'dashboard';
      this.plugin.render();
    });

    this.container.querySelector('#btn-start')?.addEventListener('click', async () => {
      const input = rangesEl.value.trim();
      if (!input) {
        new Notice('Enter number ranges');
        return;
      }
      const validation = this.plugin.validateCustomRanges(input);
      if (!validation.valid || !validation.numbers?.length) {
        new Notice(validation.error || 'Invalid ranges');
        return;
      }
      this.plugin.settings.lastCramRanges = input;
      this.plugin.rememberCramConfig(input, isShuffled);
      this.plugin.markTestedToday();
      await this.plugin.saveSettings();
      this.setupIsShuffled = isShuffled;

      this.session = buildCramSession(
        validation.numbers,
        isShuffled,
        this.plugin.shuffleArray.bind(this.plugin)
      );
      
      this.showCard();
    });
  }

  private showCard() {
    if (this.session.unknownCards.length === 0) {
      this.showComplete();
      return;
    }

    const card = this.session.unknownCards[0];
    const spanish = numberToSpanish(card.number);
    const question = card.number.toLocaleString();
    const answer = spanish;
    const progress = Math.round((this.session.knownCount / this.session.totalCards) * 100);
    const remaining = this.session.unknownCards.length;
    const current = this.session.totalCards - remaining + 1;

    this.container.innerHTML = `
      <div class="lsn-wrap">
        <div class="lsn-progress-header">
          <span></span>
          <span class="lsn-text-muted">${current} / ${this.session.totalCards}</span>
        </div>

        <div class="lsn-progress-section">
          <div class="lsn-progress-label">
            <span class="lsn-text-muted lsn-text-muted-sm">Progress</span>
            <span class="lsn-text-muted lsn-text-muted-sm">${progress}%</span>
          </div>
          <div class="lsn-progress-bar">
            <div class="lsn-progress-fill" style="width:${progress}%"></div>
          </div>
        </div>

        <div class="lsn-question-box-sm lsn-cram-question-box">
          <div class="lsn-question-text lsn-word-break">${question}</div>
        </div>

        <div class="lsn-cram-answer-stage lsn-mb-16">
          <div id="answer-area" class="lsn-question-box-sm lsn-cram-answer-box lsn-cram-answer-pending">
            <div class="lsn-answer-text lsn-word-break">${answer}</div>
            <button id="btn-play-a" class="lsn-btn-icon-lg lsn-cram-audio-hidden" aria-label="Play audio">${iconOnly(APP_ICONS.audio, 'lsn-icon-lg')}</button>
          </div>
          <div class="lsn-cram-controls">
            <button id="btn-show" class="lsn-btn-secondary lsn-cram-primary-action">Show Answer</button>
            <div id="review-actions" class="lsn-btn-grid lsn-cram-review-actions lsn-hidden">
            <button id="btn-again" class="lsn-btn-warning">Again</button>
            <button id="btn-good" class="lsn-btn-primary">Good</button>
            </div>
          </div>
        </div>

        <div class="lsn-footer-actions">
          <div class="lsn-footer-actions-left">
            <button id="btn-back" class="lsn-home-btn-text">${iconWithLabel(APP_ICONS.back, 'Back')}</button>
            <button id="btn-startover" class="lsn-home-btn-text">${iconWithLabel(APP_ICONS.restart, 'Start Over')}</button>
          </div>
          <button id="btn-home" class="lsn-home-btn-text" aria-label="Home">${iconOnly(APP_ICONS.home)}</button>
        </div>
      </div>
    `;

    this.container.querySelector('#btn-play-a')?.addEventListener('click', () => {
      this.plugin.playAudio(spanish, undefined, true);
    });

    this.container.querySelector('#btn-show')?.addEventListener('click', () => {
      const answerArea = this.container.querySelector('#answer-area') as HTMLElement;
      const reviewActions = this.container.querySelector('#review-actions') as HTMLElement;
      const showBtn = this.container.querySelector('#btn-show') as HTMLButtonElement;
      const playBtn = this.container.querySelector('#btn-play-a') as HTMLButtonElement;
      answerArea.classList.remove('lsn-cram-answer-pending');
      reviewActions.classList.remove('lsn-hidden');
      showBtn.classList.add('lsn-hidden');
      playBtn.classList.remove('lsn-cram-audio-hidden');
      this.plugin.playAudio(spanish);
    });

    this.container.querySelector('#btn-again')?.addEventListener('click', () => {
      this.session = applyCramAgain(this.session);
      this.showCard();
    });

    this.container.querySelector('#btn-good')?.addEventListener('click', () => {
      this.session = applyCramGood(this.session);
      this.showCard();
    });

    this.container.querySelector('#btn-startover')?.addEventListener('click', () => {
      this.session = restartCramSession(
        this.session,
        this.plugin.shuffleArray.bind(this.plugin)
      );
      this.showCard();
    });

    this.container.querySelector('#btn-back')?.addEventListener('click', () => {
      this.setupIsShuffled = this.session.isShuffled;
      this.showSetup();
    });

    this.container.querySelector('#btn-home')?.addEventListener('click', async () => {
      // Record session history
      if (this.session.sessionReviewed > 0) {
        this.plugin.addSessionHistory({
          cardsReviewed: this.session.sessionReviewed,
          correct: this.session.sessionCorrect,
          mode: 'cram',
          groups: [this.plugin.settings.lastCramRanges || '']
        });
        await this.plugin.saveSettings();
      }
      this.plugin.currentPanel = 'dashboard';
      this.plugin.render();
    });
  }

  private showComplete() {
    // Record session history
    this.plugin.addSessionHistory({
      cardsReviewed: this.session.sessionReviewed,
      correct: this.session.sessionCorrect,
      mode: 'cram',
      groups: [this.plugin.settings.lastCramRanges || '']
    });
    this.plugin.saveSettings();

    this.container.innerHTML = `
      <div class="lsn-wrap lsn-text-center">
        <h2 class="lsn-title-lg lsn-mb-16">Session Complete!</h2>
        <p class="lsn-subtitle lsn-mb-24">You reviewed all ${this.session.totalCards} cards.</p>
        <div class="lsn-footer-actions">
          <div class="lsn-footer-actions-left">
            <button id="btn-back" class="lsn-home-btn-text">${iconWithLabel(APP_ICONS.back, 'Back')}</button>
            <button id="btn-startover" class="lsn-home-btn-text">${iconWithLabel(APP_ICONS.restart, 'Start Over')}</button>
          </div>
          <button id="btn-home" class="lsn-home-btn-text" aria-label="Home">${iconOnly(APP_ICONS.home)}</button>
        </div>
      </div>
    `;

    this.container.querySelector('#btn-back')?.addEventListener('click', () => {
      this.setupIsShuffled = this.session.isShuffled;
      this.showSetup();
    });

    this.container.querySelector('#btn-startover')?.addEventListener('click', () => {
      this.session = restartCramSession(
        this.session,
        this.plugin.shuffleArray.bind(this.plugin)
      );
      this.showCard();
    });

    this.container.querySelector('#btn-home')?.addEventListener('click', () => {
      this.plugin.currentPanel = 'dashboard';
      this.plugin.render();
    });
  }
}
