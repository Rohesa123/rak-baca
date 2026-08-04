# Rak Baca

A personal reading log that runs entirely offline. No server, no account, no network calls — everything lives on the device.

It exists to answer one question: *what was I reading, and where did I stop?* Point it at the manga, web novels, and articles you read online for free, and it remembers the title, your progress, and the link back.

Built as a web app with **Vite + React 19 + TypeScript**, then packaged into an Android APK with **Capacitor**. The APK is compiled by GitHub Actions, so no local Android SDK is required.

## Features

- Add books with title, author, category, tags, status, priority, and notes
- Pick a cover image from the device gallery; images are resized and compressed before storage
- Manage categories (with colours) and tags, with duplicate-name validation
- Search by title or author; filter by status, category, and tags; sort four ways
- Light / dark / follow-system theme, remembered across sessions
- Android hardware back button, splash screen, themed status bar, and haptics

## Tech stack

| Concern | Choice | Why |
| --- | --- | --- |
| Build | Vite 8 | Fast dev server, simple production output |
| UI | React 19 + TypeScript | — |
| Styling | Tailwind CSS 4 | Zero runtime — CSS is generated at build time, adding no JavaScript |
| Components | Radix UI (alert dialog) | Headless and tree-shakeable; accessible focus handling out of the box |
| Icons | Lucide | MIT-licensed, tree-shakeable, consistent stroke weight across the set |
| Local database | Dexie 4 (IndexedDB) | Identical behaviour in Chrome and the Android WebView, so every feature is testable in the browser |
| Reactivity | `dexie-react-hooks` | `useLiveQuery` re-renders components when the database changes |
| UI state | Zustand 5 | ~1 KB; holds filters and theme only — book data stays in Dexie |
| Routing | React Router 8 | Hash router, which avoids 404s on refresh under both dev and Capacitor origins |
| Native shell | Capacitor 8 | Camera, App, Preferences, Splash Screen, Status Bar, Haptics |

## Getting started

```bash
npm install
```

```bash
npm run dev
```

Open the URL Vite prints and enable the device toolbar in Chrome DevTools for a mobile-sized viewport. Because the app uses IndexedDB through Dexie, nearly every feature can be exercised in the browser without building an APK.

| Script | Purpose |
| --- | --- |
| `npm run dev` | Development server with hot reload |
| `npm run build` | Type-check and build to `dist/` |
| `npm run preview` | Preview the production build |
| `npm run lint` | Run ESLint |

## Project structure

```
src/
├─ app/          Router and layout shell
├─ components/
│  ├─ ui/        Primitives: Button, TextField, Chip, Select, ConfirmDialog…
│  └─ book/      BookCard, BookForm, CoverPicker, TagPicker, BookCover
├─ db/           Dexie instance, schema, and one repository per table
├─ features/     Page-level screens: books, categories, tags, settings
├─ hooks/        useTheme, useBackButton, useObjectUrl
├─ lib/          image processing, platform detection, native wrappers
└─ stores/       Zustand stores for UI and theme state
```

Components never touch Dexie directly — all queries go through `src/db/*.repo.ts`. That keeps query logic in one place and means a future storage change would only touch that folder.

## Data model

```ts
db.version(1).stores({
  books:      'id, title, author, categoryId, *tagIds, status, createdAt',
  categories: 'id, &name, createdAt',
  tags:       'id, &name, createdAt',
  covers:     'id, bookId',
});
```

Two details worth knowing:

- `*tagIds` is a multi-entry index, so the many-to-many relationship between books and tags needs no join table while staying indexed.
- Cover blobs live in their own table. Keeping them inline on `books` would mean every list query pulled hundreds of kilobytes of image data into memory just to render titles.

Cover images are resized so the longest edge is 800 px and re-encoded as JPEG at quality 0.8. A 5 MB phone photo typically lands around 40–120 KB.

## Building the APK

No Android SDK is needed locally. [build-apk.yml](.github/workflows/build-apk.yml) builds the web app, syncs it into the Capacitor Android project, and runs Gradle.

Ordinary pushes build nothing. An APK is produced only when a release is tagged:

```bash
git tag v1.0.0 && git push --tags
```

Every APK therefore carries a version number and traces back to one specific commit, rather than being an anonymous "latest build". The workflow can also be run by hand from the Actions tab against any branch.

To collect the result:

1. Open the **Actions** tab on GitHub
2. Select the most recent **Build Android APK** run
3. Download the `rak-baca-<tag>` artifact
4. Extract it and install `app-debug.apk` on the device

Android will ask permission to install from an unknown source. The build can also be triggered manually with **Run workflow** in the Actions tab.

The output is a **debug build** signed with the default debug keystore — fine for personal use, not ready for the Play Store.

## Android notes

| Item | Value |
| --- | --- |
| `minSdkVersion` | 26 (Android 8.0), so adaptive launcher icons apply on every supported device |
| `compileSdk` / `targetSdk` | 36 |
| Permissions | `READ_MEDIA_IMAGES`, plus `READ_EXTERNAL_STORAGE` capped at API 32. `CAMERA` is deliberately omitted — the app only picks from the gallery |
| `appId` | `com.example.bookwishlist` — **must be changed before any Play Store release**, and changing it after the fact means renaming the Java package by hand |

The `android/` directory is committed on purpose. It holds hand-edited files that cannot be regenerated: the manifest permissions, the app name, and the launcher icon. Build artefacts inside it are excluded by Capacitor's own `android/.gitignore`.

## Status

The app is feature-complete for its first release: the data layer, all screens, cover images, and the native polish are done and working in the browser.

What has not been confirmed yet is behaviour on real hardware — gallery permissions, EXIF orientation of real photos, the physical back button, and data persistence after a force-stop. Those can only be checked once the APK is installed on a device.

Not started: page transitions, JSON export/import, ISBN scanning, list virtualisation, and a signed release build.

## A note on your data

This app performs **no automatic backup**. Data is lost permanently if the app is uninstalled or its storage is cleared. An export feature is on the roadmap but not implemented.

## License

[MIT](LICENSE), with an additional disclaimer covering local-only data storage and unofficial builds.
