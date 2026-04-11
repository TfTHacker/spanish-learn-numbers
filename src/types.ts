// Types and constants for Learn Spanish Numbers plugin

export const VOICE_OPTIONS = [
  { id: 'es', name: 'Spanish (Spain)' },
  { id: 'es-MX', name: 'Spanish (Mexico)' },
];

export const DEFAULT_RANGES = '1-10, 10-20, 30-39, 40, 50, 60, 70, 90, 100, 100-130, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000, 1000-1039, 100000, 1000000, 1000000000';

export const NUMBER_GROUPS = [
  { name: '1-10', numbers: [1,2,3,4,5,6,7,8,9,10], id: '1-10' },
  { name: '11-19', numbers: [11,12,13,14,15,16,17,18,19], id: '11-19' },
  { name: '20-29', numbers: Array.from({length:10},(_,i)=>20+i), id: '20-29' },
  { name: '30s', numbers: Array.from({length:10},(_,i)=>30+i), id: '30s' },
  { name: '40s', numbers: Array.from({length:10},(_,i)=>40+i), id: '40s' },
  { name: '50s', numbers: Array.from({length:10},(_,i)=>50+i), id: '50s' },
  { name: '60s', numbers: Array.from({length:10},(_,i)=>60+i), id: '60s' },
  { name: '70s', numbers: Array.from({length:10},(_,i)=>70+i), id: '70s' },
  { name: '80s', numbers: Array.from({length:10},(_,i)=>80+i), id: '80s' },
  { name: '90s', numbers: Array.from({length:10},(_,i)=>90+i), id: '90s' },
  { name: '100-130', numbers: Array.from({length:31},(_,i)=>100+i), id: '100-130' },
  { name: '1000-12000', numbers: [1000,2000,3000,4000,5000,6000,7000,8000,9000,10000,11000,12000], id: '1000-12000' },
  { name: '100,000s', numbers: [100000,200000,300000,400000,500000,600000,700000,800000,900000], id: '100000s' },
  { name: '1,000,000s', numbers: [1000000,2000000,3000000,4000000,5000000,6000000,7000000,8000000,9000000,10000000], id: '1000000s' },
];

export const TRICKY_NUMBERS = new Set([15,16,17,18,19,20,22,23,24,25,26,27,28,29,32,33,34,35,36,37,38,39,42,43,44,45,46,47,48,49,52,53,54,55,56,57,58,59,62,63,64,65,66,67,68,69,72,73,74,75,76,77,78,79,82,83,84,85,86,87,88,89,92,93,94,95,96,97,98,99,100,1000]);

export type PanelId = 'dashboard' | 'practice' | 'number-to-spanish' | 'listen-learn' | 'cram';

export interface FocusedRangePreset {
  id: string;
  label: string;
  description: string;
  ranges: string;
  compactLabel?: string;
}

export const FOCUSED_RANGE_PRESETS: FocusedRangePreset[] = [
  { id: 'basics', label: 'Basics', description: '1 to 10', ranges: '1-10', compactLabel: '1-10' },
  { id: 'teens', label: 'Teens', description: '11 to 19', ranges: '11-19', compactLabel: '11-19' },
  { id: 'twenties', label: '20s', description: '20 to 29', ranges: '20-29', compactLabel: '20-29' },
  { id: 'tens', label: '30s-90s', description: 'Decade patterns from 30 to 99', ranges: '30-99', compactLabel: '30-99' },
  { id: 'hundreds', label: 'Hundreds', description: '100 to 130', ranges: '100-130', compactLabel: '100-130' },
  { id: 'thousands', label: 'Thousands', description: '1,000 to 10,000 plus 1,000-1,039', ranges: '1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000, 1000-1039', compactLabel: '1000 + 1001-1039' },
  { id: 'big', label: 'Big Numbers', description: '100,000, 1,000,000, and 1,000,000,000', ranges: '100000, 1000000, 1000000000', compactLabel: '100k / 1M / 1B' },
  { id: 'tricky', label: 'Tricky', description: 'Commonly confusing forms', ranges: Array.from(TRICKY_NUMBERS).join(', '), compactLabel: 'Tricky set' },
];

export interface PluginSettings {
  audioEnabled: boolean;
  voiceId: string;
  reminderInterval: number;
  lastCramGroups: string[];
  lastCramRanges: string;
  cramRecentConfigs: CramRecentConfig[];
  customNumberRanges: string;
  streakData: { currentStreak: number; lastPracticeDate: string; totalDays: number; };
  listenLearnSettings: ListenLearnSettings;
}

export interface CramRecentConfig {
  inputText: string;
  shuffled: boolean;
  usedAt: string;
}

export interface ListenLearnSettings {
  direction: 'es-en' | 'en-es' | 'es-only';
  speed: number;
  inputText: string;
  shuffled: boolean;
  autoRepeatRange: boolean;
  recentConfigs: ListenLearnRecentConfig[];
}

export interface ListenLearnRecentConfig {
  inputText: string;
  direction: 'es-en' | 'en-es' | 'es-only';
  shuffled: boolean;
  usedAt: string;
}

export interface CardData {
  id: string;
  number: number;
  direction: 'forward' | 'reverse'; // forward = number→Spanish, reverse = Spanish→number
  group: string;
  interval: number;
  ease: number;
  dueDate: number;
  reviews: number;
  correct: number;
  isTricky: boolean;
  lastReviewed: number | null;
}

export interface SessionHistory {
  date: string;
  cardsReviewed: number;
  correct: number;
  mode: 'srs' | 'cram';
  groups: string[];
}

export interface ListenLearnState {
  numbers: number[];
  currentIndex: number;
  showingAnswer: boolean;
  inputText: string;
  direction: 'es-en' | 'en-es' | 'es-only';
  speed: number;
  shuffled: boolean;
  autoRepeatRange: boolean;
}

export const DEFAULT_SETTINGS: PluginSettings = {
  audioEnabled: true,
  voiceId: 'es',
  reminderInterval: 10,
  lastCramGroups: [],
  lastCramRanges: '',
  cramRecentConfigs: [],
  customNumberRanges: '',
  streakData: { currentStreak: 0, lastPracticeDate: '', totalDays: 0 },
  listenLearnSettings: { direction: 'es-en', speed: 3, inputText: '', shuffled: false, autoRepeatRange: false, recentConfigs: [] },
};
