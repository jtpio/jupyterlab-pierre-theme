/*
 * Generate the JupyterLab `variables.css` for each Pierre theme from
 * `@pierre/theme`'s canonical VS Code theme JSON.
 *
 * For each of `pierre-light` / `pierre-dark` it reads the upstream
 * `colors`, `tokenColors` and `semanticTokenColors`, maps them onto the
 * JupyterLab `--jp-*` public CSS variables (plus the `--jp-mirror-editor-*`
 * editor token colors), and writes
 * `packages/jupyterlab-pierre-<variant>/style/variables.css`.
 *
 * Keeping the mapping here (rather than hand-maintained CSS) means the
 * JupyterLab themes track upstream Pierre instead of drifting from copied
 * hex values. Run with `pnpm generate`.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

/** Resolve a `@pierre/theme` theme JSON by name. */
function loadPierre(name) {
  const candidates = [
    resolve(root, 'node_modules/@pierre/theme/themes', `${name}.json`)
  ];
  for (const path of candidates) {
    try {
      return JSON.parse(readFileSync(path, 'utf8'));
    } catch {
      // try next candidate
    }
  }
  throw new Error(
    `Could not load @pierre/theme theme "${name}". Run "pnpm install" first.`
  );
}

// --- color helpers -------------------------------------------------------

function hexToRgb(hex) {
  const h = hex.replace('#', '').slice(0, 6);
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16)
  };
}

function clampByte(n) {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function rgbToHex({ r, g, b }) {
  const h = n => clampByte(n).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** Mix `hex` toward `target` by `amount` (0..1). */
function mix(hex, target, amount) {
  const a = hexToRgb(hex);
  const b = hexToRgb(target);
  return rgbToHex({
    r: a.r + (b.r - a.r) * amount,
    g: a.g + (b.g - a.g) * amount,
    b: a.b + (b.b - a.b) * amount
  });
}

const lighten = (hex, amount) => mix(hex, '#ffffff', amount);
const darken = (hex, amount) => mix(hex, '#000000', amount);

/** `rgba(...)` string from a hex color and an alpha. */
function rgba(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** A four-step ramp around a base color: [darker, base, lighter, lightest]. */
function ramp(base) {
  return [darken(base, 0.18), base, lighten(base, 0.2), lighten(base, 0.45)];
}

/**
 * Look up the foreground color for a TextMate `scope` in `tokenColors`.
 * Scopes may be a string or an array; matches on exact membership.
 */
function findToken(theme, scope, fallback) {
  for (const entry of theme.tokenColors ?? []) {
    const scopes = Array.isArray(entry.scope) ? entry.scope : [entry.scope];
    if (scopes.includes(scope) && entry.settings?.foreground) {
      return entry.settings.foreground;
    }
  }
  return fallback;
}

// --- derive the JupyterLab palette from a Pierre theme -------------------

function derive(theme) {
  const c = theme.colors;
  const s = theme.semanticTokenColors;
  const dark = theme.type === 'dark';

  const accent = c['focusBorder'];
  const fg = c['foreground'];
  const fgRgb = hexToRgb(fg);
  const fgTriple = `${fgRgb.r}, ${fgRgb.g}, ${fgRgb.b}`;

  const added = c['gitDecoration.addedResourceForeground'];
  const deleted = c['gitDecoration.deletedResourceForeground'];
  const conflict = c['gitDecoration.conflictingResourceForeground'];
  const warn = c['notificationsWarningIcon.foreground'];
  const info = c['notificationsInfoIcon.foreground'];

  // Layout ramp. Pierre exposes only a couple of surface levels, so the five
  // JupyterLab layers are derived from its editor / sidebar / input tones.
  // color0 is the deepest surface: JupyterLab paints the editor and active
  // cell with it, so it gets Pierre's editor background; color1 (panels,
  // toolbars, sidebars, inactive cells) gets the slightly lighter sidebar
  // tone.
  const layout = dark
    ? [
        c['editor.background'],
        c['sideBar.background'],
        c['input.background'],
        '#262626',
        '#404040'
      ]
    : [
        c['editor.background'],
        c['editor.background'],
        c['sideBar.background'],
        c['input.background'],
        c['sideBar.border']
      ];

  const border = dark
    ? ['#404040', '#404040', '#262626', '#1d1d1d']
    : [c['input.border'], c['input.border'], c['sideBar.border'], '#ededed'];

  const inverseBorder = dark ? '#404040' : c['input.border'];

  // Inverse layout = the opposite theme's surfaces, for tooltips etc.
  const inverseLayout = dark
    ? ['#fafafa', '#f5f5f5', '#e5e5e5', '#d4d4d4', '#a3a3a3']
    : ['#0a0a0a', '#171717', '#262626', '#404040', '#525252'];

  // Foreground ramp via alpha, tuned so color2/color3 land on Pierre's muted
  // foregrounds (sideBar.foreground / line-number gray) over the background.
  const fa = dark ? [0.92, 0.64, 0.44] : [0.9, 0.7, 0.55];

  const brand = [
    darken(accent, 0.2),
    accent,
    lighten(accent, 0.18),
    lighten(accent, 0.45),
    lighten(accent, 0.72)
  ];
  const accentRamp = ramp(added);
  const warnRamp = ramp(warn);
  const errorRamp = ramp(deleted);
  const successRamp = ramp(added);
  const infoRamp = ramp(info);

  const reject = dark
    ? ['#626262', '#818181', '#a0a0a0']
    : ['#9e9e9e', '#7e7e7e', '#5f5f5f'];

  // Editor syntax (CodeMirror 6 → --jp-mirror-editor-*), from semantic tokens
  // with a few markup scopes pulled from tokenColors.
  const syn = {
    keyword: s.keyword,
    atom: s.number,
    number: s.number,
    def: s.variable,
    variable: s.variable,
    variable2: s.property,
    variable3: s.namespace,
    punctuation: s.parameter,
    property: s.property,
    operator: s.parameter,
    comment: s.comment,
    string: s.string,
    meta: s.decorator,
    qualifier: s.parameter,
    builtin: s.function,
    bracket: s.parameter,
    tag: findToken(theme, 'entity.name.tag', s.variable),
    attribute: findToken(theme, 'entity.other.attribute-name', added),
    header: findToken(theme, 'markup.heading', s.type),
    quote: findToken(theme, 'markup.quote.markdown', s.comment),
    link: accent,
    error: deleted,
    hr: s.parameter,
    type: s.type,
    function: s.function,
    namespace: s.namespace
  };

  return {
    dark,
    accent,
    fg,
    fgTriple,
    conflict,
    layout,
    border,
    inverseBorder,
    inverseLayout,
    fa,
    brand,
    accentRamp,
    warnRamp,
    errorRamp,
    successRamp,
    infoRamp,
    reject,
    syn,
    // pulled-through Pierre colors
    selection: c['selection.background'],
    error1: deleted,
    info1: info,
    warn1: warn
  };
}

// --- render the CSS ------------------------------------------------------

function renderVariables(v, name) {
  const { layout: L, border: B, inverseLayout: IL, brand: BR, fa } = v;
  const uiFont = [
    v.fg,
    rgba(v.fg, fa[0]),
    rgba(v.fg, fa[1]),
    rgba(v.fg, fa[2])
  ];
  const inverseFont = v.dark
    ? [
        'rgba(0, 0, 0, 1)',
        'rgba(0, 0, 0, 0.8)',
        'rgba(0, 0, 0, 0.5)',
        'rgba(0, 0, 0, 0.3)'
      ]
    : [
        'rgba(255, 255, 255, 1)',
        'rgba(255, 255, 255, 0.8)',
        'rgba(255, 255, 255, 0.5)',
        'rgba(255, 255, 255, 0.3)'
      ];
  const shadowLightness = v.dark ? 20 : 240;
  const dialogBg = v.dark ? 'rgba(0, 0, 0, 0.6)' : 'rgba(0, 0, 0, 0.25)';
  const toolbarShadow = v.dark
    ? '0 0 2px 0 rgba(0, 0, 0, 0.8)'
    : '0 0 2px 0 rgba(0, 0, 0, 0.24)';
  const linkHover = v.dark ? lighten(v.accent, 0.12) : darken(v.accent, 0.12);

  return `/* ----------------------------------------------------------------------------
| Pierre theme for JupyterLab.
|
| Generated by scripts/generate-theme.mjs from @pierre/theme (${name}).
| Do not edit by hand; run "pnpm generate" to regenerate.
|--------------------------------------------------------------------------- */

:root {
  /* Elevation */
  --jp-shadow-base-lightness: ${shadowLightness};
  --jp-shadow-umbra-color: rgba(
    var(--jp-shadow-base-lightness),
    var(--jp-shadow-base-lightness),
    var(--jp-shadow-base-lightness),
    0.2
  );
  --jp-shadow-penumbra-color: rgba(
    var(--jp-shadow-base-lightness),
    var(--jp-shadow-base-lightness),
    var(--jp-shadow-base-lightness),
    0.14
  );
  --jp-shadow-ambient-color: rgba(
    var(--jp-shadow-base-lightness),
    var(--jp-shadow-base-lightness),
    var(--jp-shadow-base-lightness),
    0.12
  );
  --jp-elevation-z0: none;
  --jp-elevation-z1:
    0 2px 1px -1px var(--jp-shadow-umbra-color),
    0 1px 1px 0 var(--jp-shadow-penumbra-color),
    0 1px 3px 0 var(--jp-shadow-ambient-color);
  --jp-elevation-z2:
    0 3px 1px -2px var(--jp-shadow-umbra-color),
    0 2px 2px 0 var(--jp-shadow-penumbra-color),
    0 1px 5px 0 var(--jp-shadow-ambient-color);
  --jp-elevation-z4:
    0 2px 4px -1px var(--jp-shadow-umbra-color),
    0 4px 5px 0 var(--jp-shadow-penumbra-color),
    0 1px 10px 0 var(--jp-shadow-ambient-color);
  --jp-elevation-z6:
    0 3px 5px -1px var(--jp-shadow-umbra-color),
    0 6px 10px 0 var(--jp-shadow-penumbra-color),
    0 1px 18px 0 var(--jp-shadow-ambient-color);
  --jp-elevation-z8:
    0 5px 5px -3px var(--jp-shadow-umbra-color),
    0 8px 10px 1px var(--jp-shadow-penumbra-color),
    0 3px 14px 2px var(--jp-shadow-ambient-color);
  --jp-elevation-z12:
    0 7px 8px -4px var(--jp-shadow-umbra-color),
    0 12px 17px 2px var(--jp-shadow-penumbra-color),
    0 5px 22px 4px var(--jp-shadow-ambient-color);
  --jp-elevation-z16:
    0 8px 10px -5px var(--jp-shadow-umbra-color),
    0 16px 24px 2px var(--jp-shadow-penumbra-color),
    0 6px 30px 5px var(--jp-shadow-ambient-color);
  --jp-elevation-z20:
    0 10px 13px -6px var(--jp-shadow-umbra-color),
    0 20px 31px 3px var(--jp-shadow-penumbra-color),
    0 8px 38px 7px var(--jp-shadow-ambient-color);
  --jp-elevation-z24:
    0 11px 15px -7px var(--jp-shadow-umbra-color),
    0 24px 38px 3px var(--jp-shadow-penumbra-color),
    0 9px 46px 8px var(--jp-shadow-ambient-color);

  /* Borders */
  --jp-border-width: 1px;
  --jp-border-radius: 2px;
  --jp-border-color0: ${B[0]};
  --jp-border-color1: ${B[1]};
  --jp-border-color2: ${B[2]};
  --jp-border-color3: ${B[3]};
  --jp-inverse-border-color: ${v.inverseBorder};

  /* UI Fonts */
  --jp-ui-font-scale-factor: 1.2;
  --jp-ui-font-size0: 0.8333em;
  --jp-ui-font-size1: 13px;
  --jp-ui-font-size2: 1.2em;
  --jp-ui-font-size3: 1.44em;
  --jp-ui-font-family:
    -apple-system, blinkmacsystemfont, 'Segoe UI', helvetica, arial, sans-serif,
    'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol';
  --jp-ui-font-color0: ${uiFont[0]};
  --jp-ui-font-color1: ${uiFont[1]};
  --jp-ui-font-color2: ${uiFont[2]};
  --jp-ui-font-color3: ${uiFont[3]};
  --jp-ui-inverse-font-color0: ${inverseFont[0]};
  --jp-ui-inverse-font-color1: ${inverseFont[1]};
  --jp-ui-inverse-font-color2: ${inverseFont[2]};
  --jp-ui-inverse-font-color3: ${inverseFont[3]};

  /* Content Fonts */
  --jp-content-line-height: 1.6;
  --jp-content-font-scale-factor: 1.2;
  --jp-content-font-size0: 0.8333em;
  --jp-content-font-size1: 14px;
  --jp-content-font-size2: 1.2em;
  --jp-content-font-size3: 1.44em;
  --jp-content-font-size4: 1.728em;
  --jp-content-font-size5: 2.0736em;
  --jp-content-presentation-font-size1: 17px;
  --jp-content-heading-line-height: 1;
  --jp-content-heading-margin-top: 1.2em;
  --jp-content-heading-margin-bottom: 0.8em;
  --jp-content-heading-font-weight: 500;
  --jp-content-font-family:
    system-ui, -apple-system, blinkmacsystemfont, 'Segoe UI', helvetica, arial,
    sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol';
  --jp-content-font-color0: ${uiFont[0]};
  --jp-content-font-color1: ${uiFont[1]};
  --jp-content-font-color2: ${uiFont[2]};
  --jp-content-font-color3: ${uiFont[3]};
  --jp-content-link-color: ${v.accent};
  --jp-content-link-visited-color: ${v.conflict};
  --jp-content-link-hover-color: ${linkHover};

  /* Code Fonts */
  --jp-code-font-size: 13px;
  --jp-code-line-height: 1.3077;
  --jp-code-padding: 0.385em;
  --jp-code-font-family-default: menlo, consolas, 'DejaVu Sans Mono', monospace;
  --jp-code-font-family: var(--jp-code-font-family-default);
  --jp-code-presentation-font-size: 16px;
  --jp-code-cursor-width0: 1.4px;
  --jp-code-cursor-width1: 2px;
  --jp-code-cursor-width2: 4px;

  /* Layout colors */
  --jp-layout-color0: ${L[0]};
  --jp-layout-color1: ${L[1]};
  --jp-layout-color2: ${L[2]};
  --jp-layout-color3: ${L[3]};
  --jp-layout-color4: ${L[4]};
  --jp-inverse-layout-color0: ${IL[0]};
  --jp-inverse-layout-color1: ${IL[1]};
  --jp-inverse-layout-color2: ${IL[2]};
  --jp-inverse-layout-color3: ${IL[3]};
  --jp-inverse-layout-color4: ${IL[4]};

  /* Brand/Accent colors */
  --jp-brand-color0: ${BR[0]};
  --jp-brand-color1: ${BR[1]};
  --jp-brand-color2: ${BR[2]};
  --jp-brand-color3: ${BR[3]};
  --jp-brand-color4: ${BR[4]};
  --jp-accent-color0: ${v.accentRamp[0]};
  --jp-accent-color1: ${v.accentRamp[1]};
  --jp-accent-color2: ${v.accentRamp[2]};
  --jp-accent-color3: ${v.accentRamp[3]};

  /* State colors */
  --jp-warn-color0: ${v.warnRamp[0]};
  --jp-warn-color1: ${v.warnRamp[1]};
  --jp-warn-color2: ${v.warnRamp[2]};
  --jp-warn-color3: ${v.warnRamp[3]};
  --jp-error-color0: ${v.errorRamp[0]};
  --jp-error-color1: ${v.errorRamp[1]};
  --jp-error-color2: ${v.errorRamp[2]};
  --jp-error-color3: ${v.errorRamp[3]};
  --jp-success-color0: ${v.successRamp[0]};
  --jp-success-color1: ${v.successRamp[1]};
  --jp-success-color2: ${v.successRamp[2]};
  --jp-success-color3: ${v.successRamp[3]};
  --jp-info-color0: ${v.infoRamp[0]};
  --jp-info-color1: ${v.infoRamp[1]};
  --jp-info-color2: ${v.infoRamp[2]};
  --jp-info-color3: ${v.infoRamp[3]};

  /* Cell specific styles */
  --jp-cell-padding: 5px;
  --jp-cell-collapser-width: 8px;
  --jp-cell-collapser-min-height: 20px;
  --jp-cell-collapser-not-active-hover-opacity: 0.6;
  --jp-cell-editor-background: var(--jp-layout-color1);
  --jp-cell-editor-active-background: var(--jp-layout-color0);
  --jp-cell-editor-active-border-color: var(--jp-brand-color1);
  --jp-cell-editor-border-color: ${B[1]};
  --jp-cell-editor-box-shadow: inset 0 0 2px ${v.accent};
  --jp-cell-prompt-width: 64px;
  --jp-cell-prompt-font-family: var(--jp-code-font-family-default);
  --jp-cell-prompt-letter-spacing: 0;
  --jp-cell-prompt-opacity: 1;
  --jp-cell-prompt-not-active-opacity: 1;
  --jp-cell-prompt-not-active-font-color: ${rgba(v.fg, 0.26)};
  --jp-cell-inprompt-font-color: ${BR[1]};
  --jp-cell-outprompt-font-color: ${v.warnRamp[1]};

  /* Notebook specific styles */
  --jp-notebook-padding: 10px;
  --jp-notebook-select-background: var(--jp-layout-color1);
  --jp-notebook-multiselected-color: ${rgba(v.accent, 0.24)};
  --jp-notebook-scroll-padding: calc(
    100% - var(--jp-code-font-size) * var(--jp-code-line-height) -
      var(--jp-code-padding) - var(--jp-cell-padding) - 1px
  );

  /* Console specific styles */
  --jp-console-padding: 10px;

  /* Toolbar specific styles */
  --jp-toolbar-border-color: var(--jp-border-color2);
  --jp-toolbar-micro-height: 8px;
  --jp-toolbar-background: var(--jp-layout-color1);
  --jp-toolbar-header-margin: 4px 4px 0 4px;
  --jp-toolbar-active-background: var(--jp-layout-color0);
  --jp-toolbar-box-shadow: ${toolbarShadow};

  /* Statusbar specific styles */
  --jp-statusbar-height: 24px;

  /* Input field styles */
  --jp-input-active-background: var(--jp-layout-color0);
  --jp-input-hover-background: var(--jp-layout-color2);
  --jp-input-border-color: var(--jp-inverse-border-color);
  --jp-input-active-border-color: var(--jp-brand-color1);
  --jp-input-box-shadow: inset 0 0 2px ${v.accent};
  --jp-input-background: ${rgba(v.fg, 0.04)};
  --jp-input-active-box-shadow-color: ${rgba(v.accent, 0.3)};

  /* Rendermime styles */
  --jp-rendermime-error-background: ${rgba(v.error1, 0.28)};
  --jp-rendermime-table-row-background: var(--jp-layout-color0);
  --jp-rendermime-table-row-hover-background: ${rgba(v.info1, 0.2)};

  /* Dialog styles */
  --jp-dialog-background: ${dialogBg};

  /* Editor styles */
  --jp-editor-selected-background: ${v.selection};
  --jp-editor-selected-focused-background: ${rgba(v.accent, 0.24)};
  --jp-editor-cursor-color: ${v.accent};

  /* CodeMirror / mirror editor colors */
  --jp-mirror-editor-keyword-color: ${v.syn.keyword};
  --jp-mirror-editor-atom-color: ${v.syn.atom};
  --jp-mirror-editor-number-color: ${v.syn.number};
  --jp-mirror-editor-def-color: ${v.syn.def};
  --jp-mirror-editor-variable-color: ${v.syn.variable};
  --jp-mirror-editor-variable-2-color: ${v.syn.variable2};
  --jp-mirror-editor-variable-3-color: ${v.syn.variable3};
  --jp-mirror-editor-punctuation-color: ${v.syn.punctuation};
  --jp-mirror-editor-property-color: ${v.syn.property};
  --jp-mirror-editor-operator-color: ${v.syn.operator};
  --jp-mirror-editor-comment-color: ${v.syn.comment};
  --jp-mirror-editor-string-color: ${v.syn.string};
  --jp-mirror-editor-string-2-color: ${v.syn.string};
  --jp-mirror-editor-meta-color: ${v.syn.meta};
  --jp-mirror-editor-qualifier-color: ${v.syn.qualifier};
  --jp-mirror-editor-builtin-color: ${v.syn.builtin};
  --jp-mirror-editor-bracket-color: ${v.syn.bracket};
  --jp-mirror-editor-tag-color: ${v.syn.tag};
  --jp-mirror-editor-attribute-color: ${v.syn.attribute};
  --jp-mirror-editor-header-color: ${v.syn.header};
  --jp-mirror-editor-quote-color: ${v.syn.quote};
  --jp-mirror-editor-link-color: ${v.syn.link};
  --jp-mirror-editor-error-color: ${v.syn.error};
  --jp-mirror-editor-hr-color: ${v.syn.hr};

  /* Extra syntax colors for the CodeMirror tags JupyterLab's highlight style
     leaves unstyled, read by the Pierre editor extension (src/syntax.ts).
     Defined only here, so the extension stays inert under other themes. */
  --jpp-tok-type-color: ${v.syn.type};
  --jpp-tok-function-color: ${v.syn.function};
  --jpp-tok-variable-color: ${v.syn.variable};
  --jpp-tok-namespace-color: ${v.syn.namespace};
  --jpp-tok-constant-color: ${v.syn.number};
  --jpp-keyword-weight: normal;

  /* Scrollbar styles */
  --jp-scrollbar-background-color: var(--jp-layout-color0);
  --jp-scrollbar-thumb-color: ${v.fgTriple};
  --jp-scrollbar-endpad: 3px;
  --jp-scrollbar-thumb-margin: 3.5px;
  --jp-scrollbar-thumb-radius: 9px;

  /* User colors */
  --jp-collaborator-color1: #ad4a00;
  --jp-collaborator-color2: #7b6a00;
  --jp-collaborator-color3: #007e00;
  --jp-collaborator-color4: #008772;
  --jp-collaborator-color5: #0079b9;
  --jp-collaborator-color6: #8b45c6;
  --jp-collaborator-color7: #be208b;

  /* Sidebar styles */
  --jp-sidebar-min-width: 250px;

  /* Search styles */
  --jp-search-toggle-off-opacity: 0.6;
  --jp-search-toggle-hover-opacity: 0.8;
  --jp-search-toggle-on-opacity: 1;
  --jp-search-unselected-match-color: var(--jp-ui-inverse-font-color0);
  --jp-search-selected-match-background-color: ${rgba(v.info1, 0.4)};
  --jp-search-selected-match-color: var(--jp-layout-color1);
  --jp-search-unselected-match-background-color: ${rgba(v.info1, 0.27)};

  /* Icon colors */
  --jp-icon-contrast-color0: ${v.conflict};
  --jp-icon-contrast-color1: ${v.successRamp[1]};
  --jp-icon-contrast-color2: ${v.errorRamp[1]};
  --jp-icon-contrast-color3: ${BR[1]};

  /* Button colors */
  --jp-accept-color-normal: ${BR[0]};
  --jp-accept-color-hover: ${BR[1]};
  --jp-accept-color-active: ${BR[2]};
  --jp-warn-color-normal: ${v.errorRamp[0]};
  --jp-warn-color-hover: ${v.errorRamp[1]};
  --jp-warn-color-active: ${v.errorRamp[2]};
  --jp-reject-color-normal: ${v.reject[0]};
  --jp-reject-color-hover: ${v.reject[1]};
  --jp-reject-color-active: ${v.reject[2]};

  /* File/activity icons */
  --jp-jupyter-icon-color: ${v.warnRamp[1]};
  --jp-notebook-icon-color: ${v.warnRamp[1]};
  --jp-json-icon-color: ${v.warnRamp[1]};
  --jp-console-icon-background-color: ${BR[1]};
  --jp-console-icon-color: var(--jp-layout-color1);
  --jp-terminal-icon-background-color: var(--jp-layout-color3);
  --jp-terminal-icon-color: ${rgba(v.fg, 0.92)};
  --jp-text-editor-icon-color: ${rgba(v.fg, 0.55)};
  --jp-inspector-icon-color: ${rgba(v.fg, 0.55)};
  --jp-switch-color: ${v.reject[0]};
  --jp-switch-true-position-color: ${BR[1]};
  --jp-switch-cursor-color: ${rgba(v.fg, 0.8)};

  /* Vega */
  --jp-vega-background: var(--jp-layout-color0);

  /* Shortcut buttons */
  --jp-shortcuts-button-background: ${BR[1]};
  --jp-shortcuts-button-hover-background: ${BR[2]};
}

/* Completer specific styles */

.jp-Completer {
  --jp-completer-type-background0: transparent;
  --jp-completer-type-background1: #1f77b4;
  --jp-completer-type-background2: #ff7f0e;
  --jp-completer-type-background3: #2ca02c;
  --jp-completer-type-background4: #d62728;
  --jp-completer-type-background5: #9467bd;
  --jp-completer-type-background6: #8c564b;
  --jp-completer-type-background7: #e377c2;
  --jp-completer-type-background8: #7f7f7f;
  --jp-completer-type-background9: #bcbd22;
  --jp-completer-type-background10: #17becf;
}
`;
}

// --- main ----------------------------------------------------------------

const variants = [
  { theme: 'pierre-light', pkg: 'jupyterlab-pierre-light' },
  { theme: 'pierre-dark', pkg: 'jupyterlab-pierre-dark' }
];

/** Shorten `#aabbcc` to `#abc` where each channel is a repeated digit. */
function shortenHex(css) {
  return css.replace(
    /#([0-9a-f])\1([0-9a-f])\2([0-9a-f])\3(?![0-9a-f])/gi,
    '#$1$2$3'
  );
}

for (const { theme, pkg } of variants) {
  const parsed = loadPierre(theme);
  const css = shortenHex(renderVariables(derive(parsed), theme));
  const out = resolve(root, 'packages', pkg, 'style', 'variables.css');
  writeFileSync(out, css);
  console.log(`generated ${out}`);
}
