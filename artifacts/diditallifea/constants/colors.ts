/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    // Legacy aliases (kept for backward compatibility)
    text: '#17212B',
    tint: '#EAA948',

    // Core surfaces
    background: '#F5F1E8',
    foreground: '#17212B',

    // Cards / elevated surfaces
    card: '#FFFDF8',
    cardForeground: '#17212B',

    // Primary action color (buttons, links, active states)
    primary: '#EAA948',
    primaryForeground: '#17212B',
    insightBackground: '#17212B',
    insightForeground: '#F5F1E8',
    insightMuted: '#C7D4CB',

    // Secondary / less-emphasis interactive surfaces
    secondary: '#E5ECE5',
    secondaryForeground: '#274238',

    // Muted / subdued elements (dividers, timestamps, placeholders)
    muted: '#E9E5DA',
    mutedForeground: '#6F756E',

    // Accent highlights (badges, selected items, focus rings)
    accent: '#F2D3C5',
    accentForeground: '#7C463C',

    // Destructive actions (delete, error states)
    destructive: '#C65F55',
    destructiveForeground: '#FFFDF8',

    // Borders and input outlines
    border: '#D7D2C7',
    input: '#D7D2C7',
  },

  dark: {
    text: '#F5F1E8',
    tint: '#F0B65B',
    background: '#17212B',
    foreground: '#F5F1E8',
    card: '#21313A',
    cardForeground: '#F5F1E8',
    primary: '#F0B65B',
    primaryForeground: '#17212B',
    insightBackground: '#17212B',
    insightForeground: '#F5F1E8',
    insightMuted: '#C7D4CB',
    secondary: '#29433B',
    secondaryForeground: '#E5ECE5',
    muted: '#2A3740',
    mutedForeground: '#A9B1AB',
    accent: '#6C423C',
    accentForeground: '#F2D3C5',
    destructive: '#E47A6E',
    destructiveForeground: '#17212B',
    border: '#3B4A50',
    input: '#3B4A50',
  },

  // Border radius (in px). Sync from the sibling web artifact's --radius
  // CSS variable. This value applies to cards, buttons, inputs, and modals.
  radius: 18,
};

export default colors;
