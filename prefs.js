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

/* 
    Swaths of pref related code borrowed from Clipboard Indicator, an amazing extension
    https://github.com/Tudmotu/gnome-shell-extension-clipboard-indicator
    https://extensions.gnome.org/extension/779/clipboard-indicator/
*/
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import * as Utils from './utils.js';

import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class NotificationExtensionPreferences extends ExtensionPreferences {
    constructor(metadata) {
        super(metadata);
    }

    getPreferencesWidget() {
        let frame = new Gtk.Box();
        let widget = new Preferences(this.getSettings());
        frame.append(widget.main);
        if (frame.show_all)
            frame.show_all();
        return frame;
    }
}

class Preferences{
    constructor(settings) {
        this.settings = settings
        this.main = new Gtk.Grid({
            margin_top: 10,
            margin_bottom: 10,
            margin_start: 10,
            margin_end: 10,
            row_spacing: 12,
            column_spacing: 18,
            column_homogeneous: false,
            row_homogeneous: false
        });

        this.paddingHorizontal = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower: 0,
                upper: 1000,
                step_increment: 1
            })
        });
        this.paddingVertical = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower: 0,
                upper: 1000,
                step_increment: 1
            })
        });
        this.animationTime = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower: 100,
                upper: 5000,
                step_increment: 100
            })
        });
        this.anchorHorizontal = new Gtk.ComboBox({
            model: this._create_options([ _('Left'), _('Right'), _('Center') ])
        });
        this.anchorVertical = new Gtk.ComboBox({
            model: this._create_options([ _('Top'), _('Bottom'), _('Center') ])
        });
        this.animationDirection = new Gtk.ComboBox({
            model: this._create_options([ _('Slide from Left'), _('Slide from Right'), _('Slide from Top'), _('Slide from Bottom')])
        });
        this.alwaysMinimize = new Gtk.ComboBox({
          model: this._create_options([ _('false'), _('true')])
        });
        this.testButton = new Gtk.Button({ label: _("Test") });
        this.testButton.connect('clicked', () => {
            const notification = new GLib.Variant('(susssasa{sv}i)', [
                'Notification Banner Reloaded',
                0,
                'dialog-information-symbolic',
                'Notification Banner Reloaded',
                'Test',
                [],
                {},
                -1,
            ]);
            Gio.DBus.session.call(
                'org.freedesktop.Notifications',
                '/org/freedesktop/Notifications',
                'org.freedesktop.Notifications',
                'Notify',
                notification,
                null,
                Gio.DBusCallFlags.NONE,
                -1,
                null,
                null);
        });

        let rendererText = new Gtk.CellRendererText();
        for (const widget of [this.anchorHorizontal, this.anchorVertical, this.animationDirection, this.alwaysMinimize]) {
            widget.pack_start(rendererText, false);
            widget.add_attribute(rendererText, "text", 0);
        }
        
        let anchorHorizontalLabel = new Gtk.Label({
            label: _("Horizontal Position"),
            hexpand: true,
            halign: Gtk.Align.START
        });
        let anchorVerticalLabel = new Gtk.Label({
            label: _("Vertical Position"),
            hexpand: true,
            halign: Gtk.Align.START
        });
        let paddingHorizontalLabel  = new Gtk.Label({
            label: _("Horizontal Padding"),
            hexpand: true,
            halign: Gtk.Align.START
        });
        let paddingVerticalLabel  = new Gtk.Label({
            label: _("Vertical Padding"),
            hexpand: true,
            halign: Gtk.Align.START
        });
        let animationDirectionLabel  = new Gtk.Label({
            label: _("Animation Direction"),
            hexpand: true,
            halign: Gtk.Align.START
        });
        let animationTimeLabel  = new Gtk.Label({
            label: _("Animation Time (ms)"),
            hexpand: true,
            halign: Gtk.Align.START
        });
        let alwaysMinimizeLabel  = new Gtk.Label({
          label: _("Always Minimize"),
          hexpand: true,
          halign: Gtk.Align.START
        });

        const testButtonLabel = new Gtk.Label({
            label: _("Send Test Notification"),
            hexpand: true,
            halign: Gtk.Align.START
        });

        const addRow = ((main) => {
            let row = 0;
            return (label, input) => {
                let inputWidget = input;

                if (input instanceof Gtk.Switch) {
                    inputWidget = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL,});
                    addBox(inputWidget, input);
                }

                if (label) {
                    main.attach(label, 0, row, 1, 1);
                    main.attach(inputWidget, 1, row, 1, 1);
                }
                else {
                    main.attach(inputWidget, 0, row, 2, 1);
                }

                row++;
            };
        })(this.main);

        addRow(anchorHorizontalLabel,     this.anchorHorizontal);
        addRow(anchorVerticalLabel,       this.anchorVertical);
        addRow(paddingHorizontalLabel,    this.paddingHorizontal);
        addRow(paddingVerticalLabel,      this.paddingVertical);
        addRow(animationDirectionLabel,   this.animationDirection);
        addRow(animationTimeLabel,        this.animationTime);
        addRow(alwaysMinimizeLabel,       this.alwaysMinimize);
        addRow(testButtonLabel,           this.testButton);

        settings.bind(Utils.PrefFields.ANCHOR_HORIZONTAL,   this.anchorHorizontal,      'active', Gio.SettingsBindFlags.DEFAULT);
        settings.bind(Utils.PrefFields.ANCHOR_VERTICAL,     this.anchorVertical,        'active', Gio.SettingsBindFlags.DEFAULT);
        settings.bind(Utils.PrefFields.PADDING_HORIZONTAL,  this.paddingHorizontal,     'value',  Gio.SettingsBindFlags.DEFAULT);
        settings.bind(Utils.PrefFields.PADDING_VERTICAL,    this.paddingVertical,       'value',  Gio.SettingsBindFlags.DEFAULT);
        settings.bind(Utils.PrefFields.ANIMATION_DIRECTION, this.animationDirection,    'active', Gio.SettingsBindFlags.DEFAULT);
        settings.bind(Utils.PrefFields.ANIMATION_TIME,      this.animationTime,         'value',  Gio.SettingsBindFlags.DEFAULT);
        settings.bind(Utils.PrefFields.ALWAYS_MINIMIZE,     this.alwaysMinimize,        'active', Gio.SettingsBindFlags.DEFAULT);
    }

    _create_options(opts) {
        let options = opts.map(function (v) { return { name: v }});
        let liststore = new Gtk.ListStore();
        liststore.set_column_types([GObject.TYPE_STRING])
        for (let i = 0; i < options.length; i++ ) {
            let option = options[i];
            let iter = liststore.append();
            liststore.set (iter, [0], [option.name]);
        }
        return liststore;
    }
};
