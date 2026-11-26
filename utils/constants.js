export const DARK_THEME = {
  mode: 'dark',
  background: '#0B0F17',
  surface: '#131924',
  surfaceElevated: '#1A2232',
  border: '#242E42',
  primary: '#3B82F6',
  primarySoft: 'rgba(59, 130, 246, 0.14)',
  primaryText: '#FFFFFF',
  accent: '#10B981',
  accentSoft: 'rgba(16, 185, 129, 0.14)',
  danger: '#EF4444',
  dangerSoft: 'rgba(239, 68, 68, 0.14)',
  warning: '#F59E0B',
  text: '#F1F5F9',
  textMuted: '#94A3B8',
  textDim: '#64748B',
  tabBar: '#0F1520',
  modalBg: '#131924',
  backdrop: 'rgba(5, 8, 15, 0.78)',
  radarBg: '#0F1623',
  radarRing: 'rgba(59, 130, 246, 0.22)',
  radarSweep: 'rgba(59, 130, 246, 0.45)',
  unlockedCardBg: '#10201C',
  unlockedCardBorder: 'rgba(16, 185, 129, 0.38)',
};

export const LIGHT_THEME = {
  mode: 'light',
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceElevated: '#F1F5F9',
  border: '#E2E8F0',
  primary: '#2563EB',
  primarySoft: 'rgba(37, 99, 235, 0.10)',
  primaryText: '#FFFFFF',
  accent: '#059669',
  accentSoft: 'rgba(5, 150, 105, 0.10)',
  danger: '#DC2626',
  dangerSoft: 'rgba(220, 38, 38, 0.10)',
  warning: '#D97706',
  text: '#0F172A',
  textMuted: '#475569',
  textDim: '#94A3B8',
  tabBar: '#FFFFFF',
  modalBg: '#FFFFFF',
  backdrop: 'rgba(15, 23, 42, 0.45)',
  radarBg: '#EFF4FB',
  radarRing: 'rgba(37, 99, 235, 0.18)',
  radarSweep: 'rgba(37, 99, 235, 0.32)',
  unlockedCardBg: '#ECFDF5',
  unlockedCardBorder: 'rgba(5, 150, 105, 0.35)',
};

export const COLORS = DARK_THEME;

export const CATEGORIES = [
  { id: 'All', label: 'All Signals', icon: 'radio', color: '#3B82F6' },
  { id: 'Story', label: 'Stories', icon: 'book', color: '#6366F1' },
  { id: 'Secret', label: 'Secrets', icon: 'key', color: '#DB2777' },
  { id: 'Music', label: 'Music & Vibe', icon: 'musical-notes', color: '#0284C7' },
  { id: 'Whisper', label: 'Whispers', icon: 'volume-low', color: '#059669' },
  { id: 'History', label: 'Urban Lore', icon: 'time', color: '#D97706' },
];

export const UNLOCK_RADIUS_METERS = 30;
export const DEFAULT_SEARCH_RADIUS = 5000;
