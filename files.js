import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

function extractSymbolicIconName(file) {
    try {
        const info = file.query_info('standard::symbolic-icon', Gio.FileQueryInfoFlags.NONE, null);
        let gicon = info.get_symbolic_icon();
        if (gicon && typeof gicon.get_names === 'function') {
            return gicon.get_names()[0]; // Safely grabs Adwaita symbolic string (e.g. 'folder-videos-symbolic')
        }
    } catch (e) {}
    return null;
}

export function getBookmarks() {
    return new Promise((resolve) => {
        const configDir = GLib.get_user_config_dir();
        const bookmarksFile = Gio.File.new_for_path(GLib.build_filenamev([configDir, 'gtk-3.0', 'bookmarks']));
        const bookmarks = [];

        const fallback = () => {
            const homeFile = Gio.File.new_for_path(GLib.get_home_dir());
            bookmarks.push({ file: homeFile, name: "Home", isDir: true, iconName: extractSymbolicIconName(homeFile) });
            resolve(bookmarks);
        };
        
        // EGO-X-004 Fix: Avoid synchronous file IO by using async variant
        bookmarksFile.load_contents_async(null, (file, res) => {
            try {
                const [success, contents] = file.load_contents_finish(res);
                if (success) {
                    const lines = new TextDecoder().decode(contents).split(/\r?\n/);
                    for (const line of lines) {
                        const cleanLine = line.trim();
                        if (!cleanLine) continue;
                        
                        const parts = cleanLine.split(' ');
                        const uri = parts[0];
                        const name = parts.length > 1 ? parts.slice(1).join(' ') : null;
                        const f = Gio.File.new_for_uri(uri);
                        
                        bookmarks.push({ 
                            file: f, 
                            name: name || f.get_basename() || uri, 
                            isDir: true,
                            iconName: extractSymbolicIconName(f)
                        });
                    }
                    resolve(bookmarks);
                } else {
                    fallback();
                }
            } catch (e) {
                fallback();
            }
        });
    });
}

export function listDirectory(file) {
    return new Promise((resolve, reject) => {
        file.enumerate_children_async(
            'standard::name,standard::type,standard::symbolic-icon,standard::is-hidden',
            Gio.FileQueryInfoFlags.NONE,
            GLib.PRIORITY_DEFAULT,
            null,
            (obj, res) => {
                try {
                    const enumerator = obj.enumerate_children_finish(res);
                    const items = [];
                    
                    const fetchNextBatch = () => {
                        enumerator.next_files_async(50, GLib.PRIORITY_DEFAULT, null, (enumObj, enumRes) => {
                            try {
                                const files = enumObj.next_files_finish(enumRes);
                                
                                if (files.length === 0) {
                                    enumerator.close_async(GLib.PRIORITY_DEFAULT, null, () => {});
                                    items.sort((a, b) => {
                                        if (a.isDir && !b.isDir) return -1;
                                        if (!a.isDir && b.isDir) return 1;
                                        return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
                                    });
                                    resolve(items);
                                    return;
                                }
                                
                                for (const info of files) {
                                    if (info.get_is_hidden()) continue;
                                    
                                    let gicon = info.get_symbolic_icon();
                                    let iconName = (gicon && typeof gicon.get_names === 'function') ? gicon.get_names()[0] : null;
                                    
                                    items.push({
                                        file: enumerator.get_child(info),
                                        name: info.get_name(),
                                        isDir: info.get_file_type() === Gio.FileType.DIRECTORY,
                                        iconName: iconName
                                    });
                                }
                                fetchNextBatch(); 
                            } catch (e) {
                                reject(e);
                            }
                        });
                    };
                    fetchNextBatch();
                } catch (e) {
                    resolve([]); 
                }
            }
        );
    });
}

export function openFile(file) {
    try {
        const ctx = global.create_app_launch_context(0, -1);
        Gio.AppInfo.launch_default_for_uri_async(file.get_uri(), ctx, null, (source, result) => {
            try { Gio.AppInfo.launch_default_for_uri_finish(result); } catch (e) {}
        });
    } catch (e) {}
}

export function openWithChooser(file) {
    try {
        // xdg-portal actively blocks file:// URIs.
        // We bypass the portal entirely and ask the File Manager daemon directly.
        // We use explicit GVariant typing to prevent GNOME Shell silent type-packing errors.
        
        let variant = GLib.Variant.new_tuple([
            GLib.Variant.new_strv([file.get_uri()]), // 'as' (array of strings/URIs)
            GLib.Variant.new_string('')              // 's'  (startup ID, can be empty)
        ]);

        Gio.DBus.session.call(
            'org.freedesktop.FileManager1',
            '/org/freedesktop/FileManager1',
            'org.freedesktop.FileManager1',
            'ShowItemProperties',
            variant,
            null,
            Gio.DBusCallFlags.NONE,
            -1,
            null,
            (connection, res) => {
                try {
                    connection.call_finish(res);
                } catch (e) {
                    console.error('PlacesExplorer: DBus FileManager1 rejected call, falling back to subprocess:', e);
                    spawnNautilusProperties(file);
                }
            }
        );
    } catch (e) {
        console.error('PlacesExplorer: DBus initialization failed:', e);
        spawnNautilusProperties(file);
    }
}

// Ultimate Fallback: Opens the file's properties dialog via raw terminal command.
// (The properties dialog has an 'Open With' tab built in).
function spawnNautilusProperties(file) {
    try {
        Gio.Subprocess.new(
            ['nautilus', '--show-item-properties', file.get_uri()],
            Gio.SubprocessFlags.NONE
        );
    } catch (err) {
        console.error('PlacesExplorer: Raw Subprocess fallback failed:', err);
    }
}
