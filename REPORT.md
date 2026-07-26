# Hide All Windows — Build Report

## What this is
A GNOME Shell extension. Press a shortcut (default `Super+Shift+H`) and
every normal window hides from your screen and the Activities overview.
Press it again and every window comes back exactly as it was — including
which ones were already minimized before you hid them.

## Files
| File | Purpose |
|---|---|
| `metadata.json` | Extension identity, supported shell versions, points to the settings schema |
| `extension.js` | All runtime logic — the keybinding, hide, and restore |
| `prefs.js` | Preferences window — change the shortcut, toggle workspace scope |
| `schemas/org.gnome.shell.extensions.hide-all-windows.gschema.xml` | Defines the two stored settings: the keybinding and the workspace-scope switch |
| `README.md` | Install / publish instructions |

## Design decisions and why

**Minimize + hide the actor, not just one or the other.**
Minimizing alone still leaves a live thumbnail in the overview on some
GNOME versions. Hiding the actor alone can leave windows in a strange
half-state if the extension is disabled mid-hide. Doing both, and
tracking which one was actually needed per window, keeps the visible
result reliable and the restore exact.

**Per-window state keyed by window ID (`Map`), not a flat array.**
Using the window's numeric ID as a key means a repeated shortcut press,
or a window closing mid-hide, can never cause a duplicate or corrupted
entry — every window is touched exactly once.

**`wasMinimized` is recorded per window before hiding.**
If you'd already minimized an app before triggering the shortcut, this
extension won't un-minimize it on restore. Your prior state is respected,
not overwritten.

**Windows closing while hidden are handled, not ignored.**
This was the sharpest edge case: if you hide everything, then close one
of those apps from another window (or it crashes) before you restore,
a naive implementation would later call methods on a destroyed window
object and throw an error. This build listens for each window's
`unmanaging` signal the moment it's hidden, and removes it from the
tracked state immediately if it closes — so restore only ever touches
windows that still exist.

**Zero-window presses are a no-op, not a broken toggle.**
If you hit the shortcut with nothing open, `_hidden` only flips to
`true` if something was actually hidden. Otherwise a second press
wouldn't know whether to hide or restore.

**Disabling the extension always restores first.**
If GNOME disables the extension (update, session issue, you turn it
off manually) while windows are hidden, `disable()` calls the restore
path before removing the keybinding. You will never get stuck with
permanently hidden windows because the extension itself went away.

**Workspace scope is configurable, defaulting to "all workspaces."**
Your original ask was "every single tab," so hiding across all
workspaces is the default. The preferences window lets you narrow that
to just the current workspace if you find the broader behavior too
aggressive in daily use.

**A real preferences UI, not raw dconf.**
Shortcut editing is done through a small dialog that listens for a
keypress and validates it (requires a modifier, rejects invalid
combinations) rather than asking you to hand-write a `gsettings`
command.

## Known limitation (unchanged from before, now documented in-app too)
GNOME does not expose a supported, public way for extensions to strip
a window out of the `Super+Tab` switcher list at runtime. This build
reliably hides windows from your screen and the Activities overview.
On some GNOME versions, a minimized entry may still appear (grayed
out) in Alt+Tab while windows are hidden. This is now called out
directly in the preferences window, not just the README, so it's not
a surprise later.

## What I verified vs. what I could not
Being precise about this rather than just asserting "no mistakes":

**Verified in this sandbox:**
- `extension.js` and `prefs.js` both pass `node --check` (parse cleanly,
  no syntax errors)
- `metadata.json` is valid JSON
- The `.gschema.xml` is well-formed XML
- Every code path was traced by hand against GNOME's documented
  `Meta.Window`, `St`/Clutter actor, and `Gio.Settings` APIs, including
  the closed-window-while-hidden case above

**Not verified (no GNOME session available in this sandbox — no display
server, no `gnome-shell` process to load an extension into):**
- Actually running it and pressing the shortcut
- Real behavior across multi-monitor setups
- Real behavior on Wayland vs. X11 session differences
- The exact Alt+Tab behavior on your specific GNOME 50 build

Given that gap, please run the manual checklist below yourself before
trusting this daily — it's short.

## Manual test checklist (~2 minutes)
1. Install per the README, enable the extension.
2. Open 3–4 different app windows.
3. Press `Super+Shift+H` — all windows should disappear from screen and
   from the Activities overview.
4. Press `Super+Shift+H` again — all windows should return, and any
   window you had minimized *before* step 3 should still be minimized.
5. Open Settings → open the extension's preferences → change the
   shortcut to something else, confirm the new one works.
6. Hide all windows, then close one of the hidden apps via a terminal
   (`pkill` or similar) — press the shortcut again and confirm no error
   appears in `journalctl --user -f _COMM=gnome-shell` and the
   remaining windows restore fine.
7. Disable the extension from the Extensions app while windows are
   hidden — confirm they come back automatically.

If any of these don't behave as described, that's the exact edge case
worth telling me about so I can fix it precisely rather than guess.

## Publishing to extensions.gnome.org
Same as before:
1. Create an account at https://extensions.gnome.org.
2. Zip the **contents** of the extension folder (not the folder itself
   — `metadata.json` must sit at the zip root):
   ```bash
   cd hide-all-windows@shakeel.dev
   zip -r ../hide-all-windows.zip .
   ```
3. Upload via "Upload Extension," fill in description and a screenshot,
   submit for review.
4. Manual review typically takes a day to a couple of weeks.
5. Before submitting, change the UUID's domain suffix
   (`@shakeel.dev`) to something you actually own — a domain or your
   GitHub username — since the UUID just needs to be unique on the site.
