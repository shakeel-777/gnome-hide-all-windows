import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';
import Gio from 'gi://Gio';

import { ExtensionPreferences } from 'resource:///org/gnome/shell/extensions/prefs.js';

const SETTINGS_KEY = 'toggle-hide-windows';

const MODIFIER_KEYVALS = new Set([
    Gtk.KEY_Shift_L, Gtk.KEY_Shift_R,
    Gtk.KEY_Control_L, Gtk.KEY_Control_R,
    Gtk.KEY_Alt_L, Gtk.KEY_Alt_R,
    Gtk.KEY_Super_L, Gtk.KEY_Super_R,
    Gtk.KEY_Meta_L, Gtk.KEY_Meta_R,
    Gtk.KEY_ISO_Level3_Shift,
]);

export default class HideAllWindowsPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const page = new Adw.PreferencesPage();
        window.add(page);

        // --- Shortcut group ---
        const shortcutGroup = new Adw.PreferencesGroup({
            title: 'Shortcut',
            description: 'Choose the key combination that hides and restores every window.',
        });
        page.add(shortcutGroup);

        const shortcutRow = new Adw.ActionRow({ title: 'Toggle hide all windows' });
        shortcutGroup.add(shortcutRow);

        const shortcutLabel = new Gtk.ShortcutLabel({
            valign: Gtk.Align.CENTER,
            disabled_text: 'Not set',
        });
        this._syncShortcutLabel(settings, shortcutLabel);
        shortcutRow.add_suffix(shortcutLabel);

        const editButton = new Gtk.Button({
            label: 'Edit',
            valign: Gtk.Align.CENTER,
            css_classes: ['flat'],
        });
        shortcutRow.add_suffix(editButton);
        shortcutRow.set_activatable_widget(editButton);

        editButton.connect('clicked', () => {
            this._openShortcutDialog(window, settings, shortcutLabel);
        });

        // --- Behavior group ---
        const behaviorGroup = new Adw.PreferencesGroup({ title: 'Behavior' });
        page.add(behaviorGroup);

        const workspaceRow = new Adw.SwitchRow({
            title: 'Only affect the current workspace',
            subtitle: 'Off hides every window on every workspace. On limits it to the workspace you\u2019re currently viewing.',
        });
        settings.bind('current-workspace-only', workspaceRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        behaviorGroup.add(workspaceRow);

        // --- Known limitations note ---
        const noteGroup = new Adw.PreferencesGroup({ title: 'Good to know' });
        page.add(noteGroup);

        const noteRow = new Adw.ActionRow({
            title: 'Alt+Tab may still show hidden windows',
            subtitle: 'GNOME doesn\u2019t give extensions a supported way to remove windows from the Alt+Tab switcher at runtime. Hiding from your screen and the Activities overview is fully reliable; the switcher entry may occasionally remain, minimized.',
        });
        noteGroup.add(noteRow);
    }

    _syncShortcutLabel(settings, label) {
        const [accel] = settings.get_strv(SETTINGS_KEY);
        label.set_accelerator(accel ?? '');
    }

    _openShortcutDialog(parentWindow, settings, shortcutLabel) {
        const dialog = new Gtk.Window({
            title: 'Set Shortcut',
            transient_for: parentWindow,
            modal: true,
            default_width: 340,
            default_height: 130,
        });

        const box = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 12,
            margin_top: 24,
            margin_bottom: 24,
            margin_start: 24,
            margin_end: 24,
        });
        dialog.set_child(box);

        const hint = new Gtk.Label({
            label: 'Press a new key combination\u2026',
            wrap: true,
        });
        box.append(hint);

        const cancelButton = new Gtk.Button({ label: 'Cancel', halign: Gtk.Align.END });
        cancelButton.connect('clicked', () => dialog.close());
        box.append(cancelButton);

        const controller = new Gtk.EventControllerKey();
        dialog.add_controller(controller);

        controller.connect('key-pressed', (_ctrl, keyval, _keycode, state) => {
            if (keyval === Gtk.KEY_Escape) {
                dialog.close();
                return true;
            }

            // Ignore the modifier-only keypress itself; wait for the
            // full combination (modifier held + real key).
            if (MODIFIER_KEYVALS.has(keyval))
                return true;

            const mask = state & Gtk.accelerator_get_default_mod_mask();

            if (mask === 0) {
                hint.set_label('Include at least one modifier key (Super, Ctrl, Alt\u2026) so this doesn\u2019t clash with normal typing.');
                return true;
            }

            const accel = Gtk.accelerator_name(keyval, mask);
            if (!accel || !Gtk.accelerator_valid(keyval, mask)) {
                hint.set_label('That combination can\u2019t be used as a shortcut. Try another.');
                return true;
            }

            settings.set_strv(SETTINGS_KEY, [accel]);
            this._syncShortcutLabel(settings, shortcutLabel);
            dialog.close();
            return true;
        });

        dialog.present();
    }
}
