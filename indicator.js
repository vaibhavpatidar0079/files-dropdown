import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';
import St from 'gi://St';
import GLib from 'gi://GLib';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { listDirectory, openFile, getBookmarks, openWithChooser } from './files.js';
import { TimeoutManager } from './utils.js';

export class FloatingMenu {
    constructor(indicator, depth) {
        this.depth = depth;
        
        this.actor = new St.BoxLayout({
            vertical: true,
            reactive: true,
            style_class: 'cascading-menu-custom-wrapper'
        });

        this.scrollView = new St.ScrollView({
            reactive: true,
            x_expand: true,
            y_expand: true 
        });
        
        this.box = new St.BoxLayout({
            vertical: true,
            reactive: true,
            x_expand: true,
            // ULTIMATE SQUISH FIX: Forbids the ScrollView from compressing the items within
            y_expand: false 
        });
        
        this.scrollView.add_child(this.box);
        this.actor.add_child(this.scrollView);
        
        this.actor.hide();
        this.isOpen = false;

        if (indicator) {
            this.actor.connect('enter-event', () => {
                indicator.currentMenuDepth = this.depth;
                indicator.cancelAutoClose();
                indicator.syncAllActiveStates();
            });
            this.actor.connect('leave-event', () => {
                indicator.currentMenuDepth = -1; 
                indicator.scheduleAutoClose();
                indicator.syncAllActiveStates();
                
                indicator._instantCloseTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 50, () => {
                    if (indicator.currentMenuDepth === -1) {
                        indicator.closeMenusFromDepth(1); 
                    } else if (indicator.currentMenuDepth < this.depth) {
                        indicator.closeMenusFromDepth(this.depth + 1); 
                    }
                    indicator.syncAllActiveStates();
                    return GLib.SOURCE_REMOVE;
                });
            });
        }
    }

    applyStyle(settings) {
        let policy = settings.get_string('scrollbar-policy');
        this.scrollView.hscrollbar_policy = St.PolicyType.NEVER;
        this.scrollView.vscrollbar_policy = (policy === 'always') ? St.PolicyType.ALWAYS : (policy === 'never' ? St.PolicyType.NEVER : St.PolicyType.AUTOMATIC);

        this.actor.set_style(`
            background-color: ${settings.get_string('menu-bg-color')};
            border: ${settings.get_int('menu-border-width')}px solid ${settings.get_string('menu-border-color')};
            border-radius: ${settings.get_int('menu-border-radius')}px;
            padding: ${settings.get_int('menu-pad-top')}px ${settings.get_int('menu-pad-right')}px ${settings.get_int('menu-pad-bottom')}px ${settings.get_int('menu-pad-left')}px;
            box-shadow: ${settings.get_boolean('menu-shadow') ? '0 8px 24px rgba(0,0,0,0.5)' : 'none'};
        `);
    }

    open() { this.isOpen = true; this.actor.show(); }
    close() { this.isOpen = false; this.actor.hide(); }
    destroy() { this.actor.destroy(); }
}

export const CascadingMenuItem = GObject.registerClass(
class CascadingMenuItem extends St.Button {
    
    _init(itemData, indicator, depth) {
        super._init({ 
            style_class: 'custom-places-item', 
            reactive: true, 
            x_expand: true, 
            y_expand: false,
            // Native GNOME approach to capture both Left (1) and Right (3) clicks
            button_mask: St.ButtonMask.ONE | St.ButtonMask.THREE
        });

        this._isCascadingMenuItem = true; 
        this._itemData = itemData;
        this._indicator = indicator;
        this._depth = depth;
        this._loaded = false;
        this._subMenu = null;
        this._hoverTimeout = new TimeoutManager();
        
        this._isHovered = false;
        this._isActiveAncestor = false;

        // BUTTERY SMOOTH PHYSICS: The Overlay Architecture
        let stack = new St.Widget({ layout_manager: new Clutter.BinLayout(), x_expand: true, y_expand: true });
        
        this._bgOverlay = new St.Widget({ x_expand: true, y_expand: true, opacity: 0 });
        this._activeOverlay = new St.Widget({ x_expand: true, y_expand: true, opacity: 0 });
        this._contentBox = new St.BoxLayout({ vertical: false, x_expand: true, y_align: Clutter.ActorAlign.CENTER });
        
        stack.add_child(this._bgOverlay);
        stack.add_child(this._activeOverlay);
        stack.add_child(this._contentBox);
        this.set_child(stack);

        // NATIVE SYMBOLIC ICONS
        let iconString = itemData.iconName || (itemData.isDir ? 'folder-symbolic' : 'text-x-generic-symbolic');
        this._icon = new St.Icon({ icon_name: iconString });
        this._contentBox.add_child(this._icon);

        this._label = new St.Label({ text: itemData.name, y_expand: false, y_align: Clutter.ActorAlign.CENTER, x_expand: true });
        this._contentBox.add_child(this._label);

        if (itemData.isDir) {
            this._arrowIcon = new St.Icon({ icon_name: 'go-next-symbolic' });
            this._contentBox.add_child(this._arrowIcon);

            this._subMenu = new FloatingMenu(this._indicator, this._depth + 1);
            Main.uiGroup.add_child(this._subMenu.actor);
            this._indicator.registerSubMenu(this._subMenu);
        }

        this.connect('enter-event', this._onEnter.bind(this));
        this.connect('leave-event', this._onLeave.bind(this));
        
        // Handles standard left-click and right-click inherently because of button_mask
        this.connect('clicked', this._onClicked.bind(this));

        this.applyStyle(this._indicator._settings);
    }

    applyStyle(settings) {
        this.s = {
            padT: settings.get_int('item-pad-top'), padB: settings.get_int('item-pad-bottom'),
            padL: settings.get_int('item-pad-left'), padR: settings.get_int('item-pad-right'),
            marV: settings.get_int('item-mar-v'), marH: settings.get_int('item-mar-h'),
            radius: settings.get_int('item-radius'), textAlign: settings.get_string('item-text-align'),
            borderW: settings.get_int('item-border-width'), borderC: settings.get_string('item-border-color'),
            showIcons: settings.get_boolean('show-icons'), iconSize: settings.get_int('item-icon-size'), iconGap: settings.get_int('item-icon-gap'),
            showArrows: settings.get_boolean('show-arrows'), arrowSize: settings.get_int('item-arrow-size'), arrowGap: settings.get_int('item-arrow-gap'),
            fontFamily: settings.get_string('font-family'), fontSize: settings.get_int('font-size'), fontWeight: settings.get_string('font-weight'),
            cNormalBg: settings.get_string('color-normal-bg'), cNormalText: settings.get_string('color-normal-text'),
            cHoverBg: settings.get_string('color-hover-bg'), cHoverText: settings.get_string('color-hover-text'),
            cActiveBg: settings.get_string('color-active-bg'), cActiveText: settings.get_string('color-active-text'),
            duration: settings.get_int('transition-duration')
        };

        if (this._icon) {
            this._icon.visible = this.s.showIcons;
            this._icon.set_icon_size(this.s.iconSize);
            this._icon.set_style(`margin-right: ${this.s.iconGap}px;`);
        }
        if (this._arrowIcon) {
            this._arrowIcon.visible = this.s.showArrows;
            this._arrowIcon.set_icon_size(this.s.arrowSize);
            this._arrowIcon.set_style(`margin-left: ${this.s.arrowGap}px;`);
        }
        
        let alignMap = { 'left': Clutter.ActorAlign.START, 'center': Clutter.ActorAlign.CENTER, 'right': Clutter.ActorAlign.END };
        this._label.x_align = alignMap[this.s.textAlign] || Clutter.ActorAlign.START;
        
        // Strict Height Enforcement
        let minHeight = Math.round(this.s.fontSize * 1.2) + this.s.padT + this.s.padB + (this.s.borderW * 2);

        this.set_style(`
            margin: ${this.s.marV}px ${this.s.marH}px;
            border-radius: ${this.s.radius}px;
            border: ${this.s.borderW}px solid ${this.s.borderC};
            background-color: ${this.s.cNormalBg};
            min-height: ${minHeight}px;
        `);

        let innerRad = Math.max(0, this.s.radius - this.s.borderW);
        this._bgOverlay.set_style(`border-radius: ${innerRad}px; background-color: ${this.s.cHoverBg};`);
        this._activeOverlay.set_style(`border-radius: ${innerRad}px; background-color: ${this.s.cActiveBg};`);
        
        this.updateStateStyle(true);
    }

    updateStateStyle(instant = false) {
        if (!this.s) return;
        
        let targetTextColor = this.s.cNormalText;
        if (this._isHovered) targetTextColor = this.s.cHoverText;
        else if (this._isActiveAncestor) targetTextColor = this.s.cActiveText;

        this._contentBox.set_style(`
            padding: ${this.s.padT}px ${this.s.padR}px ${this.s.padB}px ${this.s.padL}px;
            font-family: "${this.s.fontFamily}"; 
            font-size: ${this.s.fontSize}px; 
            font-weight: ${this.s.fontWeight};
            color: ${targetTextColor};
            transition-property: color;
            transition-duration: ${instant ? 0 : this.s.duration}ms;
        `);

        // Fluid Hardware-Accelerated Opacity Fading
        let easeMode = Clutter.AnimationMode.EASE_OUT_QUAD;
        this._bgOverlay.ease({ opacity: this._isHovered ? 255 : 0, duration: instant ? 0 : this.s.duration, mode: easeMode });
        this._activeOverlay.ease({ opacity: this._isActiveAncestor ? 255 : 0, duration: instant ? 0 : this.s.duration, mode: easeMode });
    }

    _onEnter() {
        this._isHovered = true; this.updateStateStyle();
        if (this._indicator) this._indicator.cancelAutoClose();
        this._indicator.setHoverIntent(this._depth, this);

        this._hoverTimeout.set(async () => {
            if (!this._indicator.checkHoverIntent(this._depth, this)) return;
            if (this._itemData.isDir) {
                await this._ensureLoaded();
                if (!this._indicator.checkHoverIntent(this._depth, this)) return;
                this._indicator.openSubMenu(this, this._subMenu, this._depth);
            } else {
                this._indicator.closeMenusFromDepth(this._depth + 1);
            }
        }, this._indicator._settings.get_int('open-delay'));
    }

    _onLeave() {
        this._isHovered = false;
        if (this._indicator) this._indicator.scheduleAutoClose();
        this._hoverTimeout.clear();
        this.syncActiveState();
    }

    syncActiveState() {
        let isActiveChain = false;
        let nextLevel = this._indicator._activeMenus[this._depth + 1];
        if (nextLevel && nextLevel.parentItem === this) isActiveChain = true;
        
        // HIGHLIGHT FIX: Cursor must physically be inside the child menu/outside this box
        let cursorIsNotInParent = (this._indicator.currentMenuDepth !== this._depth);
        this._isActiveAncestor = isActiveChain && cursorIsNotInParent;
        
        this.updateStateStyle();
    }

    async _ensureLoaded() {
        if (this._loaded || !this._itemData.isDir) return;
        this._loaded = true; 
        try {
            const children = await listDirectory(this._itemData.file);
            if (children.length === 0) {
                let emptyItem = new St.Label({ text: this._indicator._settings.get_string('empty-text'), reactive: false });
                emptyItem.set_style(`
                    padding: ${this.s.padT}px ${this.s.padR}px ${this.s.padB}px ${this.s.padL}px; margin: ${this.s.marV}px ${this.s.marH}px;
                    font-family: "${this.s.fontFamily}"; font-size: ${this.s.fontSize}px; font-weight: ${this.s.fontWeight}; color: ${this._indicator._settings.get_string('color-empty-text')};
                `);
                this._subMenu.box.add_child(emptyItem);
            } else {
                for (const child of children) {
                    let menuItem = new CascadingMenuItem(child, this._indicator, this._depth + 1);
                    this._subMenu.box.add_child(menuItem);
                }
            }
        } catch (e) { this._loaded = false; }
    }

    _onClicked(actor, button) {
        this._hoverTimeout.clear(); 
        this._indicator.closeAll(true); 
        
        // Button 3 is a Right-Click.
        if (button === 3) {
            openWithChooser(this._itemData.file);
        } else {
            openFile(this._itemData.file);
        }
    }
});

export const PlacesExplorerIndicator = GObject.registerClass(
class PlacesExplorerIndicator extends PanelMenu.Button {
    
    _init(settings) {
        super._init(0.5, 'Files Dropdown', true); 
        
        // EGO-X-006 Fix: settings is now passed directly from extension.js
        this._settings = settings;
        this._settingsId = this._settings.connect('changed', () => this.reloadAllStyles());

        let box = new St.BoxLayout({ vertical: false, y_align: Clutter.ActorAlign.CENTER });
        this._panelIcon = new St.Icon({ icon_name: 'folder-symbolic', style_class: 'system-status-icon' });
        box.add_child(this._panelIcon);

        this._panelLabel = new St.Label({ y_align: Clutter.ActorAlign.CENTER });
        box.add_child(this._panelLabel);
        this.add_child(box);

        this._activeMenus = []; 
        this._allFloatingMenus = [];
        this._hoverIntents = []; 
        this.currentMenuDepth = -1;
        this._stageReleaseId = null;
        this._stageKeyPressId = null;
        
        this._rootHoverTimeout = new TimeoutManager();
        this._autoCloseTimeout = new TimeoutManager();

        this._rootMenu = new FloatingMenu(this, 0); 
        Main.uiGroup.add_child(this._rootMenu.actor);
        this.registerSubMenu(this._rootMenu);

        this.reactive = true;
        
        this.connect('enter-event', () => {
            this.cancelAutoClose();
            this._rootHoverTimeout.set(() => {
                if (!this._rootMenu.isOpen) this.openRootMenu();
            }, this._settings.get_int('open-delay'));
        });

        this.connect('leave-event', () => {
            this._rootHoverTimeout.clear();
            this.scheduleAutoClose();
        });

        this.connect('button-release-event', () => {
            if (this._rootMenu.isOpen) this.closeAll(true); else this.openRootMenu();
            return Clutter.EVENT_PROPAGATE;
        });

        this._loadBookmarks();
        this.reloadAllStyles();
    }

    syncAllActiveStates() {
        for (let i = 0; i < this._activeMenus.length; i++) {
            let entry = this._activeMenus[i];
            if (entry && entry.parentItem) entry.parentItem.syncActiveState();
        }
    }

    reloadAllStyles() {
        this._panelIcon.visible = this._settings.get_boolean('panel-show-icon');
        this._panelIcon.set_icon_size(this._settings.get_int('panel-icon-size'));
        this._panelIcon.set_style(`color: ${this._settings.get_string('panel-icon-color')};`);
        
        this._panelLabel.visible = this._settings.get_boolean('panel-show-text');
        this._panelLabel.set_text(this._settings.get_string('panel-text'));
        this._panelLabel.set_style(`
            margin-left: ${this._panelIcon.visible ? 6 : 0}px;
            font-family: "${this._settings.get_string('font-family')}";
            font-weight: ${this._settings.get_string('font-weight')};
            color: ${this._settings.get_string('panel-text-color')};
        `);

        for (let menu of this._allFloatingMenus) {
            if (menu && menu.actor) {
                menu.applyStyle(this._settings);
                let children = menu.box.get_children();
                for (let child of children) {
                    if (child._isCascadingMenuItem) {
                        child.applyStyle(this._settings);
                    } else if (child instanceof St.Label) {
                        child.set_text(this._settings.get_string('empty-text'));
                        child.set_style(`
                            padding: ${this._settings.get_int('item-pad-top')}px ${this._settings.get_int('item-pad-right')}px ${this._settings.get_int('item-pad-bottom')}px ${this._settings.get_int('item-pad-left')}px;
                            margin: ${this._settings.get_int('item-mar-v')}px ${this._settings.get_int('item-mar-h')}px;
                            font-family: "${this._settings.get_string('font-family')}"; font-size: ${this._settings.get_int('font-size')}px; font-weight: ${this._settings.get_string('font-weight')};
                            color: ${this._settings.get_string('color-empty-text')};
                        `);
                    }
                }
            }
        }
        
        if (this._rootMenu && this._rootMenu.isOpen) {
            this._updateMenuPosition(this._rootMenu, null, 0);
            for (let i = 1; i < this._activeMenus.length; i++) {
                let entry = this._activeMenus[i];
                if (entry && entry.menu && entry.menu.isOpen && entry.parentItem) {
                    this._updateMenuPosition(entry.menu, entry.parentItem, i);
                }
            }
        }
    }

    async _loadBookmarks() {
        try {
            const bookmarks = await getBookmarks();
            for (const bookmark of bookmarks) {
                let menuItem = new CascadingMenuItem(bookmark, this, 0);
                this._rootMenu.box.add_child(menuItem);
            }
        } catch (error) {
            console.error('PlacesExplorer: Failed to load bookmarks:', error);
        }
    }

    registerSubMenu(menu) {
        this._allFloatingMenus.push(menu);
        menu.applyStyle(this._settings);
    }

    setHoverIntent(depth, item) { this._hoverIntents[depth] = item; }
    checkHoverIntent(depth, item) { return this._hoverIntents[depth] === item; }

    cancelAutoClose() { if (this._autoCloseTimeout) this._autoCloseTimeout.clear(); }
    scheduleAutoClose() {
        if (this._settings.get_boolean('keep-open')) return;
        if (this._autoCloseTimeout) this._autoCloseTimeout.set(() => this.closeAll(false), this._settings.get_int('close-delay')); 
    }
    
    _updateMenuPosition(menu, parentItem, depth) {
        if (!menu || !menu.isOpen) return;

        let monitor = Main.layoutManager.currentMonitor || Main.layoutManager.primaryMonitor;
        if (!monitor) monitor = { x: 0, y: 0, width: 1920, height: 1080 };

        let wMode = this._settings.get_string('menu-width-mode');
        let wVal = this._settings.get_int('menu-width-value');
        let hMode = this._settings.get_string('menu-height-mode');
        let hVal = this._settings.get_int('menu-height-value');

        menu.actor.set_width(-1);
        menu.actor.set_height(-1);

        let [minW, natW] = menu.actor.get_preferred_width(-1);
        let targetW = natW;
        if (wMode === 'fixed') targetW = wVal;
        else if (wMode === 'max') targetW = Math.min(natW, wVal);

        let [minH, natH] = menu.actor.get_preferred_height(targetW);

        let screenMaxH = monitor.height - 40;
        let targetH = natH;
        
        if (hMode === 'fixed') targetH = hVal;
        else if (hMode === 'max') targetH = Math.min(natH, hVal);
        targetH = Math.min(targetH, screenMaxH);

        menu.actor.set_width(Math.round(targetW));
        menu.actor.set_height(Math.round(targetH));

        let targetX = 0;
        let targetY = 0;

        if (depth === 0) { 
            let [iconX, iconY] = this.get_transformed_position();
            let [iconW, iconH] = this.get_transformed_size();
            
            targetX = iconX + this._settings.get_int('root-x-offset');
            targetY = iconY + iconH + this._settings.get_int('root-y-offset');

            if (iconY > monitor.y + monitor.height / 2) {
                targetY = iconY - targetH + this._settings.get_int('root-y-offset');
            }
        } else { 
            // ABSOLUTE PARENT RELATION FIX: Anchors offsets to the physical outer edge of the parent box
            let parentMenu = this._activeMenus[depth - 1].menu;
            let parentX = parentMenu.actor.x;
            let parentW = parentMenu.actor.width;
            
            let [itemX, itemY] = parentItem.get_transformed_position();
            
            let dir = this._settings.get_string('submenu-direction');
            let gapX = this._settings.get_int('child-x-offset');
            let gapY = this._settings.get_int('child-y-offset');
            
            let pushRightX = parentX + parentW + gapX;
            let pushLeftX = parentX - targetW - gapX;
            
            if (dir === 'force-left') {
                targetX = pushLeftX;
            } else if (dir === 'force-right') {
                targetX = pushRightX;
            } else { 
                targetX = pushRightX;
                if (targetX + targetW > monitor.x + monitor.width) {
                    targetX = pushLeftX;
                }
            }
            
            targetY = itemY + gapY;
        }

        if (targetX < monitor.x) targetX = monitor.x + 10;
        if (targetX + targetW > monitor.x + monitor.width) targetX = monitor.x + monitor.width - targetW - 10;
        
        if (targetY < monitor.y) targetY = monitor.y + 10;
        if (targetY + targetH > monitor.y + monitor.height) targetY = monitor.y + monitor.height - targetH - 10;

        menu.actor.set_position(Math.round(targetX), Math.round(targetY));
    }

    openRootMenu() {
        this.closeMenusFromDepth(1);
        this._rootMenu.open();
        this._activeMenus[0] = { menu: this._rootMenu, parentItem: null };
        this.currentMenuDepth = 0;
        
        if (!this._stageReleaseId) this._stageReleaseId = global.stage.connect('button-release-event', this._onStagePress.bind(this));
        if (!this._stageKeyPressId) this._stageKeyPressId = global.stage.connect('key-press-event', this._onStageKeyPress.bind(this));

        this._updateMenuPosition(this._rootMenu, null, 0);
    }

    _onStagePress(actor, event) {
        if (!this._rootMenu.isOpen) return Clutter.EVENT_PROPAGATE;
        if (this._settings.get_boolean('keep-open')) return Clutter.EVENT_PROPAGATE;

        let target = event.get_source();
        if (this.contains(target)) return Clutter.EVENT_PROPAGATE;
        for (let menu of this._allFloatingMenus) {
            if (menu.isOpen && menu.actor.contains(target)) return Clutter.EVENT_PROPAGATE;
        }
        this.closeAll(false);
        return Clutter.EVENT_PROPAGATE;
    }
    
    _onStageKeyPress(actor, event) {
        if (this._rootMenu.isOpen && event.get_key_symbol() === Clutter.KEY_Escape) {
            this.closeAll(true);
            return Clutter.EVENT_STOP;
        }
        return Clutter.EVENT_PROPAGATE;
    }

    openSubMenu(item, subMenu, parentDepth) {
        if (!this._rootMenu || !this._rootMenu.isOpen) return;
        this.closeMenusFromDepth(parentDepth + 1);
        
        if (subMenu && !subMenu.isOpen) {
            Main.uiGroup.set_child_above_sibling(subMenu.actor, null);
            subMenu.open();
            this._updateMenuPosition(subMenu, item, parentDepth + 1);
        }
        
        this._activeMenus[parentDepth + 1] = { menu: subMenu, parentItem: item };
        item.syncActiveState();
    }

    closeMenusFromDepth(depth) {
        for (let i = this._activeMenus.length - 1; i >= depth; i--) {
            let entry = this._activeMenus[i];
            if (entry && entry.menu && entry.menu.isOpen) entry.menu.close();
            let parentItem = entry ? entry.parentItem : null;
            this._activeMenus.length = i; 
            if (parentItem) parentItem.syncActiveState();
        }
    }

    closeAll(force = false) {
        if (!force && this._settings.get_boolean('keep-open')) return;

        if (this._stageReleaseId) { global.stage.disconnect(this._stageReleaseId); this._stageReleaseId = null; }
        if (this._stageKeyPressId) { global.stage.disconnect(this._stageKeyPressId); this._stageKeyPressId = null; }
        
        this.currentMenuDepth = -1;
        this._hoverIntents = []; 
        this._rootHoverTimeout.clear();
        this.cancelAutoClose(); 
        
        this.closeMenusFromDepth(1);
        if (this._rootMenu) this._rootMenu.close();
        for (const menu of this._allFloatingMenus) if (menu && menu.isOpen) menu.close();
    }

    destroy() {
        if (this._settingsId && this._settings) this._settings.disconnect(this._settingsId);
        this.closeAll(true);
        for (const menu of this._allFloatingMenus) if (menu && menu.actor) menu.destroy();
        this._allFloatingMenus = [];
        super.destroy();
    }
});
