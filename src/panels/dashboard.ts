// Dashboard Panel - Main entry point

import LearnSpanishNumbersPlugin from '../plugin';
import { APP_ICONS, iconWithLabel } from '../ui/icons';

export class DashboardPanel {
  private plugin: LearnSpanishNumbersPlugin;
  private container: HTMLElement;

  constructor(plugin: LearnSpanishNumbersPlugin, container: HTMLElement) {
    this.plugin = plugin;
    this.container = container;
  }

  render() {
    const stats = this.plugin.getCardStats();
    const audioLabel = this.plugin.settings.audioEnabled ? 'On' : 'Off';

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

        <div class="lsn-stat-grid-2 lsn-mb-12">
          <button id="btn-practice" class="lsn-btn-primary">${iconWithLabel(APP_ICONS.practice, 'SRS Practice')}</button>
          <button id="btn-cram" class="lsn-btn-secondary">${iconWithLabel(APP_ICONS.cram, 'Cram Test')}</button>
        </div>

        <div class="lsn-stat-grid-2 lsn-mb-12">
          <button id="btn-listen" class="lsn-btn-purple">${iconWithLabel(APP_ICONS.listen, 'Listen & Learn')}</button>
          <button id="btn-number-to-spanish" class="lsn-btn-dark">${iconWithLabel(APP_ICONS.numberToSpanish, 'Number to Spanish')}</button>
        </div>

        <div class="lsn-flex-end lsn-mt-16">
          <button id="audio-toggle" class="lsn-btn-toggle ${this.plugin.settings.audioEnabled ? 'lsn-audio-on' : 'lsn-audio-off'}">${iconWithLabel(APP_ICONS.audio, `Audio ${audioLabel}`)}</button>
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

    // Audio toggle
    this.container.querySelector('#audio-toggle')?.addEventListener('click', async (e) => {
      this.plugin.settings.audioEnabled = !this.plugin.settings.audioEnabled;
      await this.plugin.saveSettings();
      const btn = e.currentTarget as HTMLButtonElement;
      if (btn) {
        btn.classList.toggle('lsn-audio-on', this.plugin.settings.audioEnabled);
        btn.classList.toggle('lsn-audio-off', !this.plugin.settings.audioEnabled);
        const labelEl = btn.querySelector('span');
        if (labelEl) {
          labelEl.textContent = `Audio ${this.plugin.settings.audioEnabled ? 'On' : 'Off'}`;
        }
      }
    });
  }
}
