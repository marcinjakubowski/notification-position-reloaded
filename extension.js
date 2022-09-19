/* extension.js
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

const { Clutter, Gio, GLib, GObject, Meta, Shell, St } = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Main = imports.ui.main;
const MessageTray = imports.ui.messageTray.MessageTray;
const Utils = Me.imports.utils;
const BannerBin = Main.messageTray._bannerBin;
const { NOTIFICATION_TIMEOUT, HIDE_TIMEOUT, LONGER_HIDE_TIMEOUT, IDLE_TIME, State, Urgency } = imports.ui.messageTray;

let ANIMATION_TIME = 200;
let ANIMATION_DIRECTION = 2;
let ANCHOR_VERTICAL = 0;
let ANCHOR_HORIZONTAL = 2;
let PADDING_VERTICAL = 0;
let PADDING_HORIZONTAL = 0;
let ALWAYS_MINIMIZE = 0;

function patcher(obj, live, method, original, patch) {
    const body = eval(`${obj}.prototype.${method}.toString()`);
    const newBody = body.replace(original, patch).replace(method + "(", "function(")
    eval(`${obj}.prototype.${method} = ${newBody}`);
    eval(`${live}.${method} = ${newBody}`);
}

const getMessageTraySize = () => ({ width, height } = Main.layoutManager.getWorkAreaForMonitor(global.display.get_primary_monitor()));

const originalShow = MessageTray.prototype._showNotification;
const originalHide = MessageTray.prototype._hideNotification;
const originalUpdateShowing = MessageTray.prototype._updateShowingNotification;

function calcTarget(self) {
    let x = 0, y = 0;
    switch (ANCHOR_HORIZONTAL) {
        case 0: // left
            x = 0 + PADDING_HORIZONTAL;
            break;
        case 1: // right
            x = getMessageTraySize().width - self._banner.width - PADDING_HORIZONTAL;
            break;
        case 2: // center
            x = (getMessageTraySize().width - self._banner.width) / 2.0;
            break;
    }
    switch (ANCHOR_VERTICAL) {
        case 0: // top
            y = 0 + PADDING_VERTICAL;
            break;
        case 1: // bottom
            y = getMessageTraySize().height - self._banner.height - PADDING_VERTICAL;
            break;
        case 2: // center
            y = (getMessageTraySize().height - self._banner.height) / 2.0;
            break;
    }
    return { x, y }
}

function calcHide(self) {
    let { x, y } = calcTarget(self)
    switch (ANIMATION_DIRECTION) {
        case 0: // from left
            x = -self._banner.width;
            break;
        case 1: // from right
            x = getMessageTraySize().width;
            break;
        case 2: // from top
            y = -self._banner.height
            break;
        case 3: // from bottom
            y = getMessageTraySize().height
            break;
    }
    return { x, y }
}

function calcStart(self) {
    const { x, y } = calcHide(self);
    self._bannerBin.x = x;
    self._bannerBin.y = y;
    
    
    // if banner is not expanded and anchored to the bottom
    // it won't have enough vertical space to expand
    // in such case, move it up enough to fit the expanded banner
    if (!self._banner.expanded && ANCHOR_VERTICAL == 1) {
        const unexpandedHeight = self._banner.height
        // expand without animation to measure height
        self._banner.expand(false);
        const expandedDifference = self._banner.height - unexpandedHeight;
        // go back to unexpanded
        self._banner.unexpand(false);

        // move up when needed
        self._banner.connect('expanded', () => {
            self._bannerBin.ease({
                y: self._bannerBin.y - expandedDifference,
                duration: ANIMATION_TIME,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            });
        });
    }
}

// each of the methods has hardcoded values for showing banners
// at the top. instead of rewriting whole functions, just patch the 
// relevant lines
const patches = [
    { 
        "obj": "MessageTray", "method": "_updateShowingNotification",
        "live": "Main.messageTray",
        "original": 'y: 0',
        "patch": '...calcTarget(this)'
    },
    { 
        "obj": "MessageTray", "method": "_showNotification",
        "live": "Main.messageTray",
        "original": 'this._bannerBin.y = -this._banner.height',
        "patch": 'calcStart(this)'
    },
    { 
        "obj": "MessageTray", "method": "_hideNotification",
        "live": "Main.messageTray",
        "original": 'y: -this._bannerBin.height',
        "patch": '...calcHide(this)'
    }
];

const always_minimize_patch = {
    obj: "MessageTray",
    live: "Main.messageTray",
    method: "_updateShowingNotification",
    original: "this._expandBanner(true)",
    patch: "// always minimized setting enabled by notification-banner-reloaded ... this._expandBanner(true)",
};

class Extension {
    constructor() {
        this._previous_y_align = BannerBin.get_y_align();
        this._previous_x_align = BannerBin.get_x_align();
    }

    _loadSettings() {
        this._settings = ExtensionUtils.getSettings();
        this._settingsChangedId = this._settings.connect('changed', this._onSettingsChange.bind(this));
        this._fetchSettings();
    }

    _fetchSettings() {
        ANCHOR_VERTICAL         = this._settings.get_int(Utils.PrefFields.ANCHOR_VERTICAL);
        ANCHOR_HORIZONTAL       = this._settings.get_int(Utils.PrefFields.ANCHOR_HORIZONTAL);
        PADDING_VERTICAL        = this._settings.get_int(Utils.PrefFields.PADDING_VERTICAL);
        PADDING_HORIZONTAL      = this._settings.get_int(Utils.PrefFields.PADDING_HORIZONTAL);
        ANIMATION_DIRECTION     = this._settings.get_int(Utils.PrefFields.ANIMATION_DIRECTION);
        ANIMATION_TIME          = this._settings.get_int(Utils.PrefFields.ANIMATION_TIME);
        ALWAYS_MINIMIZE         = this._settings.get_int(Utils.PrefFields.ALWAYS_MINIMIZE);
    }

    _onSettingsChange() {
        this._fetchSettings();
        this.enable();
    }

    enable() {
        this._loadSettings();        
        // generally alignment can be controller with START/CENTER/END
        // but CENTER and END are problematic to implement animations with
        // (especially x -> END and animations from left/right)
        // all positions will then be calculated in relation to the top-left 
        // corner (START/START).
        let x_align = Clutter.ActorAlign.START;
        let y_align = Clutter.ActorAlign.START;
        BannerBin.set_x_align(x_align);
        BannerBin.set_y_align(y_align);
        this.restore();
        for (const { obj, live, method, original, patch } of patches) {
            patcher(obj, live, method, original, patch)
        }

        if (ALWAYS_MINIMIZE) {
            const { obj, live, method, original, patch } = always_minimize_patch;
            patcher(obj, live, method, original, patch);
        }
    }

    disable() {
        BannerBin.set_x_align(this._previous_x_align);
        BannerBin.set_y_align(this._previous_y_align);
        BannerBin.x = 0
        BannerBin.y = 0
        this.restore()
        if (this._settingsChangedId) {
            this._settings.disconnect(this._settingsChangedId);
            this._settingsChangedId = null;
        }
        this._settings = null;

    }

    restore() {
        MessageTray.prototype._hideNotification = originalHide;
        MessageTray.prototype._showNotification = originalShow;
        MessageTray.prototype._updateShowingNotification = originalUpdateShowing;
    }
}

function init() {
    return new Extension();
}

