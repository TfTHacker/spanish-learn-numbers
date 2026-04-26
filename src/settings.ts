// Settings tab for Learn Spanish Numbers plugin

import { App, Notice, PluginSettingTab, Setting } from 'obsidian';
import { DEFAULT_RANGES, FOCUSED_RANGE_PRESETS, VOICE_OPTIONS } from './types';
import LearnSpanishNumbersPlugin from './plugin';
import { APP_ICONS, iconWithLabel } from './ui/icons';

export class LearnSpanishNumbersSettingTab extends PluginSettingTab {
  plugin: LearnSpanishNumbersPlugin;
  private debounceTimer: number | null = null;

  constructor(app: App, plugin: LearnSpanishNumbersPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  hide(): void {
    this.clearDebounceTimer();
    super.hide();
  }

  display(): void {
    this.clearDebounceTimer();
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl('h2', { text: 'Learn Spanish Numbers Settings' });

    // Number ranges section
    const rangesBox = containerEl.createEl('div');
    rangesBox.addClasses(['lsn-settings-section']);
    
    const rangesTitle = rangesBox.createEl('div');
    rangesTitle.addClasses(['lsn-settings-title']);
    rangesTitle.textContent = 'Number Range for Learning';
    
    const rangesDesc = rangesBox.createEl('p');
    rangesDesc.addClasses(['lsn-settings-desc']);
    rangesDesc.textContent = 'Enter numbers or ranges separated by commas. Large ranges are limited to keep Obsidian responsive.';

    const presetsTitle = rangesBox.createEl('div');
    presetsTitle.addClasses(['lsn-label']);
    presetsTitle.textContent = 'Focused Range Presets';

    const presetsGrid = rangesBox.createEl('div');
    presetsGrid.addClasses(['lsn-preset-grid', 'lsn-preset-grid-compact']);

    const applyRanges = async (ranges: string) => {
      rangesTextarea.value = ranges;
      const validation = this.plugin.validateCustomRanges(ranges);
      if (validation.valid) {
        rangesTextarea.classList.remove('lsn-input-error');
        this.plugin.settings.customNumberRanges = ranges;
        await this.plugin.saveSettings();
        this.plugin.renderView();
      } else {
        rangesTextarea.classList.add('lsn-input-error');
      }
    };

    FOCUSED_RANGE_PRESETS.forEach((preset) => {
      const btn = presetsGrid.createEl('button');
      btn.type = 'button';
      btn.addClasses(['lsn-preset-btn', 'lsn-preset-btn-compact']);
      btn.title = preset.label;
      btn.innerHTML = `<span class="lsn-preset-range">${preset.compactLabel ?? preset.ranges}</span>`;
      btn.addEventListener('click', async () => {
        await applyRanges(preset.ranges);
        new Notice(`Using preset: ${preset.label}`);
      });
    });

    const rangesActions = rangesBox.createEl('div');
    rangesActions.addClasses(['lsn-settings-actions']);

    const resetDefaultBtn = rangesActions.createEl('button');
    resetDefaultBtn.type = 'button';
    resetDefaultBtn.addClasses(['lsn-btn-dark', 'lsn-settings-reset-btn']);
    resetDefaultBtn.textContent = 'Reset to Default';
    resetDefaultBtn.addEventListener('click', async () => {
      await applyRanges(DEFAULT_RANGES);
      new Notice('Restored default number ranges');
    });
    
    const exampleDiv = rangesBox.createEl('div');
    exampleDiv.addClasses(['lsn-example']);
    exampleDiv.innerHTML = `
      <div style="margin-bottom:4px;font-weight:500;">Examples:</div>
      <div style="margin-bottom:2px;"><code class="lsn-code">1-10</code> - Range 1 to 10</div>
      <div style="margin-bottom:2px;"><code class="lsn-code">5, 10, 15</code> - Specific numbers</div>
      <div><code class="lsn-code">1-10, 20-30, 100</code> - Multiple groups</div>
    `;
    
    const rangesTextarea = rangesBox.createEl('textarea');
    rangesTextarea.rows = 4;
    rangesTextarea.addClasses(['lsn-input']);
    rangesTextarea.style.cssText = 'width:100%;box-sizing:border-box;padding:12px;border-radius:8px;border:1px solid var(--border);font-size:14px;background:var(--background-primary);color:var(--text);';
    rangesTextarea.value = this.plugin.settings.customNumberRanges || DEFAULT_RANGES;
    
    // Debounced input handler
    const handleInput = async () => {
      // Clear existing timer
      if (this.debounceTimer !== null) {
        clearTimeout(this.debounceTimer);
      }
      
      // Debounce for 500ms
      this.debounceTimer = window.setTimeout(async () => {
        const validation = this.plugin.validateCustomRanges(rangesTextarea.value);
        
        // Use CSS class for error styling
        if (validation.valid) {
          rangesTextarea.classList.remove('lsn-input-error');
          this.plugin.settings.customNumberRanges = rangesTextarea.value;
          await this.plugin.saveSettings();
          this.plugin.renderView();
        } else {
          rangesTextarea.classList.add('lsn-input-error');
        }
        
        this.debounceTimer = null;
      }, 500);
    };
    
    rangesTextarea.addEventListener('input', handleInput);

    // Voice settings
    new Setting(containerEl)
      .setName('Voice')
      .setDesc('Select voice for text-to-speech')
      .addDropdown(dropdown => {
        VOICE_OPTIONS.forEach(v => dropdown.addOption(v.id, v.name));
        dropdown.setValue(this.plugin.settings.voiceId).onChange(async (value: string) => {
          this.plugin.settings.voiceId = value;
          await this.plugin.saveSettings();
        });
      })
      .addButton(button => {
        button.setButtonText('Test Voice');
        button.buttonEl.innerHTML = iconWithLabel(APP_ICONS.voice, 'Test Voice');
        button.onClick(() => {
          // Sample sentence using numbers 5 and 15
          this.plugin.playAudio('Tengo cinco gatos y quince perros.', this.plugin.settings.voiceId);
        });
      });

    // Reminder interval
    new Setting(containerEl)
      .setName('Reminder Interval')
      .setDesc('Minutes between practice reminders (0 to disable)')
      .addDropdown(dropdown => {
        [0, 5, 10, 15, 20, 30].forEach(m => {
          dropdown.addOption(String(m), m === 0 ? 'No Reminder' : `${m} minutes`);
        });
        dropdown.setValue(String(this.plugin.settings.reminderInterval)).onChange(async (value: string) => {
          this.plugin.settings.reminderInterval = parseInt(value);
          await this.plugin.saveSettings();
          this.plugin.refreshReminderTimer();
        });
      });

    // Reset progress
    new Setting(containerEl)
      .setName('Reset Progress')
      .setDesc('Deletes the plugin data file and permanently removes progress, history, recents, and saved settings.')
      .addButton(button => {
        button.setButtonText('Reset All Data').setWarning().onClick(async () => {
          if (confirm('This will permanently delete all Learn Spanish Numbers data, including progress, history, recents, reminders, and saved settings. This cannot be undone. Continue?')) {
            await this.plugin.resetAllData();
            new Notice('All plugin data deleted');
          }
        });
      });
  }

  private clearDebounceTimer() {
    if (this.debounceTimer === null) {
      return;
    }

    window.clearTimeout(this.debounceTimer);
    this.debounceTimer = null;
  }
}
