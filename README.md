# notification-position-reloaded
Gnome Shell extension allowing customization of notification banner position and animation properties

# recompile schema if adding additional options
```glib-compile-schemas schemas```

# notification cleanup regression test

`python3 tests/smoke.py` runs in an isolated GNOME Shell 46 headless session;
it does not change the running desktop or its settings. Requires GNOME Shell,
GJS, `dbus-run-session`, and `glib-compile-schemas`.

The test interrupts banner hide animations in all four directions, checks that
no invisible input region remains, and verifies queued notifications, normal
completion, and reduced motion. It covers the cleanup race fixed upstream in
[GNOME Shell 93a79cf](https://github.com/GNOME/gnome-shell/commit/93a79cf61b2b404357e6f637cc9e7f324fb27a69).
The extension applies that fix to older Shell versions through its existing
notification method patches; versions that already include it are unchanged.
