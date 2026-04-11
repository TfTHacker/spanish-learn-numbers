// LearnSpanishNumbersPlugin - Main plugin class

import { Notice, Plugin, normalizePath } from 'obsidian';
import { DEFAULT_SETTINGS, DEFAULT_RANGES, PluginSettings, CardData, SessionHistory, ListenLearnState, PanelId, ListenLearnRecentConfig, CramRecentConfig } from './types';
import { trimSessionHistory } from './utils/learning';
import { playAudio } from './utils/audio';
import { LearnSpanishNumbersSettingTab } from './settings';
import { LearnSpanishNumbersView } from './view';

// Constants to avoid magic numbers
export const MS_PER_MINUTE = 60 * 1000;
export const MS_PER_DAY = 24 * 60 * 60 * 1000;
export const DEFAULT_RETRY_INTERVAL_MS = 60 * 1000; // 1 minute for "Again" button
export const VIEW_TYPE = 'spanish-learn-numbers';
const MAX_NUMBER = 1_000_000_000_000;
const MAX_EXPANDED_RANGE_SIZE = 5000;
const MAX_TOTAL_CUSTOM_NUMBERS = 10000;

export default class LearnSpanishNumbersPlugin extends Plugin {
  settings!: PluginSettings;
  cards: CardData[] = [];
  history: SessionHistory[] = [];
  audioEl: HTMLAudioElement | null = null;
  currentPanel: PanelId = 'dashboard';
  listenLearnState!: ListenLearnState;
  listenLearnCleanup: (() => void) | null = null;
  private reminderTimer: number | null = null;
  private reminderDelayTimer: number | null = null;
  private reminderNotice: Notice | null = null;

  async onload() {
    await this.loadSettings();

    // Initialize listenLearnState with proper defaults
    const savedSettings = this.settings.listenLearnSettings;
    this.listenLearnState = {
      numbers: [],
      currentIndex: 0,
      showingAnswer: false,
      inputText: savedSettings?.inputText ?? '',
      direction: savedSettings?.direction ?? 'es-en',
      speed: savedSettings?.speed ?? 3,
      shuffled: savedSettings?.shuffled ?? false,
      autoRepeatRange: savedSettings?.autoRepeatRange ?? false,
    };

    // Register view
    this.registerView(VIEW_TYPE, (leaf) => new LearnSpanishNumbersView(leaf, this));

    // Add settings tab
    this.addSettingTab(new LearnSpanishNumbersSettingTab(this.app, this));

    // Add command - opens the view with dashboard
    this.addCommand({
      id: 'srs-practice',
      name: 'Practice Spanish Numbers',
      callback: () => {
        this.currentPanel = 'dashboard';
        this.ensureViewOpen();
      }
    });

    // Add ribbon icon
    this.addRibbonIcon('languages', 'Learn Spanish Numbers', () => {
      this.currentPanel = 'dashboard';
      this.ensureViewOpen();
    });

    this.refreshReminderTimer();

    // Don't auto-open view - user clicks ribbon icon to open
    this.registerEvent(this.app.workspace.on('layout-change', () => this.render()));
  }

  onunload() {
    this.stopAudio();

    // Clean up listen-learn timers
    if (this.listenLearnCleanup) {
      this.listenLearnCleanup();
      this.listenLearnCleanup = null;
    }

    this.clearReminderTimer();
  }

  // Ensures the view is open, focusing existing or creating new
  private ensureViewOpen() {
    const existingLeaf = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0];
    if (existingLeaf) {
      this.app.workspace.setActiveLeaf(existingLeaf);
    } else {
      const leaf = this.app.workspace.getLeaf(true);
      leaf.setViewState({ type: VIEW_TYPE, state: {} });
    }
  }

  async renderView() {
    // Get the active view and call render directly
    const view = this.app.workspace.getActiveViewOfType(LearnSpanishNumbersView);
    if (view) {
      await view.render();
    }
  }

  async loadSettings() {
    const data = await this.loadData() as any;
    const defaultSettings: PluginSettings = {
      ...DEFAULT_SETTINGS,
      streakData: { ...DEFAULT_SETTINGS.streakData },
      listenLearnSettings: { ...DEFAULT_SETTINGS.listenLearnSettings }
    };

    if (data) {
      // Handle both old format (flat) and new format (wrapped)
      if (data.settings) {
        this.settings = {
          ...defaultSettings,
          ...data.settings,
          streakData: { ...defaultSettings.streakData, ...data.settings.streakData },
          listenLearnSettings: { ...defaultSettings.listenLearnSettings, ...data.settings.listenLearnSettings }
        };
        this.cards = data.cards || [];
        this.history = data.history || [];
      } else {
        // Old format - data IS the settings
        this.settings = {
          ...defaultSettings,
          ...data,
          streakData: { ...defaultSettings.streakData, ...data.streakData },
          listenLearnSettings: { ...defaultSettings.listenLearnSettings, ...data.listenLearnSettings }
        };
        this.cards = [];
        this.history = [];
      }
    } else {
      this.settings = defaultSettings;
      this.cards = [];
      this.history = [];
    }

    if (this.settings.cramRecentConfigs.length === 0 && this.settings.lastCramRanges.trim()) {
      this.settings.cramRecentConfigs = [{
        inputText: this.settings.lastCramRanges.trim(),
        shuffled: false,
        usedAt: new Date().toISOString()
      }];
    }
  }

  async saveSettings() {
    await this.saveData({
      settings: this.settings,
      cards: this.cards,
      history: this.history
    });
  }

  async resetAllData() {
    const dataPath = normalizePath(`${this.app.vault.configDir}/plugins/${this.manifest.id}/data.json`);

    if (await this.app.vault.adapter.exists(dataPath)) {
      await this.app.vault.adapter.remove(dataPath);
    }

    const defaultSettings: PluginSettings = {
      ...DEFAULT_SETTINGS,
      streakData: { ...DEFAULT_SETTINGS.streakData },
      listenLearnSettings: { ...DEFAULT_SETTINGS.listenLearnSettings }
    };

    this.settings = defaultSettings;
    this.cards = [];
    this.history = [];
    this.currentPanel = 'dashboard';
    this.listenLearnState = {
      numbers: [],
      currentIndex: 0,
      showingAnswer: false,
      inputText: defaultSettings.listenLearnSettings.inputText,
      direction: defaultSettings.listenLearnSettings.direction,
      speed: defaultSettings.listenLearnSettings.speed,
      shuffled: defaultSettings.listenLearnSettings.shuffled,
      autoRepeatRange: defaultSettings.listenLearnSettings.autoRepeatRange,
    };

    this.stopAudio();
    if (this.listenLearnCleanup) {
      this.listenLearnCleanup();
      this.listenLearnCleanup = null;
    }

    this.refreshReminderTimer();
    this.render();
  }

  isMobile(): boolean {
    return window.innerWidth < 500;
  }

  validateCustomRanges(input: string): { valid: boolean; error?: string; numbers?: number[] } {
    const parts = input
      .split(',')
      .map(part => part.trim())
      .filter(Boolean);
    const uniqueNumbers = new Set<number>();

    if (parts.length === 0) {
      return { valid: false, error: 'No valid numbers found' };
    }

    for (const rawPart of parts) {
      const part = rawPart.replace(/^\[|\]$/g, '').trim();

      if (/^\d+$/.test(part)) {
        const n = Number(part);
        if (!Number.isSafeInteger(n) || n < 0 || n > MAX_NUMBER) {
          return { valid: false, error: `Invalid number: ${rawPart}` };
        }
        uniqueNumbers.add(n);
        continue;
      }

      if (/^\d+\s*-\s*\d+$/.test(part)) {
        const [startText, endText] = part.split('-').map(value => value.trim());
        const start = Number(startText);
        const end = Number(endText);

        if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start > end || end > MAX_NUMBER) {
          return { valid: false, error: `Invalid range: ${rawPart}` };
        }

        const rangeSize = end - start + 1;
        if (rangeSize > MAX_EXPANDED_RANGE_SIZE) {
          return {
            valid: false,
            error: `Range too large: ${rawPart}. Keep each range at ${MAX_EXPANDED_RANGE_SIZE.toLocaleString()} numbers or fewer.`
          };
        }

        for (let value = start; value <= end; value++) {
          uniqueNumbers.add(value);
          if (uniqueNumbers.size > MAX_TOTAL_CUSTOM_NUMBERS) {
            return {
              valid: false,
              error: `Too many numbers selected. Keep the total at ${MAX_TOTAL_CUSTOM_NUMBERS.toLocaleString()} numbers or fewer.`
            };
          }
        }
        continue;
      }

      return { valid: false, error: `Invalid entry: ${rawPart}` };
    }

    return { valid: true, numbers: [...uniqueNumbers] };
  }

  shuffleArray<T>(arr: T[]): T[] {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  getCardStats() {
    const ranges = this.settings.customNumberRanges || DEFAULT_RANGES;
    const validation = this.validateCustomRanges(ranges);
    const numbers = validation.numbers || [];
    const cardMap = new Map(this.cards.map(card => [card.id, card]));

    let newCount = 0;
    let inProgressCount = 0;
    let learnedCount = 0;

    for (const number of numbers) {
      for (const direction of ['forward', 'reverse'] as const) {
        const card = cardMap.get(`n${number}-${direction}`);
        if (!card || card.reviews === 0) {
          newCount++;
        } else if (card.interval >= 21) {
          learnedCount++;
        } else {
          inProgressCount++;
        }
      }
    }

    return {
      total: numbers.length * 2,
      new: newCount,
      inProgress: inProgressCount,
      learned: learnedCount
    };
  }

  markTestedToday() {
    const today = new Date().toISOString().split('T')[0];
    const { currentStreak, lastPracticeDate } = this.settings.streakData;

    if (lastPracticeDate === today) {
      this.hideReminderNotice();
      return;
    }

    if (lastPracticeDate) {
      const last = new Date(lastPracticeDate);
      const diff = Math.floor((Date.now() - last.getTime()) / (1000 * 60 * 60 * 24));
      this.settings.streakData.currentStreak = diff === 1 ? currentStreak + 1 : 1;
    } else {
      this.settings.streakData.currentStreak = 1;
    }

    this.settings.streakData.lastPracticeDate = today;
    this.settings.streakData.totalDays++;
    this.hideReminderNotice();
  }

  updateStreak() {
    this.markTestedToday();
  }

  addSessionHistory(session: Omit<SessionHistory, 'date'>): void {
    this.history.push({
      date: new Date().toISOString(),
      ...session
    });
    this.history = trimSessionHistory(this.history, Date.now());
  }

  playAudio(text: string, voiceId?: string, forcePlay: boolean = false) {
    const v = voiceId || this.settings.voiceId;
    this.audioEl = playAudio(this.audioEl, text, v, this.settings.audioEnabled, forcePlay);
  }

  rememberListenLearnConfig(inputText: string, direction: ListenLearnRecentConfig['direction'], shuffled: boolean) {
    const trimmedInput = inputText.trim();
    if (!trimmedInput) {
      return;
    }

    const nextConfig: ListenLearnRecentConfig = {
      inputText: trimmedInput,
      direction,
      shuffled,
      usedAt: new Date().toISOString()
    };

    const dedupedConfigs = this.settings.listenLearnSettings.recentConfigs.filter((config) => {
      return !(config.inputText === trimmedInput && config.direction === direction && config.shuffled === shuffled);
    });

    this.settings.listenLearnSettings.recentConfigs = [nextConfig, ...dedupedConfigs].slice(0, 8);
  }

  rememberCramConfig(inputText: string, shuffled: boolean) {
    const trimmedInput = inputText.trim();
    if (!trimmedInput) {
      return;
    }

    const nextConfig: CramRecentConfig = {
      inputText: trimmedInput,
      shuffled,
      usedAt: new Date().toISOString()
    };

    const dedupedConfigs = this.settings.cramRecentConfigs.filter((config) => {
      return !(config.inputText === trimmedInput && config.shuffled === shuffled);
    });

    this.settings.cramRecentConfigs = [nextConfig, ...dedupedConfigs].slice(0, 8);
  }

  stopAudio() {
    if (!this.audioEl) {
      return;
    }

    this.audioEl.pause();
    this.audioEl.src = '';
    this.audioEl = null;
  }

  refreshReminderTimer() {
    this.clearReminderTimer();
    this.syncReminderNoticeState();

    if (this.settings.reminderInterval <= 0) {
      return;
    }

    this.reminderDelayTimer = window.setTimeout(() => {
      this.updateReminderNotice();
      this.reminderTimer = window.setInterval(() => {
        this.updateReminderNotice();
      }, this.settings.reminderInterval * MS_PER_MINUTE);

      this.registerInterval(this.reminderTimer);
      this.reminderDelayTimer = null;
    }, this.settings.reminderInterval * MS_PER_MINUTE);
  }

  private syncReminderNoticeState() {
    if (this.shouldSuppressReminderNotice()) {
      this.hideReminderNotice();
    }
  }

  private clearReminderTimer() {
    if (this.reminderDelayTimer !== null) {
      window.clearTimeout(this.reminderDelayTimer);
      this.reminderDelayTimer = null;
    }

    if (this.reminderTimer !== null) {
      window.clearInterval(this.reminderTimer);
      this.reminderTimer = null;
    }
  }

  private updateReminderNotice() {
    if (this.shouldSuppressReminderNotice()) {
      this.hideReminderNotice();
      return;
    }

    this.showReminderNotice();
  }

  private shouldSuppressReminderNotice() {
    const today = new Date().toISOString().split('T')[0];
    const isPracticeCompleteToday = this.settings.streakData.lastPracticeDate === today;
    const isActivelyTesting = this.currentPanel === 'practice' || this.currentPanel === 'cram' || this.currentPanel === 'listen-learn';

    return this.settings.reminderInterval <= 0 || isPracticeCompleteToday || isActivelyTesting;
  }

  private showReminderNotice() {
    if (this.isReminderNoticeVisible()) {
      return;
    }

    this.reminderNotice = new Notice('Practice your Spanish numbers to keep the habit going.', 0);
  }

  private hideReminderNotice() {
    if (!this.reminderNotice) {
      return;
    }

    if (this.isReminderNoticeVisible()) {
      this.reminderNotice.hide();
    }

    this.reminderNotice = null;
  }

  private isReminderNoticeVisible() {
    const notice = this.reminderNotice as (Notice & { noticeEl?: HTMLElement }) | null;
    return Boolean(notice?.noticeEl?.isConnected);
  }

  render() {
    this.syncReminderNoticeState();
    const view = this.app.workspace.getActiveViewOfType(LearnSpanishNumbersView);
    if (view) {
      view.render();
    }
  }
}
