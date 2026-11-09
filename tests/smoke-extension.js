// Loaded only by smoke.py in a private headless Shell.
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as MessageTray from 'resource:///org/gnome/shell/ui/messageTray.js';
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import NotificationExtension from './candidate.js';

const assert = (condition, message) => {
    if (!condition)
        throw new Error(message);
};
const delay = ms => new Promise(resolve => GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => {
    resolve();
    return GLib.SOURCE_REMOVE;
}));

export default class Smoke extends Extension {
    enable() {
        this.run().catch(error => console.error(`[Banner Test] FAIL ${error.message}\n${error.stack}`));
    }

    disable() {}

    notification() {
        const source = new MessageTray.Source({title: 'Private notification test'});
        Main.messageTray.add(source);
        const notification = new MessageTray.Notification({source, title: 'Cleanup test',
            body: 'Private test notification', forFeedback: true});
        source.addNotification(notification);
        return notification;
    }

    assertClosed() {
        const tray = Main.messageTray;
        assert(tray._notificationState === MessageTray.State.HIDDEN,
            `Tray did not return to HIDDEN (opacity=${tray._bannerBin.opacity}, mapped=${tray._bannerBin.mapped})`);
        assert(tray._banner === null, 'Stale notification banner remains');
        assert(tray._bannerBin.get_n_children() === 0, 'Banner container retains an actor');
        assert(!tray._bannerBin.mapped, 'Hidden banner still has a mapped input region');
        for (const [x, y] of [[20, 50], [640, 60], [1200, 60]]) {
            const picked = global.stage.get_actor_at_pos(Clutter.PickMode.REACTIVE, x, y);
            assert(picked !== tray._bannerBin && !tray._bannerBin.contains(picked),
                `Invisible banner intercepts input at ${x},${y}`);
        }
    }

    async run() {
        await delay(1500);
        Main.overview.hide();
        await delay(500);
        const pointer = Clutter.get_default_backend().get_default_seat()
            .create_virtual_device(Clutter.InputDeviceType.POINTER_DEVICE);
        pointer.notify_absolute_motion(GLib.get_monotonic_time(), 600, 700);
        const extension = new NotificationExtension(this.metadata);
        const settings = extension.getSettings();
        settings.set_int('anchor-horizontal', 1);
        settings.set_int('padding-vertical', 10);
        settings.set_int('animation-time', 500);
        const tray = Main.messageTray;
        const animationSettings = new Gio.Settings({schema_id: 'org.gnome.desktop.interface'});
        const animations = animationSettings.get_boolean('enable-animations');
        animationSettings.set_boolean('enable-animations', true);
        try {
            // Reproduce GNOME Shell issue 6006: a hide transition is stopped
            // before completion, then the underlying notification disappears.
            for (const direction of [0, 1, 2, 3]) {
                settings.set_int('animation-direction', direction);
                extension.enable();
                const notification = this.notification();
                await delay(700);
                assert(tray._notificationState === MessageTray.State.SHOWN, 'Banner did not show');
                tray._hideNotification(true);
                assert(tray._notificationState === MessageTray.State.HIDING, 'No hide animation to interrupt');
                // Stop movement while allowing the fade to reach opacity 0:
                // the unfixed Shell leaves an invisible, mapped banner behind.
                tray._bannerBin.remove_transition(direction < 2 ? 'x' : 'y');
                await delay(650);
                notification.destroy(MessageTray.NotificationDestroyedReason.DISMISSED);
                await delay(100);
                this.assertClosed();
                extension.disable();
                console.log(`[Banner Test] Interrupted hide direction ${direction}: cleared`);
            }

            extension.enable();
            const first = this.notification();
            await delay(700);
            const second = this.notification();
            assert(tray.queueCount === 1, 'Second notification was not queued');
            tray._hideNotification(true);
            tray._bannerBin.remove_all_transitions();
            await delay(700);
            assert(tray._notification === second, 'Interrupted hide lost the queued notification');
            assert(tray._notificationState === MessageTray.State.SHOWN, 'Queued notification did not show');
            first.destroy(MessageTray.NotificationDestroyedReason.DISMISSED);
            second.destroy(MessageTray.NotificationDestroyedReason.DISMISSED);
            await delay(100);
            this.assertClosed();
            console.log('[Banner Test] Queued notification still delivered');

            const normal = this.notification();
            await delay(700);
            tray._hideNotification(true);
            await delay(700);
            this.assertClosed();
            normal.destroy(MessageTray.NotificationDestroyedReason.DISMISSED);
            console.log('[Banner Test] Uninterrupted hide still completes');

            animationSettings.set_boolean('enable-animations', false);
            const immediate = this.notification();
            await delay(100);
            tray._hideNotification(true);
            await delay(100);
            this.assertClosed();
            immediate.destroy(MessageTray.NotificationDestroyedReason.DISMISSED);
            console.log('[Banner Test] Reduced motion cleans up immediately');
            console.log('[Banner Test] PASS: notification cleanup and input regions');
        } finally {
            extension.disable();
            animationSettings.set_boolean('enable-animations', animations);
        }
    }
}
