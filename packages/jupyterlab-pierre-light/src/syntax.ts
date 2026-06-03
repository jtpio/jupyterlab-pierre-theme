import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { type Extension } from '@codemirror/state';
import { tags as t } from '@lezer/highlight';

/**
 * Highlight rules that bring the JupyterLab CodeMirror editor closer to the
 * `@pierre/diffs` viewer. JupyterLab's default highlight style (in
 * `@jupyterlab/codemirror`) leaves several tokens unstyled (type and class
 * names, plain variable references, function calls) and paints booleans, null
 * and keywords as bold keywords; Pierre colors them differently.
 *
 * Every value reads a `--jpp-*` custom property that only the Pierre themes
 * define, so this extension can be registered globally and only takes effect
 * under a Pierre theme:
 *
 * - The gap-filling rules (type, namespace, variable, function) have no
 *   JupyterLab rule to compete with. Under another theme the custom property
 *   is undefined, the declaration drops to its inherited value, and the token
 *   looks exactly as it would without this extension.
 * - The override rules (booleans/null color, keyword weight) do compete with
 *   JupyterLab's rules, so they use `!important` to win. Their `var(...)`
 *   fallback is JupyterLab's own value, so under another theme they resolve to
 *   what JupyterLab already renders and nothing leaks.
 *
 * Note: `undefined` is a plain identifier to CodeMirror's grammar (not a
 * literal like in TextMate), so it follows the variable color rather than the
 * constant color the diff gives it.
 */
const pierreHighlightStyle = HighlightStyle.define([
  { tag: [t.typeName, t.className], color: 'var(--jpp-tok-type-color)' },
  { tag: t.namespace, color: 'var(--jpp-tok-namespace-color)' },
  { tag: [t.name, t.variableName], color: 'var(--jpp-tok-variable-color)' },
  {
    tag: [t.function(t.variableName), t.function(t.propertyName)],
    color: 'var(--jpp-tok-function-color)'
  },
  {
    tag: [t.bool, t.null],
    color:
      'var(--jpp-tok-constant-color, var(--jp-mirror-editor-keyword-color)) !important'
  },
  {
    tag: [t.keyword, t.operator, t.bool, t.null],
    fontWeight: 'var(--jpp-keyword-weight, bold) !important'
  }
]);

/**
 * The Pierre editor highlight extension, layered on top of JupyterLab's own
 * CodeMirror highlight style.
 */
export const pierreSyntaxExtension: Extension =
  syntaxHighlighting(pierreHighlightStyle);
