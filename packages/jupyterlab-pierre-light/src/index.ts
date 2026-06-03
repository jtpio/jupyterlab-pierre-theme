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
 * The Pierre Light theme.
 */
const theme: JupyterFrontEndPlugin<void> = {
  id: 'jupyterlab-pierre-light:plugin',
  description: 'JupyterLab light theme matching the Pierre palette',
  autoStart: true,
  requires: [IThemeManager],
  activate: (app: JupyterFrontEnd, manager: IThemeManager) => {
    const style = 'jupyterlab-pierre-light/index.css';

    manager.register({
      name: 'Pierre Light',
      isLight: true,
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
  id: 'jupyterlab-pierre-light:editor-syntax',
  description: 'Pierre syntax colors for the JupyterLab CodeMirror editor',
  autoStart: true,
  requires: [IEditorExtensionRegistry],
  activate: (app: JupyterFrontEnd, extensions: IEditorExtensionRegistry) => {
    extensions.addExtension({
      name: 'jupyterlab-pierre-light:syntax',
      factory: () =>
        EditorExtensionRegistry.createImmutableExtension(pierreSyntaxExtension)
    });
  }
};

export default [theme, editorSyntax];
