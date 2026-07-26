import Meta from 'gi://Meta';
import Shell from 'gi://Shell';

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { Workspace } from 'resource:///org/gnome/shell/ui/workspace.js';

const KEYBINDING_NAME = 'toggle-hide-windows';

export default class HideAllWindowsExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._hidden = false;

        // windowId -> { window, wasMinimized, unmanagingSignalId }
        this._hiddenState = new Map();

        // The Activities Overview grid decides what to show via
        // Workspace._isOverviewWindow(), independently of actor visibility.
        // Since GNOME 40 that method also includes minimized windows, so
        // actor.hide() alone is not enough — we must patch the filter too.
        const hiddenState = this._hiddenState;
        const originalIsOverviewWindow = Workspace.prototype._isOverviewWindow;
        this._originalIsOverviewWindow = originalIsOverviewWindow;
        Workspace.prototype._isOverviewWindow = function (win) {
            if (hiddenState.has(win.get_id()))
                return false;
            return originalIsOverviewWindow.call(this, win);
        };

        Main.wm.addKeybinding(
            KEYBINDING_NAME,
            this._settings,
            Meta.KeyBindingFlags.NONE,
            Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
            this._toggle.bind(this)
        );
    }

    disable() {
        // Never leave the user with permanently hidden windows if the
        // extension gets disabled (updates, crashes, manual toggle-off).
        if (this._hidden)
            this._restoreAll();

        Main.wm.removeKeybinding(KEYBINDING_NAME);

        // Restore the original prototype method so no other code is affected.
        if (this._originalIsOverviewWindow) {
            Workspace.prototype._isOverviewWindow = this._originalIsOverviewWindow;
            this._originalIsOverviewWindow = null;
        }

        this._settings = null;
        this._hiddenState = null;
    }

    _toggle() {
        // _isOverviewWindow is evaluated when the Workspace widget builds its
        // window list, not live while the Overview is displayed. Closing it
        // first ensures the next open always reflects the correct state.
        Main.overview.hide();

        if (this._hidden)
            this._restoreAll();
        else
            this._hideAll();
    }

    _getCandidateWindows() {
        const onlyCurrentWorkspace = this._settings.get_boolean('current-workspace-only');
        const activeWorkspace = global.workspace_manager.get_active_workspace();

        return global.get_window_actors()
            .map(actor => actor.meta_window)
            .filter(win => win && win.get_window_type() === Meta.WindowType.NORMAL)
            .filter(win => !onlyCurrentWorkspace || win.get_workspace() === activeWorkspace);
    }

    _hideAll() {
        const windows = this._getCandidateWindows();

        for (const win of windows) {
            const id = win.get_id();

            // Guard against double-processing the same window if _hideAll
            // were ever re-entered (defensive, shouldn't happen via the
            // keybinding path, but cheap to protect against).
            if (this._hiddenState.has(id))
                continue;

            const wasMinimized = win.minimized;

            // If the window closes while it's hidden, drop our reference so
            // _restoreAll never touches a destroyed window. Also reset _hidden
            // if the map empties entirely — otherwise the toggle gets stuck.
            const unmanagingSignalId = win.connect('unmanaging', () => {
                this._hiddenState.delete(id);
                if (this._hiddenState.size === 0)
                    this._hidden = false;
            });

            this._hiddenState.set(id, { window: win, wasMinimized, unmanagingSignalId });

            if (!wasMinimized)
                win.minimize();

            const actor = win.get_compositor_private();
            if (actor)
                actor.hide();
        }

        // Only flip to "hidden" state if we actually hid something.
        // Pressing the shortcut with zero windows open is a no-op, not
        // a broken toggle.
        this._hidden = this._hiddenState.size > 0;
    }

    _restoreAll() {
        for (const entry of this._hiddenState.values()) {
            const { window: win, wasMinimized, unmanagingSignalId } = entry;

            win.disconnect(unmanagingSignalId);

            const actor = win.get_compositor_private();
            if (actor)
                actor.show();

            if (!wasMinimized)
                win.unminimize();
        }

        this._hiddenState.clear();
        this._hidden = false;
    }
}
