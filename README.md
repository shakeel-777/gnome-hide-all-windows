# Hide All Windows

Press `Super+Shift+H` to instantly hide every open window — from your
screen and the Activities overview. Press it again to bring everything
back exactly where it was.

See `REPORT.md` in this folder for the full design write-up, edge
cases handled, and a manual test checklist.

## Install locally

```bash
# 1. Copy the extension into GNOME's extensions folder
mkdir -p ~/.local/share/gnome-shell/extensions
cp -r hide-all-windows@shakeel.dev ~/.local/share/gnome-shell/extensions/

# 2. Compile the settings schema (required for the keybinding to work)
glib-compile-schemas ~/.local/share/gnome-shell/extensions/hide-all-windows@shakeel.dev/schemas/

# 3. Reload GNOME Shell
#    X11: Alt+F2, type 'r', press Enter
#    Wayland: log out and back in (Shell can't reload live)

# 4. Enable it
gnome-extensions enable hide-all-windows@shakeel.dev
```

Press `Super+Shift+H` anywhere. Press it again to restore.

## Change the shortcut or workspace scope

```bash
gnome-extensions prefs hide-all-windows@shakeel.dev
```
This opens a proper preferences window — click "Edit" next to the
shortcut and press your new combination, or flip the "current
workspace only" switch.

## Known limitation
GNOME doesn't expose a public API for extensions to remove windows
from the `Super+Tab` switcher at runtime. Hiding from your screen and
the Activities overview is fully reliable; on some GNOME versions a
minimized entry may still appear in Alt+Tab. Details in `REPORT.md`.

## Publishing to extensions.gnome.org
1. Create an account at https://extensions.gnome.org.
2. Zip the **contents** of this folder (metadata.json at the zip root):
   ```bash
   cd hide-all-windows@shakeel.dev
   zip -r ../hide-all-windows.zip .
   ```
3. Upload via "Upload Extension," add a description and screenshot,
   submit for review (typically a day to a couple weeks).
4. Before submitting, change the UUID domain (`@shakeel.dev`) to
   something you actually own.
