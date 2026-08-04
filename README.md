# Rak Baca

A personal reading log that runs entirely offline. No server, no account, no network calls — everything lives on the device.

It exists to answer one question: *what was I reading, and where did I stop?*

Most reading trackers are built around books you own or intend to buy. This one is built around the things people actually read for free online — manga, manhwa, web novels, short stories, papers, articles — where nothing remembers your place for you and a note-taking app quickly turns into an unsearchable mess. Point it at what you are reading, and it keeps the title, the chapter you reached, and the link back.

*Rak baca* is Indonesian for "reading shelf".

## Features

**Tracking what you read**

- Record a work with its title, an alternative title for works known under more than one name, author, synopsis, private notes, and a link back to the source
- Track progress in chapters or pages, with or without a known total, and jump forward one unit at a time
- Progress is hidden entirely for formats where it makes no sense — a short story or an article has no chapter to remember
- Reading status is derived from progress rather than set by hand, so it can never contradict the numbers
- Mark favourites, give a personal rating, and record when you finished

**Organising**

- Four independent axes — type, genre, theme, and publication status — each fully editable, with 55 sensible defaults seeded on first run
- Search across titles and authors
- Filter by any combination of axes, **including exclusion**: "mystery, but not romance" is a single query
- Sort several ways, and select multiple works to delete at once

**Images**

- Attach several images per work, not just one cover, and reorder them
- Crop before saving, or re-crop later without re-picking the file
- Images are resized and re-encoded to WebP, so a multi-megabyte phone photo lands in the tens of kilobytes
- Full-size blobs are stored separately from thumbnails, so browsing a gallery never loads more than it shows

**Everything else**

- Export the whole collection to a ZIP and import it back — merge-only and idempotent, so importing the same file twice changes nothing
- Indonesian and English throughout
- Light, dark, or follow-system theme, plus a custom accent colour whose text contrast is computed rather than guessed
- Android hardware back button, splash screen, themed status bar, and haptics

## Offline by design

The app never makes a network request. That is not a limitation waiting to be lifted — it is the point. There is no account to create, no sync to configure, nothing to keep paying for, and no server that can disappear and take your notes with it.

The trade-off is real and worth stating plainly: **nothing is backed up automatically.** If the app is uninstalled or its storage is cleared, the data is gone. The ZIP export exists for exactly this reason, and it is worth using.

## Tech stack

| Concern | Choice | Why |
| --- | --- | --- |
| Build | Vite 8 | Fast dev server, simple production output |
| UI | React 19 + TypeScript 6 | — |
| Styling | Tailwind CSS 4 | Zero runtime — CSS is generated at build time, adding no JavaScript |
| Components | Radix UI (dialog, alert dialog) | Headless and tree-shakeable; accessible focus handling out of the box |
| Icons | Lucide | MIT-licensed, tree-shakeable, consistent stroke weight |
| Local database | Dexie 4 (IndexedDB) | Behaves identically in Chrome and the Android WebView, so nearly every feature is testable in a browser |
| Reactivity | `dexie-react-hooks` | `useLiveQuery` re-renders components when the data changes |
| UI state | Zustand 5 | ~1 KB; holds filters and preferences only — the works themselves stay in Dexie |
| Routing | React Router 8 | Hash router, which sidesteps origin differences between the dev server and Capacitor |
| Cropping | react-easy-crop | Capacitor's native `editPhoto` is not implemented on web, which would have made cropping untestable |
| Archives | fflate | ~8 KB and synchronous; a full ZIP library would have cost more than the feature |
| Native shell | Capacitor 8 | Camera, App, Preferences, Splash Screen, Status Bar, Haptics, Filesystem, Share |

## Getting started

```bash
npm install
```

```bash
npm run dev
```

Open the URL Vite prints and turn on the device toolbar in Chrome DevTools for a phone-sized viewport. Because storage goes through Dexie and IndexedDB, almost everything can be exercised in the browser without building an APK.

| Script | Purpose |
| --- | --- |
| `npm run dev` | Development server with hot reload |
| `npm run build` | Type-check and build to `dist/` |
| `npm run preview` | Serve the production build |
| `npm run lint` | Run ESLint |

## Project structure

```
src/
├─ app/          Router and layout shell
├─ components/
│  ├─ ui/        Primitives: Button, Chip, FilterChip, Select, ConfirmDialog…
│  └─ work/      WorkCard, WorkForm, ImageViewer, CropDialog, TagPicker…
├─ db/           Dexie instance, models, seeds, and one repository per concern
├─ features/     Page-level screens: works, taxonomies, settings
├─ hooks/        useTheme, useBackButton, useObjectUrl
├─ i18n/         Message catalogue and the useT hook
├─ lib/          Images, colour maths, ZIP backup, native wrappers, IDs
└─ stores/       Zustand stores for UI state
```

Components never touch Dexie directly — every query goes through `src/db/*.repo.ts`. That keeps query logic in one place and confines the blast radius of a future storage change to a single folder.

The message catalogue is typed so that the English record must have a key for every Indonesian one. A missing translation is a build error, not something discovered later by a user.

## Data model

```ts
db.version(1).stores({
  works:
    'id, title, altTitle, author, typeId, *themeIds, *genreIds, pubStatusId, ' +
    'ageRating, lastReadAt, personalRating, favoritedAt, finishedAt, ' +
    'primaryImageId, createdAt',

  taxonomies: 'id, kind, name, &[kind+name], createdAt',
  images:     'id, workId, [workId+role], role, sortOrder',
  imageBlobs: 'id',
});
```

Four decisions worth knowing:

- **One taxonomy table, discriminated by `kind`.** Types, genres, themes, and publication statuses behave identically — create, rename, recolour, delete, count usages. Four near-identical tables would have meant four near-identical repositories.
- **`&[kind+name]` rather than `&name`.** Two genres cannot share a name, but a genre and a theme may. Those are different axes, and a work can legitimately be tagged with both.
- **`favoritedAt` is a timestamp, not a boolean.** IndexedDB cannot index booleans, so a `isFavorite: true` field could not be queried efficiently. A nullable timestamp indexes cleanly and records *when*, which is strictly more information.
- **Blobs live apart from thumbnails.** Keeping full-size images inline would mean a gallery grid pulled megabytes into memory just to draw postage stamps.

## Building the APK

No local Android SDK is required. [build-apk.yml](.github/workflows/build-apk.yml) builds the web app, syncs it into the Capacitor project, and runs Gradle on a GitHub runner.

Ordinary pushes build nothing. What happens depends entirely on the trigger:

| Trigger | Output | Where it goes |
| --- | --- | --- |
| Push a `v*` tag | **Signed release APK** | Attached to the GitHub release, kept indefinitely |
| **Run workflow** in the Actions tab | Debug APK | Workflow artifact, expires in 30 days |

```bash
git tag v1.0.0 && git push origin v1.0.0
```

Every APK therefore carries a version number and traces back to one specific commit, instead of being an anonymous "latest build". Android will ask for permission to install from an unknown source.

### Signing

Release builds are signed with a keystore held in GitHub Secrets — `RELEASE_KEYSTORE_BASE64`, `RELEASE_KEYSTORE_PASSWORD`, `RELEASE_KEY_ALIAS`, and `RELEASE_KEY_PASSWORD`. The credentials are read from the environment and never from a file in the repository, and the whole signing block is skipped when they are absent, so local and debug builds behave exactly as before.

This matters more than it might appear. A CI runner starts clean every time, so without a stored keystore Gradle generates a fresh random one on each run. The signature would then differ between builds, Android would refuse to install an update over the previous version, and the only way forward would be to uninstall — which, for an app whose data exists nowhere else, means losing the entire collection.

`versionCode` is supplied by CI from the run number rather than hardcoded, for the same reason: an Android update must carry a strictly higher `versionCode` than the version it replaces.

Two consequences to be aware of:

- **The keystore must be backed up outside the repository.** Losing it means never again being able to ship an update that installs over an existing one. There is no recovery path.
- **Debug and release builds cannot replace each other**, because their signatures differ. Starting straight from a release build avoids the problem entirely.

## Android notes

| Item | Value |
| --- | --- |
| `applicationId` | `id.co.dak.rakbaca` |
| `minSdkVersion` | 26 (Android 8.0), so adaptive launcher icons apply on every supported device |
| `compileSdk` / `targetSdk` | 36 |
| Permissions | `READ_MEDIA_IMAGES`, plus `READ_EXTERNAL_STORAGE` capped at API 32. `CAMERA` is deliberately **not** requested — the app only ever picks from the gallery |
| Binary assets | None. The launcher icon and splash screen are vector drawables, so there is no per-density PNG to keep in sync |

`minifyEnabled` is deliberately off for release builds. R8 strips classes reached only by reflection, which is precisely how Capacitor's JavaScript bridge works; enabling it without a tested set of keep rules risks plugins failing silently in the release APK while debug builds look healthy.

The `android/` directory is committed on purpose. It holds hand-edited files that cannot be regenerated — manifest permissions, the app name, the launcher icon, and the signing configuration. Build artefacts inside it are excluded by Capacitor's own `android/.gitignore`.

## Status

Feature-complete for the first release. The data layer, every screen, images, export and import, both languages, and the native polish are done and verified in the browser.

What has **not** been confirmed is behaviour on real hardware. Gallery permission prompts, the native picker, EXIF orientation on real photos, the physical back button, and persistence after a force-stop can only be checked on a device. Treat the first install as a test.

Not implemented: manual drag-and-drop ordering, list virtualisation, collection statistics, sharing a list as text, and an AAB bundle for the Play Store.

## License

[MIT](LICENSE), with an additional disclaimer covering local-only data storage and unofficial builds.
