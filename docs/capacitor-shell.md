# Capacitor Shell

This repo now includes a non-destructive Capacitor setup so the current Vercel web app can be tested inside an iPad-native shell without replacing the existing deployment flow.

## Current approach

- The Capacitor shell points at the live hosted app: `https://equipment-audit.vercel.app`
- The Next.js web app and Vercel deployment remain unchanged
- This is intended as a temporary evaluation path, not the final offline architecture

## What this gives you

- An iOS app container around the current app
- A path to test native packaging and device installation
- A foundation for later native plugin work such as Camera, Filesystem, or Share

## What this does not solve yet

- It does not make the app truly offline-capable
- It does not yet move photo storage into native device storage
- It still depends on the hosted web app because `server.url` is used

## Commands

```bash
npm run cap:doctor
npm run cap:sync
npm run cap:open:ios
```

## iOS prerequisites

You will need:

- a Mac
- Xcode
- an Apple Developer account for device distribution beyond local simulator/testing

## Recommended next step

After validating that the shell launches correctly on iPad, the next step should be to replace browser-only photo capture/storage with Capacitor plugins and decide whether the native shell should keep loading the hosted app or evolve into a bundled build target.
