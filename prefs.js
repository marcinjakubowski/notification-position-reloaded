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
const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;
const Gio = imports.gi.Gio;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Utils = Me.imports.utils;

const Gettext = imports.gettext;
const _ = Gettext.domain('notification-banner-reloaded').gettext;

// API change 3 -> 4
function addBox(box, child) {
    if (imports.gi.versions.Gtk.startsWith("3")) {
        box.add(child);
    }
    else {
        box.append(child);
    }
}

function init() {
    let localeDir = Me.dir.get_child('locale');
    if (localeDir.query_exists(null))
        Gettext.bindtextdomain('notification-banner-reloaded', localeDir.get_path());
}

class Preferences {
    constructor() {
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

        const settings = ExtensionUtils.getSettings();
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

function buildPrefsWidget() {
    let frame = new Gtk.Box();
    let widget = new Preferences();
    addBox(frame, widget.main);
    if (frame.show_all)
	    frame.show_all();
    return frame;
}

