// Listen & Learn Panel - Audio slideshow for learning numbers

import { Notice } from 'obsidian';
import LearnSpanishNumbersPlugin from '../plugin';
import { FOCUSED_RANGE_PRESETS } from '../types';
import { APP_ICONS, iconOnly, iconWithLabel } from '../ui/icons';
import { LearnSpanishNumbersView } from '../view';
import { getListenLearnDisplayState } from '../utils/learning';
import { numberToSpanish, numberToWordsEnglish } from '../utils/numbers';
import { escapeHtml } from '../utils/html';

const AUTO_REVEAL_DELAY_MS = 4000;
const AUTO_ADVANCE_DELAY_MS = 4000;
const MANUAL_REVEAL_DELAY_MS = 2000;

export class ListenLearnPanel {
  private plugin: LearnSpanishNumbersPlugin;
  private container: HTMLElement;
  private view: LearnSpanishNumbersView;
  private cleanupFn: (() => void) | null = null;

  constructor(plugin: LearnSpanishNumbersPlugin, container: HTMLElement, view: LearnSpanishNumbersView) {
    this.plugin = plugin;
    this.container = container;
    this.view = view;
  }

  // Called by plugin to clean up timers when unloading
  cleanup() {
    if (this.cleanupFn) {
      this.cleanupFn();
      this.cleanupFn = null;
    }
  }

  render() {
    const state = this.plugin.listenLearnState;
    if (!state) return;

    if (this.plugin.listenLearnCleanup && this.plugin.listenLearnCleanup !== this.cleanupFn) {
      this.plugin.listenLearnCleanup();
      this.plugin.listenLearnCleanup = null;
    }

    if (state.numbers.length === 0) {
      this.renderSetup();
    } else {
      this.renderSlideshow();
    }
  }

  private getDirectionLabel(direction: 'es-en' | 'en-es' | 'es-only') {
    switch (direction) {
      case 'en-es':
        return 'English to Spanish';
      case 'es-only':
        return 'Spanish only';
      default:
        return 'Spanish to English';
    }
  }

  private formatHistoryLabel(inputText: string, direction: 'es-en' | 'en-es' | 'es-only', shuffled: boolean) {
    const normalizedInput = inputText.replace(/\s+/g, ' ').trim();
    const shortInput = normalizedInput.length > 42 ? `${normalizedInput.slice(0, 42).trimEnd()}...` : normalizedInput;
    return `${shortInput} | ${this.getDirectionLabel(direction)} | ${shuffled ? 'Shuffle' : 'Sequential'}`;
  }

  private renderSetup() {
    const state = this.plugin.listenLearnState;
    const recentConfigs = this.plugin.settings.listenLearnSettings.recentConfigs ?? [];

    this.container.innerHTML = `
      <div class="lsn-wrap lsn-listen-setup">
        <div class="lsn-listen-setup-header">
          <div>
            <h2 class="lsn-title-lg lsn-listen-title">Listen & Learn</h2>
            <div class="lsn-listen-subtitle">Pick a range, choose the prompt style, then start listening.</div>
          </div>
          <button id="btn-home" class="lsn-home-btn-text lsn-listen-home" aria-label="Home">${iconOnly(APP_ICONS.home)}</button>
        </div>

        <div class="lsn-card-sm lsn-listen-setup-card">
          <div class="lsn-listen-range-row">
            <div class="lsn-listen-field-head">
              <div class="lsn-label">Range</div>
              <div class="lsn-example">Numbers or ranges separated by commas.</div>
            </div>
            <textarea id="ranges" class="lsn-textarea lsn-listen-ranges" rows="1" placeholder="1-10, 20-30, 5, 10, 15">${escapeHtml(state.inputText)}</textarea>
          </div>

          <div class="lsn-listen-presets" aria-label="Focused presets">
            ${FOCUSED_RANGE_PRESETS.map((preset) => `
              <button type="button" class="lsn-preset-btn lsn-preset-btn-compact lsn-listen-preset" data-preset="${preset.id}" title="${preset.label}">
                <span class="lsn-preset-range">${preset.compactLabel ?? preset.ranges}</span>
              </button>
            `).join('')}
          </div>

          ${recentConfigs.length > 0 ? `
            <select id="history-select" class="lsn-input lsn-listen-history" aria-label="Recent Listen & Learn setup">
              <option value="">Recent setups...</option>
              ${recentConfigs.map((config, index) => `
                <option value="${index}">${escapeHtml(this.formatHistoryLabel(config.inputText, config.direction, config.shuffled))}</option>
              `).join('')}
            </select>
          ` : ''}

          <div class="lsn-listen-options-grid">
            <div class="lsn-listen-option-group">
              <label class="lsn-label">Direction</label>
              <div class="lsn-direction-btns lsn-listen-direction-btns">
                <button id="dir-se" class="lsn-direction-btn" title="Spanish to English">ES → EN</button>
                <button id="dir-es" class="lsn-direction-btn" title="English to Spanish">EN → ES</button>
                <button id="dir-only" class="lsn-direction-btn" title="Spanish only">Spanish</button>
              </div>
            </div>

            <div class="lsn-listen-option-group">
              <label class="lsn-label">Order</label>
              <div class="lsn-listen-order-btns">
                <button id="order-seq" class="lsn-btn-order lsn-btn-with-icon lsn-btn-order-active">${APP_ICONS.sequential}<span>Seq</span></button>
                <button id="order-shuf" class="lsn-btn-order lsn-btn-with-icon">${APP_ICONS.shuffle}<span>Shuffle</span></button>
              </div>
            </div>
          </div>

          <button id="start" class="lsn-btn-start lsn-listen-start">Start Listening</button>
        </div>
      </div>
    `;

    this.updateDirButtons(state.direction);
    this.updateOrderButtons(state.shuffled);

    const rangesEl = this.container.querySelector('#ranges') as HTMLTextAreaElement;
    const historyEl = this.container.querySelector('#history-select') as HTMLSelectElement | null;

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
      state.inputText = selectedConfig.inputText;
      state.direction = selectedConfig.direction;
      state.shuffled = selectedConfig.shuffled;
      this.updateDirButtons(state.direction);
      this.updateOrderButtons(state.shuffled);
      this.plugin.settings.listenLearnSettings = {
        ...this.plugin.settings.listenLearnSettings,
        inputText: state.inputText,
        direction: state.direction,
        shuffled: state.shuffled
      };
      await this.plugin.saveSettings();
    });

    this.container.querySelector('#btn-home')?.addEventListener('click', () => {
      this.plugin.currentPanel = 'dashboard';
      this.plugin.render();
    });

    this.container.querySelector('#order-seq')?.addEventListener('click', async () => {
      state.shuffled = false;
      this.updateOrderButtons(false);
      this.plugin.settings.listenLearnSettings = { ...this.plugin.settings.listenLearnSettings, shuffled: false };
      await this.plugin.saveSettings();
    });

    this.container.querySelector('#order-shuf')?.addEventListener('click', async () => {
      state.shuffled = true;
      this.updateOrderButtons(true);
      this.plugin.settings.listenLearnSettings = { ...this.plugin.settings.listenLearnSettings, shuffled: true };
      await this.plugin.saveSettings();
    });

    this.container.querySelector('#dir-se')?.addEventListener('click', async () => {
      state.direction = 'es-en';
      this.updateDirButtons('es-en');
      this.plugin.settings.listenLearnSettings = { ...this.plugin.settings.listenLearnSettings, direction: 'es-en' };
      await this.plugin.saveSettings();
    });

    this.container.querySelector('#dir-es')?.addEventListener('click', async () => {
      state.direction = 'en-es';
      this.updateDirButtons('en-es');
      this.plugin.settings.listenLearnSettings = { ...this.plugin.settings.listenLearnSettings, direction: 'en-es' };
      await this.plugin.saveSettings();
    });

    this.container.querySelector('#dir-only')?.addEventListener('click', async () => {
      state.direction = 'es-only';
      this.updateDirButtons('es-only');
      this.plugin.settings.listenLearnSettings = { ...this.plugin.settings.listenLearnSettings, direction: 'es-only' };
      await this.plugin.saveSettings();
    });

    this.container.querySelector('#start')?.addEventListener('click', async () => {
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
      state.inputText = input;
      state.numbers = state.shuffled ? this.plugin.shuffleArray(validation.numbers) : validation.numbers;
      state.currentIndex = 0;
      state.showingAnswer = false;
      this.plugin.markTestedToday();
      this.plugin.rememberListenLearnConfig(state.inputText, state.direction, state.shuffled);
      this.plugin.settings.listenLearnSettings = {
        ...this.plugin.settings.listenLearnSettings,
        direction: state.direction,
        inputText: state.inputText,
        shuffled: state.shuffled,
        autoRepeatRange: state.autoRepeatRange,
        recentConfigs: this.plugin.settings.listenLearnSettings.recentConfigs
      };
      await this.plugin.saveSettings();
      this.render();
    });
  }

  private updateDirButtons(direction: string) {
    const dirs = [
      { id: 'es-en', btnId: 'dir-se' },
      { id: 'en-es', btnId: 'dir-es' },
      { id: 'es-only', btnId: 'dir-only' }
    ];
    dirs.forEach(({ id, btnId }) => {
      const btn = this.container.querySelector(`#${btnId}`) as HTMLElement;
      if (btn) {
        if (direction === id) {
          btn.classList.add('lsn-direction-btn-active');
        } else {
          btn.classList.remove('lsn-direction-btn-active');
        }
      }
    });
  }

  private updateOrderButtons(shuffled: boolean) {
    const seqBtn = this.container.querySelector('#order-seq') as HTMLElement;
    const shufBtn = this.container.querySelector('#order-shuf') as HTMLElement;
    if (shuffled) {
      seqBtn.classList.remove('lsn-btn-order-active');
      shufBtn.classList.add('lsn-btn-order-active');
    } else {
      seqBtn.classList.add('lsn-btn-order-active');
      shufBtn.classList.remove('lsn-btn-order-active');
    }
  }

  private renderSlideshow() {
    const state = this.plugin.listenLearnState;
    const isEsOnly = state.direction === 'es-only';

    let timers: number[] = [];
    let audioWaiters: Array<() => void> = [];
    let playbackGeneration = 0;
    let isRunning = true;

    const getCard = (index: number) => {
      const num = state.numbers[index];
      const spanish = numberToSpanish(num);
      const english = numberToWordsEnglish(num);
      let firstText = spanish;
      let secondText = english;
      let firstVoice = this.plugin.settings.voiceId || 'es';
      let secondVoice = 'en';

      if (state.direction === 'en-es') {
        firstText = english; secondText = spanish; firstVoice = 'en'; secondVoice = this.plugin.settings.voiceId || 'es';
      } else if (isEsOnly) {
        firstText = spanish; secondText = ''; firstVoice = this.plugin.settings.voiceId || 'es';
      }

      const playClip = (text: string, voice: string, generation: number): Promise<void> => {
        if (!this.plugin.settings.audioEnabled || generation !== playbackGeneration) return Promise.resolve();

        return new Promise((resolve) => {
          const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${voice}&client=gtx`;
          const audio = this.plugin.audioEl ?? new Audio();
          this.plugin.audioEl = audio;

          let settled = false;
          let timeoutId: number | null = null;

          const cleanup = () => {
            if (settled) return;
            settled = true;
            audio.removeEventListener('ended', finish);
            audio.removeEventListener('error', finish);
            audio.removeEventListener('abort', finish);
            if (timeoutId !== null) window.clearTimeout(timeoutId);
            audioWaiters = audioWaiters.filter((waiter) => waiter !== cleanup);
            resolve();
          };

          const finish = () => cleanup();
          audioWaiters.push(cleanup);
          audio.pause();
          audio.src = url;
          audio.load();
          audio.addEventListener('ended', finish, { once: true });
          audio.addEventListener('error', finish, { once: true });
          audio.addEventListener('abort', finish, { once: true });
          timeoutId = window.setTimeout(finish, 12000);
          audio.play().catch(finish);

          if (generation !== playbackGeneration) {
            cleanup();
          }
        });
      };

      return { num, spanish, english, firstText, secondText, firstVoice, secondVoice, playClip };
    };

    const clearTimers = () => {
      playbackGeneration++;
      timers.forEach(t => clearTimeout(t));
      timers = [];
      audioWaiters.forEach((finish) => finish());
      audioWaiters = [];
      this.plugin.stopAudio();
    };

    const isCurrentGeneration = (generation: number) => generation === playbackGeneration;
    const isCurrentPlayback = (generation: number) => isRunning && isCurrentGeneration(generation);

    const waitForGenerationDelay = (ms: number, generation: number) => new Promise<void>((resolve) => {
      if (!isCurrentGeneration(generation)) {
        resolve();
        return;
      }

      timers.push(window.setTimeout(resolve, ms));
    });

    const waitForDelay = (ms: number, generation: number) => new Promise<void>((resolve) => {
      if (!isCurrentPlayback(generation)) {
        resolve();
        return;
      }

      timers.push(window.setTimeout(resolve, ms));
    });

    const waitForAudioAndDelay = async (audioDone: Promise<void>, ms: number, generation: number) => {
      await Promise.all([audioDone, waitForDelay(ms, generation)]);
      return isCurrentPlayback(generation);
    };

    // Set up cleanup function for plugin to call on unload
    this.cleanupFn = () => {
      clearTimers();
      isRunning = false;
    };
    this.plugin.listenLearnCleanup = this.cleanupFn;

    const updateDisplay = (index: number, showAnswer: boolean) => {
      const card = getCard(index);
      const numEl = this.container.querySelector('#ll-num') as HTMLElement;
      const transEl = this.container.querySelector('#ll-trans') as HTMLElement;
      const answerEl = this.container.querySelector('#ll-answer') as HTMLElement;
      const counterEl = this.container.querySelector('#ll-counter') as HTMLElement;
      const progressEl = this.container.querySelector('#ll-progress') as HTMLElement;
      const pctEl = this.container.querySelector('#ll-pct') as HTMLElement;
      const displayState = getListenLearnDisplayState(isEsOnly, showAnswer, card.secondText);

      if (numEl) numEl.textContent = card.num.toLocaleString();
      if (transEl) {
        if (isEsOnly) {
          // ES only: show Spanish immediately
          transEl.innerHTML = `<div class="lsn-slideshow-first">${card.spanish}</div>`;
        } else {
          transEl.innerHTML = `<div class="lsn-slideshow-first">${card.firstText}</div>`;
        }
      }
      if (answerEl) {
        answerEl.style.display = displayState.answerVisible ? '' : 'none';
        answerEl.innerHTML = displayState.answerMarkup;
      }
      if (counterEl) counterEl.textContent = `${index + 1} / ${state.numbers.length}`;
      const pct = index >= state.numbers.length - 1 ? 100 : Math.round((index / state.numbers.length) * 100);
      if (progressEl) progressEl.style.width = `${pct}%`;
      if (pctEl) pctEl.textContent = `${pct}%`;
    };

    const revealAnswer = (index: number, playAudio: boolean, generation = playbackGeneration): Promise<void> => {
      if (!isCurrentGeneration(generation)) return Promise.resolve();
      state.currentIndex = index;
      state.showingAnswer = true;
      updateDisplay(index, true);
      if (playAudio) {
        const card = getCard(index);
        return card.playClip(card.secondText, card.secondVoice, generation);
      }
      return Promise.resolve();
    };

    const showCardImmediate = (index: number) => {
      clearTimers();
      isRunning = false;
      state.currentIndex = index;
      state.showingAnswer = false;
      updateDisplay(index, false);
      const generation = playbackGeneration;
      const card = getCard(index);
      const firstAudioDone = card.playClip(card.firstText, card.firstVoice, generation);
      if (!isEsOnly) {
        void (async () => {
          await Promise.all([firstAudioDone, waitForGenerationDelay(MANUAL_REVEAL_DELAY_MS, generation)]);
          if (!isCurrentGeneration(generation)) return;
          void revealAnswer(index, true, generation);
        })();
      }
    };

    const playCard = (index: number) => {
      if (!isRunning) return;
      clearTimers();
      isRunning = true;
      const generation = playbackGeneration;
      state.currentIndex = index;
      state.showingAnswer = false;
      updateDisplay(index, false);
      const card = getCard(index);
      const firstAudioDone = card.playClip(card.firstText, card.firstVoice, generation);

      const nextCard = () => {
        if (!isCurrentPlayback(generation)) return;
        if (index < state.numbers.length - 1) {
          playCard(index + 1);
        } else if (state.autoRepeatRange) {
          playCard(0);
        } else {
          isRunning = false;
          const pauseBtn = this.container.querySelector('#pause') as HTMLElement;
          if (pauseBtn) pauseBtn.innerHTML = iconOnly(APP_ICONS.play);
        }
      };

      void (async () => {
        if (isEsOnly) {
          if (await waitForAudioAndDelay(firstAudioDone, AUTO_REVEAL_DELAY_MS, generation)) {
            nextCard();
          }
          return;
        }

        if (!(await waitForAudioAndDelay(firstAudioDone, AUTO_REVEAL_DELAY_MS, generation))) return;
        const secondAudioDone = revealAnswer(index, true, generation);
        if (await waitForAudioAndDelay(secondAudioDone, AUTO_ADVANCE_DELAY_MS, generation)) {
          nextCard();
        }
      })();
    };

    const pauseSlideshow = () => {
      clearTimers();
      isRunning = false;
      const pauseBtn = this.container.querySelector('#pause') as HTMLElement;
      if (pauseBtn) pauseBtn.innerHTML = iconOnly(APP_ICONS.play);
    };

    const handleResume = () => {
      isRunning = true;
      const pauseBtn = this.container.querySelector('#pause') as HTMLElement;
      if (pauseBtn) pauseBtn.innerHTML = iconOnly(APP_ICONS.pause);
      playCard(state.currentIndex);
    };

    const handlePrev = () => {
      clearTimers();
      isRunning = false;
      const newIndex = Math.max(0, state.currentIndex - 1);
      showCardImmediate(newIndex);
      const pauseBtn = this.container.querySelector('#pause') as HTMLElement;
      if (pauseBtn) pauseBtn.innerHTML = iconOnly(APP_ICONS.play);
    };

    const handleNext = () => {
      clearTimers();
      isRunning = false;
      const newIndex = Math.min(state.numbers.length - 1, state.currentIndex + 1);
      showCardImmediate(newIndex);
      const pauseBtn = this.container.querySelector('#pause') as HTMLElement;
      if (pauseBtn) pauseBtn.innerHTML = iconOnly(APP_ICONS.play);
    };

    const handleRepeat = () => {
      clearTimers();
      isRunning = false;
      showCardImmediate(state.currentIndex);
      const pauseBtn = this.container.querySelector('#pause') as HTMLElement;
      if (pauseBtn) pauseBtn.innerHTML = iconOnly(APP_ICONS.play);
    };

    // Initial card data
    const card = getCard(state.currentIndex);
    const progress = Math.round((state.currentIndex / state.numbers.length) * 100);
    const displayState = getListenLearnDisplayState(isEsOnly, state.showingAnswer, card.secondText);

    this.container.innerHTML = `
      <div class="lsn-wrap">
        <div class="lsn-progress-header">
          <span></span>
          <span id="ll-counter" class="lsn-text-muted">${state.currentIndex + 1} / ${state.numbers.length}</span>
        </div>

        <div class="lsn-progress-section">
          <div class="lsn-progress-label">
            <span class="lsn-text-muted lsn-text-muted-sm">Progress</span>
            <span id="ll-pct" class="lsn-text-muted lsn-text-muted-sm">${progress}%</span>
          </div>
          <div class="lsn-progress-bar">
            <div id="ll-progress" class="lsn-progress-fill-purple" style="width:${progress}%"></div>
          </div>
        </div>

        <div class="lsn-slideshow-card">
          <div id="ll-num" class="lsn-slideshow-num">${card.num.toLocaleString()}</div>
          <div id="ll-trans" class="lsn-slideshow-first">${card.firstText}</div>
          <div id="ll-answer" class="lsn-slideshow-second" style="${displayState.answerVisible ? '' : 'display:none;'}">${displayState.answerMarkup}</div>
        </div>

        <div class="lsn-player-controls">
          <button id="prev" class="lsn-btn-icon" aria-label="Previous">${iconOnly(APP_ICONS.previous)}</button>
          <button id="pause" class="lsn-btn-icon" aria-label="Pause">${iconOnly(APP_ICONS.pause)}</button>
          <button id="repeat" class="lsn-btn-icon" aria-label="Repeat">${iconOnly(APP_ICONS.repeat)}</button>
          <button id="next" class="lsn-btn-icon" aria-label="Next">${iconOnly(APP_ICONS.next)}</button>
        </div>

        <div class="lsn-footer-actions">
          <div class="lsn-footer-actions-left">
            <button id="ll-back" class="lsn-home-btn-text">${iconWithLabel(APP_ICONS.back, 'Back')}</button>
            <button id="start-over" class="lsn-home-btn-text">${iconWithLabel(APP_ICONS.restart, 'Start Over')}</button>
            <button
              id="autorepeat-range"
              class="lsn-home-btn-text lsn-autorepeat-btn ${state.autoRepeatRange ? 'lsn-autorepeat-btn-active' : ''}"
              aria-label="Auto-repeat range ${state.autoRepeatRange ? 'on' : 'off'}"
              aria-pressed="${state.autoRepeatRange}"
              title="Auto-repeat range ${state.autoRepeatRange ? 'on' : 'off'}"
            >${iconOnly(APP_ICONS.repeatRange)}</button>
          </div>
          <button id="ll-dashboard" class="lsn-home-btn-text" aria-label="Home">${iconOnly(APP_ICONS.home)}</button>
        </div>
      </div>
    `;

    // Show initial card and start the slideshow auto-advance
    playCard(state.currentIndex);

    // Event handlers
    this.container.querySelector('#prev')?.addEventListener('click', handlePrev);
    this.container.querySelector('#next')?.addEventListener('click', handleNext);
    this.container.querySelector('#repeat')?.addEventListener('click', handleRepeat);
    this.container.querySelector('#autorepeat-range')?.addEventListener('click', async () => {
      state.autoRepeatRange = !state.autoRepeatRange;
      const btn = this.container.querySelector('#autorepeat-range') as HTMLButtonElement | null;
      if (btn) {
        btn.classList.toggle('lsn-autorepeat-btn-active', state.autoRepeatRange);
        btn.setAttribute('aria-pressed', String(state.autoRepeatRange));
        btn.setAttribute('aria-label', `Auto-repeat range ${state.autoRepeatRange ? 'on' : 'off'}`);
        btn.setAttribute('title', `Auto-repeat range ${state.autoRepeatRange ? 'on' : 'off'}`);
      }
      this.plugin.settings.listenLearnSettings = {
        ...this.plugin.settings.listenLearnSettings,
        autoRepeatRange: state.autoRepeatRange
      };
      await this.plugin.saveSettings();
    });
    this.container.querySelector('#pause')?.addEventListener('click', () => {
      if (isRunning) pauseSlideshow();
      else handleResume();
    });
    this.container.querySelector('#start-over')?.addEventListener('click', () => {
      clearTimers();
      isRunning = true;
      const pauseBtn = this.container.querySelector('#pause') as HTMLElement;
      if (pauseBtn) pauseBtn.innerHTML = iconOnly(APP_ICONS.pause);
      playCard(0);
    });
    this.container.querySelector('#ll-back')?.addEventListener('click', () => {
      clearTimers();
      isRunning = false;
      this.cleanupFn = null;
      this.plugin.listenLearnCleanup = null;
      // Reset state to go back to setup
      state.numbers = [];
      state.currentIndex = 0;
      state.showingAnswer = false;
      this.render();
    });
    this.container.querySelector('#ll-dashboard')?.addEventListener('click', () => {
      clearTimers();
      isRunning = false;
      this.cleanupFn = null;
      this.plugin.listenLearnCleanup = null;
      this.plugin.currentPanel = 'dashboard';
      this.plugin.render();
    });
  }
}
