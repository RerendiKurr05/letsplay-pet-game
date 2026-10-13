const config = window.petgameConfig || {};

export function getGameAsset(...path) {
  const value = path.reduce(
    (current, key) => current && typeof current === 'object' ? current[key] : null,
    config.assets || {},
  );
  return typeof value === 'string' && value.trim() ? value : null;
}

export function getGameThemeStyle() {
  const theme = config.theme || {};
  const properties = {
    primary: '--red',
    ink: '--ink',
    surface: '--white',
    background: '--cream',
    soft: '--peach',
    accent: '--blush',
  };

  return Object.entries(properties).reduce((style, [key, property]) => {
    const color = theme[key];
    if (typeof color === 'string' && /^#[\da-f]{3}(?:[\da-f]{3})?$/i.test(color)) {
      style[property] = color;
    }
    return style;
  }, {});
}
