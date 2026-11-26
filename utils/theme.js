import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { DARK_THEME, LIGHT_THEME } from './constants';

const ThemeContext = createContext({
  theme: DARK_THEME,
  isDark: true,
  toggleTheme: () => {},
});

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme();
  const [overrideMode, setOverrideMode] = useState(null); // null = follow system

  useEffect(() => {
    // Keep system tracking active unless user manually toggled
  }, [systemScheme]);

  const activeMode = overrideMode || (systemScheme === 'light' ? 'light' : 'dark');
  const isDark = activeMode === 'dark';
  const theme = isDark ? DARK_THEME : LIGHT_THEME;

  const toggleTheme = () => {
    setOverrideMode(isDark ? 'light' : 'dark');
  };

  return (
    <ThemeContext.Provider value={{ theme, isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

