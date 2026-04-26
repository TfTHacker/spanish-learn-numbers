// LearnSpanishNumbersPlugin - Main plugin class

import { Editor, FuzzySuggestModal, MarkdownView, Notice, Plugin, normalizePath } from 'obsidian';
import { DEFAULT_SETTINGS, DEFAULT_RANGES, PluginSettings, CardData, SessionHistory, ListenLearnState, PanelId, ListenLearnRecentConfig, CramRecentConfig } from './types';
import { CramSessionState, trimSessionHistory } from './utils/learning';
import { validateCustomRanges as validateCustomRangesInput } from './utils/ranges';
import { playAudio } from './utils/audio';
import { LearnSpanishNumbersSettingTab } from './settings';
import { LearnSpanishNumbersView } from './view';

// Constants to avoid magic numbers
export const MS_PER_MINUTE = 60 * 1000;
export const MS_PER_DAY = 24 * 60 * 60 * 1000;
export const DEFAULT_RETRY_INTERVAL_MS = 60 * 1000; // 1 minute for "Again" button
export const VIEW_TYPE = 'spanish-learn-numbers';

export default class LearnSpanishNumbersPlugin extends Plugin {
  settings!: PluginSettings;
  cards: CardData[] = [];
  history: SessionHistory[] = [];
  audioEl: HTMLAudioElement | null = null;
  currentPanel: PanelId = 'dashboard';
  practiceSession: { cards: CardData[]; correct: number; total: number } | null = null;
  cramSession: CramSessionState | null = null;
  cramSetupIsShuffled: boolean = false;
  cramCompletionRecorded: boolean = false;
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
    this.addRibbonIcon('hash', 'Learn Spanish Numbers', () => {
      this.currentPanel = 'dashboard';
      this.ensureViewOpen();
    });

    // Register obsidian:// protocol handler for linking to number view from markdown
    this.registerObsidianProtocolHandler('spanish-numbers', (params) => {
      this.handleProtocolHandler(params);
    });

    // Command: Insert hyperlink to number view
    this.addCommand({
      id: 'insert-number-view-link',
      name: 'Insert link to number view',
      editorCallback: (editor: Editor, view: MarkdownView) => {
        this.insertNumberViewLink(editor, view);
      }
    });

    this.refreshReminderTimer();

    // Don't auto-open view - user clicks ribbon icon or command to open
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
  private async ensureViewOpen() {
    const existingLeaf = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0];
    if (existingLeaf) {
      this.app.workspace.setActiveLeaf(existingLeaf);
      const view = existingLeaf.view;
      if (view instanceof LearnSpanishNumbersView) {
        await view.render();
      }
    } else {
      const leaf = this.app.workspace.getLeaf(true);
      await leaf.setViewState({ type: VIEW_TYPE, state: {}, active: true });
      this.app.workspace.setActiveLeaf(leaf);
      const view = leaf.view;
      if (view instanceof LearnSpanishNumbersView) {
        await view.render();
      }
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
    this.practiceSession = null;
    this.cramSession = null;
    this.cramSetupIsShuffled = false;
    this.cramCompletionRecorded = false;
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
    return validateCustomRangesInput(input);
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
    this.audioEl.removeAttribute('src');
    this.audioEl.load();
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

  /** Handle obsidian://spanish-numbers?panel=<panelId> protocol links */
  private handleProtocolHandler(params: Record<string, string>) {
    const panel = (params.panel ?? 'dashboard') as PanelId;
    const validPanels: PanelId[] = ['dashboard', 'practice', 'number-to-spanish', 'listen-learn', 'cram'];

    if (!validPanels.includes(panel)) {
      new Notice(`Unknown panel: ${panel}`);
      return;
    }

    this.currentPanel = panel;
    this.ensureViewOpen();
  }

  /** Insert a markdown hyperlink to the number view at the cursor position */
  private insertNumberViewLink(editor: Editor, view: MarkdownView) {
    const PANEL_OPTIONS: { id: PanelId; label: string }[] = [
      { id: 'dashboard', label: 'Dashboard' },
      { id: 'practice', label: 'SRS Practice' },
      { id: 'number-to-spanish', label: 'Number to Spanish' },
      { id: 'listen-learn', label: 'Listen & Learn' },
      { id: 'cram', label: 'Cram' },
    ];

    // Build a small modal-like suggestion using the suggester API
    const onChoose = (panel: { id: PanelId; label: string }) => {
      const link = `[${panel.label}](obsidian://spanish-numbers?panel=${panel.id})`;
      const cursor = editor.getCursor();
      editor.replaceRange(link, cursor);
      editor.setCursor({ line: cursor.line, ch: cursor.ch + link.length });
    };

    // Use Obsidian's built-in FuzzySuggestModal
    const modal = new PanelSuggestModal(this.app, PANEL_OPTIONS, onChoose);
    modal.open();
  }

  render() {
    this.syncReminderNoticeState();
    const leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0];
    const view = leaf?.view;
    if (view instanceof LearnSpanishNumbersView) {
      void view.render();
    }
  }
}

class PanelSuggestModal extends FuzzySuggestModal<{ id: PanelId; label: string }> {
  private options: { id: PanelId; label: string }[];
  private onChoose: (item: { id: PanelId; label: string }) => void;

  constructor(
    app: import('obsidian').App,
    options: { id: PanelId; label: string }[],
    onChoose: (item: { id: PanelId; label: string }) => void
  ) {
    super(app);
    this.options = options;
    this.onChoose = onChoose;
    this.setPlaceholder('Choose a panel to link to…');
  }

  getItems() {
    return this.options;
  }

  getItemText(item: { label: string }) {
    return item.label;
  }

  onChooseItem(item: { id: PanelId; label: string }) {
    this.onChoose(item);
  }
}
