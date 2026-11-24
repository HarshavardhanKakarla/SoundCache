export const COLORS = {
  background: '#090D16',
  card: '#121826',
  cardBorder: '#1F293D',
  cardActive: '#1A2337',
  primary: '#00F2FE', // Neon Cyan
  secondary: '#4FACFE', // Electric Blue
  accent: '#00F5A0', // Neon Mint Green
  danger: '#FF4B5C', // Alert Red
  warning: '#FFB800',
  text: '#F3F6FB',
  textMuted: '#7E8B9F',
  textDim: '#4B5565',
  radarScan: 'rgba(0, 242, 254, 0.15)',
  radarRing: 'rgba(0, 242, 254, 0.25)',
  unlockedGlow: '#00F5A0',
  lockedGlow: '#FF4B5C',
};

export const CATEGORIES = [
  { id: 'All', label: 'All Signals', icon: 'radio', color: '#00F2FE' },
  { id: 'Story', label: 'Stories', icon: 'book', color: '#A78BFA' },
  { id: 'Secret', label: 'Secrets', icon: 'key', color: '#F472B6' },
  { id: 'Music', label: 'Music & Vibe', icon: 'musical-notes', color: '#38BDF8' },
  { id: 'Whisper', label: 'Whispers', icon: 'volume-low', color: '#34D399' },
  { id: 'History', label: 'Urban Lore', icon: 'time', color: '#FBBF24' },
];

export const UNLOCK_RADIUS_METERS = 30; // Capsules within 30m unlock!
export const DEFAULT_SEARCH_RADIUS = 5000; // 5km search

