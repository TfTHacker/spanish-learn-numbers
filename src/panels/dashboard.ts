// Dashboard Panel - Main entry point

import LearnSpanishNumbersPlugin from '../plugin';
import { APP_ICONS, iconOnly, iconWithLabel } from '../ui/icons';
import { LearnSpanishNumbersView } from '../view';

export class DashboardPanel {
  private plugin: LearnSpanishNumbersPlugin;
  private container: HTMLElement;
  private view: LearnSpanishNumbersView;

  constructor(plugin: LearnSpanishNumbersPlugin, container: HTMLElement, view: LearnSpanishNumbersView) {
    this.plugin = plugin;
    this.container = container;
    this.view = view;
  }

  private getAudioToggleMarkup() {
    const audioIcon = this.plugin.settings.audioEnabled ? APP_ICONS.audio : APP_ICONS.audioOff;
    const audioLabel = this.plugin.settings.audioEnabled ? 'Audio on' : 'Audio off';
    const audioIconClass = this.plugin.settings.audioEnabled ? 'lsn-icon-only' : 'lsn-icon-only lsn-audio-icon-off';
    return `
      <button id="audio-toggle" class="lsn-btn-toggle lsn-dashboard-icon-btn" aria-label="${audioLabel}" title="${audioLabel}" data-audio-enabled="${this.plugin.settings.audioEnabled}">
        <span id="audio-toggle-icon" class="${audioIconClass}">${audioIcon}</span>
      </button>
    `;
  }

  private updateAudioToggleButton() {
    const btn = this.container.querySelector('#audio-toggle') as HTMLButtonElement | null;
    const icon = this.container.querySelector('#audio-toggle-icon') as HTMLElement | null;
    const audioLabel = this.plugin.settings.audioEnabled ? 'Audio on' : 'Audio off';
    const audioIcon = this.plugin.settings.audioEnabled ? APP_ICONS.audio : APP_ICONS.audioOff;

    if (icon) {
      icon.innerHTML = audioIcon;
      icon.classList.toggle('lsn-audio-icon-off', !this.plugin.settings.audioEnabled);
    }

    if (btn) {
      btn.dataset.audioEnabled = String(this.plugin.settings.audioEnabled);
      btn.setAttribute('aria-label', audioLabel);
      btn.setAttribute('title', audioLabel);
    }
  }

  render() {
    const stats = this.plugin.getCardStats();

    this.container.innerHTML = `
      <div class="lsn-wrap">
        <div class="lsn-text-center lsn-mb-24">
          <h1 class="lsn-title-lg">Learn Spanish Numbers</h1>
        </div>

        <div class="lsn-stat-grid lsn-mb-16">
          <div class="lsn-stat-item">
            <div class="lsn-stat-value lsn-stat-value-purple">${stats.new}</div>
            <div class="lsn-text-muted lsn-text-muted-sm">New</div>
          </div>
          <div class="lsn-stat-item">
            <div class="lsn-stat-value lsn-stat-value-orange">${stats.inProgress}</div>
            <div class="lsn-text-muted lsn-text-muted-sm">In Progress</div>
          </div>
          <div class="lsn-stat-item">
            <div class="lsn-stat-value lsn-stat-value-green">${stats.learned}</div>
            <div class="lsn-text-muted lsn-text-muted-sm">Mastered</div>
          </div>
        </div>

        <div class="lsn-stat-grid-2 lsn-dashboard-actions lsn-mb-12">
          <button id="btn-practice" class="lsn-btn-primary lsn-dashboard-btn">${iconWithLabel(APP_ICONS.practice, 'SRS Practice')}</button>
          <button id="btn-cram" class="lsn-btn-secondary lsn-dashboard-btn">${iconWithLabel(APP_ICONS.cram, 'Cram Test')}</button>
        </div>

        <div class="lsn-stat-grid-2 lsn-dashboard-actions lsn-mb-12">
          <button id="btn-listen" class="lsn-btn-purple lsn-dashboard-btn">${iconWithLabel(APP_ICONS.listen, 'Listen & Learn')}</button>
          <button id="btn-number-to-spanish" class="lsn-btn-dark lsn-dashboard-btn">${iconWithLabel(APP_ICONS.numberToSpanish, 'Number to Spanish')}</button>
        </div>

        <div class="lsn-dashboard-toolbar lsn-mt-16">
          ${this.getAudioToggleMarkup()}
          <button id="btn-close" class="lsn-btn-toggle lsn-dashboard-exit-btn" aria-label="Exit">${iconOnly(APP_ICONS.exit)}</button>
        </div>
      </div>
    `;

    this.container.querySelector('#btn-practice')?.addEventListener('click', () => {
      this.plugin.currentPanel = 'practice';
      this.plugin.render();
    });

    this.container.querySelector('#btn-cram')?.addEventListener('click', () => {
      this.plugin.currentPanel = 'cram';
      this.plugin.render();
    });

    this.container.querySelector('#btn-listen')?.addEventListener('click', () => {
      // Reset Listen & Learn state to show setup
      this.plugin.listenLearnState.numbers = [];
      this.plugin.listenLearnState.currentIndex = 0;
      this.plugin.listenLearnState.showingAnswer = false;
      this.plugin.currentPanel = 'listen-learn';
      this.plugin.render();
    });

    this.container.querySelector('#btn-number-to-spanish')?.addEventListener('click', () => {
      this.plugin.currentPanel = 'number-to-spanish';
      this.plugin.render();
    });

    this.container.querySelector('#btn-close')?.addEventListener('click', async () => {
      await this.view.leaf.detach();
    });

    // Audio toggle
    this.container.querySelector('#audio-toggle')?.addEventListener('click', async (e) => {
      this.plugin.settings.audioEnabled = !this.plugin.settings.audioEnabled;
      await this.plugin.saveSettings();
      this.updateAudioToggleButton();
    });
  }
}
