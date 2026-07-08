# 📁 Files Dropdown (GNOME Shell Extension)

```{=html}
<p align="center">
```
`<img src="preview.png" alt="Files Dropdown Preview" width="900">`{=html}
```{=html}
</p>
```
Stop digging through windows to find your files. **Files Dropdown**
transforms your GNOME top panel into a high-speed portal to your entire
file system.

Designed for speed and fluidity, this extension lets you navigate to the
exact document, video, or project you need in seconds---without ever
opening a file manager.

------------------------------------------------------------------------

## ✨ Why You'll Love It

### 🚀 Glide Through Your Folders

Hover over a folder and its submenu opens instantly. Browse directories
infinitely deep through smooth cascading menus without repeatedly
clicking.

### 🎯 Stay Focused

Launch files, open projects, or inspect file properties directly from
the top panel. Your **Home** folder and **GTK/Nautilus Bookmarks** are
available immediately.

### ⚡ Fast, Even With Huge Folders

Built for modern GNOME using asynchronous Gio file enumeration and
hardware-accelerated animations. Even folders containing thousands of
files won't freeze GNOME Shell.

### 🎨 Make It Yours

Customize nearly everything:

-   Menu dimensions, spacing and border radius
-   Fonts
-   Colors and opacity
-   Hover animations
-   Shadows
-   Menu position and offsets
-   Open/Close delays and animation speed

------------------------------------------------------------------------

## 📦 Installation

### Method 1 --- GNOME Extensions (Recommended)

After the extension is approved and published on
**extensions.gnome.org**, you'll be able to install it with a single
click.

> **Note:** The store link is intentionally omitted until approval
> because it does not exist yet.

### Method 2 --- Manual Installation

Clone the repository:

``` bash
git clone https://github.com/vaibhavpatidar0079/files-dropdown.git
```

Copy the extension into your local extensions directory:

``` bash
mkdir -p ~/.local/share/gnome-shell/extensions/files-dropdown@vaibhavpatidar0079.github.com
cp -r files-dropdown/* ~/.local/share/gnome-shell/extensions/files-dropdown@vaibhavpatidar0079.github.com/
```

Compile the schemas:

``` bash
glib-compile-schemas ~/.local/share/gnome-shell/extensions/files-dropdown@vaibhavpatidar0079.github.com/schemas
```

Restart GNOME Shell:

-   **Wayland:** Log out and log back in.
-   **X11:** Press `Alt + F2`, type `r`, then press **Enter**.

Enable **Files Dropdown** using the **Extensions** application.

------------------------------------------------------------------------

## 🖥️ Compatibility

-   GNOME Shell **45--50**
-   ECMAScript Modules (ESM)

------------------------------------------------------------------------

## 🤝 Contributing

Contributions, bug reports and feature requests are always welcome.

1.  Fork the repository
2.  Create a feature branch
3.  Commit your changes
4.  Push your branch
5.  Open a Pull Request

------------------------------------------------------------------------

## 📝 License

Licensed under the **GNU General Public License v3.0 (GPL-3.0)**.
