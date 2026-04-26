// LearnSpanishNumbersView - Main view that routes to different panels

import { App, Notice, View, WorkspaceLeaf } from 'obsidian';
import LearnSpanishNumbersPlugin from './plugin';
import { VIEW_TYPE } from './plugin';
import { DashboardPanel } from './panels/dashboard';
import { PracticePanel } from './panels/practice';
import { CramPanel } from './panels/cram';
import { NumberToSpanishPanel } from './panels/number-to-spanish';
import { ListenLearnPanel } from './panels/listen-learn';

export class LearnSpanishNumbersView extends View {
  private plugin: LearnSpanishNumbersPlugin;
  private container: HTMLElement;

  constructor(leaf: WorkspaceLeaf, plugin: LearnSpanishNumbersPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.container = this.containerEl;
    this.container.addClass('lsn-view');
  }

  getViewType(): string {
    return VIEW_TYPE;
  }

  getDisplayText(): string {
    return 'Learn Spanish Numbers';
  }

  async onClose() {
    this.container.removeClass('lsn-view');
    if (this.plugin.listenLearnCleanup) {
      this.plugin.listenLearnCleanup();
      this.plugin.listenLearnCleanup = null;
    }
    this.plugin.stopAudio();
  }

  async render() {
    // Note: Don't call loadSettings() here - settings are already loaded by plugin
    // and renderView() in plugin calls this directly
    if (this.plugin.currentPanel !== 'listen-learn' && this.plugin.listenLearnCleanup) {
      this.plugin.listenLearnCleanup();
      this.plugin.listenLearnCleanup = null;
    }
    
    this.container.empty();
    const wrap = document.createElement('div');
    wrap.addClasses(['lsn-wrap']);
    this.container.appendChild(wrap);

    switch (this.plugin.currentPanel) {
      case 'dashboard':
        new DashboardPanel(this.plugin, wrap, this).render();
        break;
      case 'practice':
        new PracticePanel(this.plugin, wrap, this).render();
        break;
      case 'number-to-spanish':
        new NumberToSpanishPanel(this.plugin, wrap).render();
        break;
      case 'listen-learn':
        new ListenLearnPanel(this.plugin, this.container, this).render();
        break;
      case 'cram':
        new CramPanel(this.plugin, wrap, this).render();
        break;
    }
  }
}
