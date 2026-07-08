import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import Gdk from 'gi://Gdk';
import Pango from 'gi://Pango';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class PlacesExplorerPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings('org.gnome.shell.extensions.files-dropdown');
        const page = new Adw.PreferencesPage();
        window.add(page);

        const createPreciseSliderRow = (title, subtitle, prop, min, max) => {
            const row = new Adw.ActionRow({ title, subtitle });
            const adjustment = new Gtk.Adjustment({ lower: min, upper: max, step_increment: 1 });
            settings.bind(prop, adjustment, 'value', Gio.SettingsBindFlags.DEFAULT);

            const scale = new Gtk.Scale({ orientation: Gtk.Orientation.HORIZONTAL, adjustment: adjustment, hexpand: true, draw_value: false, margin_end: 12, valign: Gtk.Align.CENTER });
            const spin = new Gtk.SpinButton({ adjustment: adjustment, numeric: true, valign: Gtk.Align.CENTER });

            const box = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL });
            box.set_size_request(280, -1); box.append(scale); box.append(spin);
            row.add_suffix(box);
            return row;
        };

        const createEntryRow = (title, subtitle, prop) => {
            const row = new Adw.ActionRow({ title, subtitle });
            const entry = new Gtk.Entry({ valign: Gtk.Align.CENTER, text: settings.get_string(prop) });
            entry.set_size_request(200, -1);
            entry.connect('changed', () => settings.set_string(prop, entry.get_text()));
            row.add_suffix(entry); return row;
        };
        
        const createSwitchRow = (title, subtitle, prop) => {
            const row = new Adw.SwitchRow({ title, subtitle });
            settings.bind(prop, row, 'active', Gio.SettingsBindFlags.DEFAULT);
            return row;
        };

        const createComboRow = (title, subtitle, prop, dict) => {
            const keys = Object.keys(dict); const values = Object.values(dict);
            const row = new Adw.ComboRow({ title, subtitle, model: Gtk.StringList.new(values) });
            let idx = keys.indexOf(settings.get_string(prop));
            if (idx !== -1) row.set_selected(idx);
            row.connect('notify::selected', () => settings.set_string(prop, keys[row.get_selected()]));
            return row;
        };

        const createColorRow = (title, subtitle, prop) => {
            const row = new Adw.ActionRow({ title, subtitle });
            const colorBtn = new Gtk.ColorDialogButton({ dialog: new Gtk.ColorDialog({ with_alpha: true }), valign: Gtk.Align.CENTER });
            try { let rgba = new Gdk.RGBA(); rgba.parse(settings.get_string(prop)); colorBtn.set_rgba(rgba); } catch (e) {}
            colorBtn.connect('notify::rgba', () => settings.set_string(prop, colorBtn.get_rgba().to_string()));
            row.add_suffix(colorBtn); return row;
        };

        // NATIVE GNOME FONT DIALOG
        const createFontPickerRow = (title, subtitle, prop) => {
            const row = new Adw.ActionRow({ title, subtitle });
            const fontBtn = new Gtk.FontDialogButton({ dialog: new Gtk.FontDialog(), valign: Gtk.Align.CENTER });
            try { fontBtn.set_font_desc(Pango.FontDescription.from_string(settings.get_string(prop) + ' 12')); } catch (e) {}
            fontBtn.connect('notify::font-desc', () => {
                let desc = fontBtn.get_font_desc();
                if (desc && desc.get_family()) settings.set_string(prop, desc.get_family());
            });
            row.add_suffix(fontBtn); return row;
        };

        // --- System Group ---
        const sysGroup = new Adw.PreferencesGroup();
        const resetBtn = new Gtk.Button({ label: 'Restore All Settings to Defaults', css_classes: ['destructive-action'], halign: Gtk.Align.CENTER, margin_top: 12, margin_bottom: 12 });
        resetBtn.connect('clicked', () => { for (let key of settings.list_keys()) settings.reset(key); window.close(); });
        sysGroup.add(resetBtn); page.add(sysGroup);

        // --- Workspace & Reset ---
        const editGroup = new Adw.PreferencesGroup({ title: 'Workspace & Behavior' });
        editGroup.add(createSwitchRow('Edit Mode (Pin Menu Open)', 'Forces menu to stay open while editing settings.', 'keep-open'));
        editGroup.add(createPreciseSliderRow('Hover Open Delay (ms)', 'Time before a sub-folder opens.', 'open-delay', 0, 1000));
        editGroup.add(createPreciseSliderRow('Auto-Close Delay (ms)', 'Time before menu closes when mouse leaves.', 'close-delay', 0, 2000));
        editGroup.add(createPreciseSliderRow('Animation Duration (ms)', 'Controls the speed of all hover color fades.', 'transition-duration', 0, 1000));
        page.add(editGroup);

        // --- Top Panel Button ---
        const panelGroup = new Adw.PreferencesGroup({ title: 'Top Panel Button' });
        panelGroup.add(createSwitchRow('Show Panel Icon', 'Display folder icon on top bar.', 'panel-show-icon'));
        panelGroup.add(createPreciseSliderRow('Panel Icon Size', 'Size of icon on top bar.', 'panel-icon-size', 8, 48));
        panelGroup.add(createColorRow('Panel Icon Color', 'Color of the top bar icon.', 'panel-icon-color'));
        panelGroup.add(createSwitchRow('Show Panel Text', 'Display text on top bar.', 'panel-show-text'));
        panelGroup.add(createEntryRow('Panel Text Label', 'The text shown.', 'panel-text'));
        panelGroup.add(createColorRow('Panel Text Color', 'Color of the top bar text.', 'panel-text-color'));
        page.add(panelGroup);

        // --- Dimensions & Offsets ---
        const dimGroup = new Adw.PreferencesGroup({ title: 'Menu Dimensions & Positioning' });
        dimGroup.add(createComboRow('Width Mode', 'How the menu calculates width.', 'menu-width-mode', {'auto':'Auto (Fit Content)', 'fixed':'Fixed Width', 'max':'Auto with Max Cap'}));
        dimGroup.add(createPreciseSliderRow('Width Value (px)', 'Applied if mode is Fixed or Max.', 'menu-width-value', 100, 1000));
        dimGroup.add(createComboRow('Height Mode', 'How the menu calculates height.', 'menu-height-mode', {'auto':'Auto (Fit Content)', 'fixed':'Fixed Height', 'max':'Auto with Max Cap'}));
        dimGroup.add(createPreciseSliderRow('Height Value (px)', 'Applied if mode is Fixed or Max.', 'menu-height-value', 100, 1500));
        
        dimGroup.add(createComboRow('Submenu Open Direction', 'Which side the folders pop out from.', 'submenu-direction', {'auto':'Auto (Smart fit)', 'force-right':'Force Right', 'force-left':'Force Left'}));
        dimGroup.add(createPreciseSliderRow('Root X Offset (px)', 'Nudge the main menu horizontally.', 'root-x-offset', -500, 500));
        dimGroup.add(createPreciseSliderRow('Root Y Offset (px)', 'Nudge the main menu vertically.', 'root-y-offset', -500, 500));
        dimGroup.add(createPreciseSliderRow('Child X Offset (px)', 'Distance stretching outward from outer edge of parent box.', 'child-x-offset', -200, 200));
        dimGroup.add(createPreciseSliderRow('Child Y Offset (px)', 'Vertical shift relative to hovered item.', 'child-y-offset', -200, 200));
        dimGroup.add(createComboRow('Scrollbar Visibility', 'When to show the scrollbar.', 'scrollbar-policy', {'auto':'Automatic', 'always':'Always', 'never':'Never'}));
        page.add(dimGroup);

        // --- Menu Container Styling ---
        const boxGroup = new Adw.PreferencesGroup({ title: 'Menu Container Box Styling' });
        boxGroup.add(createColorRow('Background Color', 'Background of the floating menus.', 'menu-bg-color'));
        boxGroup.add(createColorRow('Border Color', 'Outer line color.', 'menu-border-color'));
        boxGroup.add(createPreciseSliderRow('Border Width', 'Outer line thickness.', 'menu-border-width', 0, 20));
        boxGroup.add(createPreciseSliderRow('Border Radius', 'Corner roundness.', 'menu-border-radius', 0, 50));
        boxGroup.add(createPreciseSliderRow('Top Padding', 'Inner space top.', 'menu-pad-top', 0, 100));
        boxGroup.add(createPreciseSliderRow('Bottom Padding', 'Inner space bottom.', 'menu-pad-bottom', 0, 100));
        boxGroup.add(createPreciseSliderRow('Left Padding', 'Inner space left.', 'menu-pad-left', 0, 100));
        boxGroup.add(createPreciseSliderRow('Right Padding', 'Inner space right.', 'menu-pad-right', 0, 100));
        boxGroup.add(createSwitchRow('Drop Shadow', 'Render box shadow.', 'menu-shadow'));
        page.add(boxGroup);

        // --- Menu Items Styling ---
        const itemGroup = new Adw.PreferencesGroup({ title: 'Menu Items (Folders & Files)' });
        itemGroup.add(createComboRow('Text Alignment', 'Align item text.', 'item-text-align', {'left':'Left', 'center':'Center', 'right':'Right'}));
        itemGroup.add(createPreciseSliderRow('Top Padding', 'Inner space above text.', 'item-pad-top', 0, 50));
        itemGroup.add(createPreciseSliderRow('Bottom Padding', 'Inner space below text.', 'item-pad-bottom', 0, 50));
        itemGroup.add(createPreciseSliderRow('Left Padding', 'Inner space left of text.', 'item-pad-left', 0, 50));
        itemGroup.add(createPreciseSliderRow('Right Padding', 'Inner space right of text.', 'item-pad-right', 0, 50));
        itemGroup.add(createPreciseSliderRow('Vertical Margin', 'Gap between items.', 'item-mar-v', 0, 50));
        itemGroup.add(createPreciseSliderRow('Horizontal Margin', 'Gap from the edge.', 'item-mar-h', 0, 50));
        itemGroup.add(createPreciseSliderRow('Border Radius', 'Highlight roundness.', 'item-radius', 0, 50));
        itemGroup.add(createPreciseSliderRow('Item Border Width', 'Individual item border.', 'item-border-width', 0, 10));
        itemGroup.add(createColorRow('Item Border Color', 'Individual item border color.', 'item-border-color'));
        page.add(itemGroup);
        
        // --- Icons & Arrows ---
        const visGroup = new Adw.PreferencesGroup({ title: 'Icons & Arrows' });
        visGroup.add(createSwitchRow('Show Icons', 'Show file/folder icons.', 'show-icons'));
        visGroup.add(createPreciseSliderRow('Icon Size', 'Size of icons.', 'item-icon-size', 8, 64));
        visGroup.add(createPreciseSliderRow('Icon Gap', 'Space between icon and text.', 'item-icon-gap', 0, 50));
        visGroup.add(createSwitchRow('Show Arrows', 'Show > arrow.', 'show-arrows'));
        visGroup.add(createPreciseSliderRow('Arrow Size', 'Size of arrow.', 'item-arrow-size', 8, 64));
        visGroup.add(createPreciseSliderRow('Arrow Gap', 'Space before arrow.', 'item-arrow-gap', 0, 50));
        page.add(visGroup);

        // --- Typography ---
        const typeGroup = new Adw.PreferencesGroup({ title: 'Typography' });
        typeGroup.add(createFontPickerRow('Font Family', 'Click to open Native GNOME font dialog.', 'font-family'));
        typeGroup.add(createPreciseSliderRow('Font Size', 'Text size.', 'font-size', 8, 32));
        typeGroup.add(createComboRow('Font Weight', 'Text thickness.', 'font-weight', {'normal':'Normal', 'bold':'Bold', '100':'Thin 100', '300':'Light 300', '500':'Medium 500', '700':'Bold 700', '900':'Heavy 900'}));
        page.add(typeGroup);

        // --- Colors & States ---
        const stateGroup = new Adw.PreferencesGroup({ title: 'Colors & Interaction States' });
        stateGroup.add(createColorRow('Normal Background Color', '', 'color-normal-bg'));
        stateGroup.add(createColorRow('Normal Text Color', '', 'color-normal-text'));
        stateGroup.add(createColorRow('Hover Background Color', '', 'color-hover-bg'));
        stateGroup.add(createColorRow('Hover Text Color', '', 'color-hover-text'));
        stateGroup.add(createColorRow('Active Parent Background', '', 'color-active-bg'));
        stateGroup.add(createColorRow('Active Parent Text', '', 'color-active-text'));
        stateGroup.add(createEntryRow('Empty Folder Text', '', 'empty-text'));
        stateGroup.add(createColorRow('Empty Folder Text Color', '', 'color-empty-text'));
        page.add(stateGroup);
    }
}
