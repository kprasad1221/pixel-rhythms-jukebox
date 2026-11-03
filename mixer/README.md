# Pixel Rhythms — Local Mixer

**One entry point: `mixer/index.html`.** This reset returns to the Jukebox's glass screen, pads, audio feedback, fades, and recording. One pad means one ordinary video file, with its embedded soundtrack.

## Open and play

In your existing checkout, run these in PowerShell:

```powershell
cd D:\Projects\pixel-rhythms-mixer
git pull --ff-only
Start-Process .\mixer\index.html
```

Or double-click `mixer/index.html` and open it in Chrome or Edge. No server or package installation is needed to play. If your old local server is still running, Ctrl+C stops it. Serving this same file at `/mixer/` still works, but is optional.

1. Click **Choose video folder** and choose the folder holding your original Krea downloads. Alternatively, **Choose videos** selects a few files.
2. Tap a numbered pad. Its video and embedded audio play together.
3. Tap a different pad to crossfade. **Pause** pauses the picture and sound. Closing the tab stops playback.

Use the original downloads from Krea for this check. The earlier ZIP's compressed videos have no audio; they will still play as silent video. There is no separate music file to restore or configure.

## Keep files simple

- Keep the videos in any local folder you like. Nothing has to be copied next to the app.
- MP4, WebM, M4V and MOV files are offered as pads. Actual decoding depends on the browser and the codecs inside the file; the original Memory Basin samples are H.264 + AAC MP4.
- A selected folder includes videos in its subfolders. Pads follow natural alphabetical path order: `01 Memory Basin Amber A.mp4`, `02 Memory Basin Amber B.mp4`, etc. Naming is optional; UUID filenames also work.
- More than ten videos appear on additional pages of ten pads. Arrows change which pads are shown without interrupting playback.
- **Change one clip** replaces one pad's assignment. The old clip keeps playing until you tap the replacement.
- To refresh a folder after adding/replacing/deleting files in Windows, select that folder again. This replaces the current set and stops playback; it does not watch the folder automatically.
- Folder/file selections last for the tab. Select the folder again after reloading or reopening. The app does not keep stale copies in browser storage.
- Files stay on your device. This HTML has no external scripts, network requests, server, configuration manifest, image references, separate audio requirement or API calls. Its content security policy blocks network connections.

## One mixing experiment

1. Play **Memory Basin Amber A**.
2. Expand **Try a light blend** and click **Layer a clip**.
3. Tap **Memory Basin Amber B**, then move **Amount**.
4. **Remove layer** returns to A alone. Tapping a pad normally starts ordinary playback and clears the layer after the new clip loads successfully.

The layer contributes picture only. Music stays with the base clip, avoiding two complete soundtracks playing over each other. **Change layer** selects a different visual layer. Both pictures pause/resume together.

This uses Canvas `lighten`: at full amount it keeps the brighter channel values from both images; Amount interpolates the result over the base. It blends complete frames. It does not extract independent lamps, fog or geometry. Matching camera views will usually be easier to read; moving views can overlap visibly. There is no beat synchronization, time stretching or promise of exact loop seams.

## Record

Play a pad, then **Record → Stop → Save video**. The displayed canvas is also the recording source, so the mix and fades use the same rendering path. The master audio includes volume and fades; the visual layer remains silent. Recording requests 1280 × 720 at 24 fps; the source videos are decoded at their original resolution. Keep the tab visible during recording. Save the take before closing.

Opening a new folder and replacing pad files are disabled while recording. Pad playback, mixing and pause remain usable. Stopping a recording stops its recording tracks, while playback continues. A completed take remains available until replaced by another successful recording or the page closes.

## Validation and limits — November 2, 2026

- Downloaded the original Krea Memory Basin Amber A and B links: both are 1344 × 768 H.264 MP4s with AAC audio, 5.184 seconds each. Both decode fully with FFmpeg without reported errors.
- Ten checks run the actual shipped HTML's interaction code with simulated browser media: empty startup, folders and more than ten pads, embedded-audio routing, crossfade, muted layering, failed-load rollback, one-file replacement, folder reselection, recording lifecycle, and keyboard input after clicking a pad.
- JavaScript syntax and Git whitespace checks pass.
- **Real browser playback, audible output, visual quality, saved-file playback, Windows performance and phone/tablet layout are not verified for this reset.** Local Chromium launch is restricted and the remote browser blocks local-file URLs. The logic checks do not substitute for a browser playtest.

Developer checks only (not required to play): `npm --prefix mixer ci`, then `npm --prefix mixer test`. Test fixtures simulate media and canvas; they do not claim pixel or sound verification.

## What was reset

The original root Jukebox and `omni/` app are unchanged. This reset replaces only the experimental mixer and its documentation/tests. Earlier attempts remain recoverable in Git:

- [Pack-based mixer before reset](https://github.com/kprasad1221/pixel-rhythms-jukebox/tree/8654b5b0624e37c9d4a0a3427334ba16059eb3b1/mixer)
- [Earlier two-deck study](https://github.com/kprasad1221/pixel-rhythms-jukebox/blob/8654b5b0624e37c9d4a0a3427334ba16059eb3b1/mixer/archive/two-deck-study.html)

The old `config.js`, `data.json` expectations, reference-image comparisons and scene-pack audio loaders are not used. Locally copied `mixer/media/` files can stay where they are; this app ignores them until selected through its picker.

## Continuity

The reviewed field logs establish the design footing, not tests of this reset:

- [Reactor H3 handoff and source map](https://app.notion.com/p/3e41f16ba962817d8144cdd570f83673)
- [One-screen playback and recording milestone](https://app.notion.com/p/3fc1f16ba962817e8098d7742e644398)
- [Scenes, cascading pads and finding a simpler interface](https://app.notion.com/p/4001f16ba9628129be9ef0b1a2b9ffb1)
- [Compare one JavaScript mixing gesture](https://app.notion.com/p/4021f16ba96281fb8a46e710a388ba67)
- Browser API references: [folder selection](https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/webkitdirectory), [Canvas blending](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/globalCompositeOperation).
