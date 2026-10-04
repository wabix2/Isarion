/**
 * Semantic design tokens for the mobile app.
 */

const colors = {
  light: {
    // Legacy aliases
    text: '#F0F2F8',
    tint: '#818CF8',

    // Core surfaces — matches the app's declared brand background (app.json splash/icon)
    background: '#0A0C12',
    foreground: '#F0F2F8',

    // Cards / elevated surfaces
    card: '#12151F',
    cardForeground: '#F0F2F8',
    cardBorder: '#1E2130',

    // Primary action color
    primary: '#6366F1',
    primaryForeground: '#ffffff',

    // Secondary / less-emphasis
    secondary: '#1A1E2A',
    secondaryForeground: '#C4C9D4',

    // Muted / subdued elements
    muted: '#1A1E2A',
    mutedForeground: '#8892A4',

    // Accent highlights
    accent: '#1A1E2A',
    accentForeground: '#C4C9D4',

    // Destructive actions
    destructive: '#ef4444',
    destructiveForeground: '#ffffff',

    // Borders and inputs
    border: '#1E2130',
    input: '#1E2130',

    // Text shades (aliases used by new components)
    textMuted: '#8892A4',       // same as mutedForeground
    textSecondary: '#C4C9D4',   // same as secondaryForeground

    // XP / gamification accent
    xp: '#FBBF24',
  },

  // Border radius
  radius: 8,
};

export default colors;
