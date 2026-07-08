import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { PlacesExplorerIndicator } from './indicator.js';

export default class PlacesExplorerExtension extends Extension {
    enable() {
        // EGO-X-006 Fix: Grab settings directly from the Extension object 
        // rather than using lookupByURL in indicator.js
        const settings = this.getSettings('org.gnome.shell.extensions.files-dropdown');

        // Instantiate our custom panel button
        this._indicator = new PlacesExplorerIndicator(settings);
        
        // Add it to the panel. Dash to Panel will automatically scoop this up.
        Main.panel.addToStatusArea('files-dropdown-indicator', this._indicator, 0, 'left');
    }

    disable() {
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
    }
}
