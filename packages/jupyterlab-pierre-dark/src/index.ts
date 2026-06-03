import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { IThemeManager } from '@jupyterlab/apputils';
import {
  EditorExtensionRegistry,
  IEditorExtensionRegistry
} from '@jupyterlab/codemirror';

import { pierreSyntaxExtension } from './syntax';

/**
 * The Pierre Dark theme.
 */
const theme: JupyterFrontEndPlugin<void> = {
  id: 'jupyterlab-pierre-dark:plugin',
  description: 'JupyterLab dark theme matching the Pierre palette',
  autoStart: true,
  requires: [IThemeManager],
  activate: (app: JupyterFrontEnd, manager: IThemeManager) => {
    const style = 'jupyterlab-pierre-dark/index.css';

    manager.register({
      name: 'Pierre Dark',
      isLight: false,
      themeScrollbars: true,
      load: () => manager.loadCSS(style),
      unload: () => Promise.resolve(undefined)
    });
  }
};

/**
 * Adds Pierre syntax colors for the CodeMirror tags JupyterLab's highlight
 * style leaves unstyled. The rules are gated by the theme's `--jpp-*`
 * variables (see src/syntax.ts), so registering this globally is safe: it
 * only takes effect while a Pierre theme is active.
 */
const editorSyntax: JupyterFrontEndPlugin<void> = {
  id: 'jupyterlab-pierre-dark:editor-syntax',
  description: 'Pierre syntax colors for the JupyterLab CodeMirror editor',
  autoStart: true,
  requires: [IEditorExtensionRegistry],
  activate: (app: JupyterFrontEnd, extensions: IEditorExtensionRegistry) => {
    extensions.addExtension({
      name: 'jupyterlab-pierre-dark:syntax',
      factory: () =>
        EditorExtensionRegistry.createImmutableExtension(pierreSyntaxExtension)
    });
  }
};

export default [theme, editorSyntax];
