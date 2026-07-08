# 📁 Files Dropdown (GNOME Shell Extension)

<p align="center">
  <img src="preview.png" alt="Files Dropdown Preview" width="900">
</p>

**Files Dropdown** brings your file system directly to the GNOME top panel, letting you browse folders and launch files through fast, cascading menus—without opening a file manager.

Designed for modern GNOME, it combines asynchronous file loading, smooth animations, and extensive customization to make navigating your files feel effortless.

---

## ✨ Features

### 🚀 Infinite Cascading Navigation

Browse folders by simply hovering over them. Submenus open instantly, allowing you to navigate deeply nested directories in seconds.

### 🏠 Built-in Bookmarks

Your **Home** folder and **GTK/Nautilus Bookmarks** are available immediately.

### ⚡ Fast & Responsive

Uses asynchronous **Gio** file enumeration, so even directories containing thousands of files won't freeze GNOME Shell.

### 🖱 Native GNOME Behavior

- **Left Click:** Open files or folders.
- **Right Click:** Open the item's **Properties** dialog.

### 🎨 Highly Customizable

- Size, padding and margins
- Fonts
- Colors and opacity
- Hover animations
- Border radius and shadows
- Menu position and offsets
- Open/Close delays and animation speed

---

## 📦 Installation

### Option 1 — GNOME Extensions (Coming Soon)

This extension has been submitted to **extensions.gnome.org** and is currently awaiting review.

Once it is approved, this README will be updated with the official one-click installation link.

### Option 2 — Install from Source

```bash
git clone https://github.com/vaibhavpatidar0079/files-dropdown.git
cd files-dropdown

mkdir -p ~/.local/share/gnome-shell/extensions/files-dropdown@vaibhavpatidar0079.github.com
cp -r . ~/.local/share/gnome-shell/extensions/files-dropdown@vaibhavpatidar0079.github.com/

glib-compile-schemas ~/.local/share/gnome-shell/extensions/files-dropdown@vaibhavpatidar0079.github.com/schemas
```

Restart GNOME Shell:

- **Wayland:** Log out and back in.
- **X11:** Press `Alt + F2`, type `r`, then press **Enter**.

Enable **Files Dropdown** using the **Extensions** application.

---

## 🖥 Compatibility

- GNOME Shell **45–50**
- ECMAScript Modules (ESM)

---

## 🤝 Contributing

Contributions, bug reports, and feature requests are welcome.

---

## 📝 License

Distributed under the **GNU General Public License v3.0 (GPL-3.0)**.
