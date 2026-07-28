# Portal POS

**Portal POS** is a modern desktop Point of Sale (POS) application built with **React**, **Vite**, and **Tauri**. It is designed to provide a fast, secure, and offline-first experience for retail businesses. The application stores data locally using SQLite and is architected for future integration with a Drupal backend through REST APIs.

## Features

* Modern desktop application
* Cross-platform support (Windows, macOS, and Linux)
* Offline-first architecture
* Local SQLite database
* Product and inventory management
* Sales and purchase management
* Customer and supplier management
* Professional, responsive user interface
* Future-ready for Drupal REST API integration

## Technology Stack

* React
* Vite
* Tauri 2
* JavaScript
* SQLite

## Development

Install dependencies:

```bash
bun install
```

Start the development server:

```bash
bun run tauri dev
```

## Build

Create a production build for the current platform:

```bash
bun run tauri build
```

### Build macOS DMG Installer

Generate a macOS `.dmg` installer:

```bash
bun run tauri build --bundles dmg
```

The generated installer will be available in:

```text
src-tauri/target/release/bundle/dmg/
```

### Build Windows Installer

Generate a Windows installer:

```bash
bun run tauri build --bundles nsis
```

or

```bash
bun run tauri build --bundles msi
```

### Build Linux Package

Generate a Linux package:

```bash
bun run tauri build --bundles appimage
```

or

```bash
bun run tauri build --bundles deb
```

## Project Structure

```text
src/
├── components/
├── pages/
├── layouts/
├── routes/
├── services/
├── database/
├── hooks/
├── contexts/
├── utils/
└── assets/

src-tauri/
├── src/
├── icons/
└── tauri.conf.json
```

## License

This project is proprietary software developed as **Portal POS**. All rights reserved.
