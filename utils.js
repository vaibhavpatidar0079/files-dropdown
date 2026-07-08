import GLib from 'gi://GLib';

export class TimeoutManager {
    constructor() {
        this._timeoutId = null;
    }

    set(callback, ms) {
        this.clear();
        this._timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => {
            callback();
            this._timeoutId = null;
            return GLib.SOURCE_REMOVE;
        });
    }

    clear() {
        if (this._timeoutId) {
            GLib.source_remove(this._timeoutId);
            this._timeoutId = null;
        }
    }
}
