# Pixel Rhythms — Two-Deck Mixer · 02

Open **`mixer/index.html`**. Click **Play Amber demo** in the main picture.

Two Memory Basin Amber clips are embedded in this HTML, with audio. A fresh clone can start without selecting files, restoring a media pack, running a server or opening an account. The starter copies are 896 × 512 previews; select your own original downloads for full source quality.

## Update the existing Windows checkout

Using KP's current checkout:

```powershell
cd D:\Projects\TEMP\pixel-rhythms-mixer
git pull --ff-only
Start-Process .\mixer\index.html
```

Close the previous tab first so the versions are easy to distinguish. The new screen says **TWO-DECK MIXER · 02**. The same HTML also works through the existing static server if preferred. To stop playback, use **Pause** or close the tab. To stop an old static server, Ctrl+C in its PowerShell window.

## First play

1. **Play Amber demo** starts A on air and prepares B in its preview.
2. Move the crossfader toward B, or press **Fade to B**. In **Dissolve**, the picture and embedded sound follow the fader.
3. Press **50 / 50**, then choose **Brightest** or **Add light** under Picture.
4. Choose **Deck A only** under Music to keep its soundtrack while mixing pictures.
5. Raise **Sound → light** to try brightness responding to the mixed music. **Scene color** changes the surrounding glow from colors sampled from the loaded clips.

The entire mixing panel stays on the main surface. Each deck holds one complete audiovisual clip. This version does not claim separate extracted lamps, fog or geometry, or multiple independent light voices within each deck.

## Own videos and folders

**Choose video folder** lists videos in a local folder and its subfolders. **Choose videos** selects individual files. Imports change the available pad list while the current decks keep playing.

Click **Deck A** or **Deck B**, then tap a pad to load it into that deck. Its preview and label show the assignment. **Replace selected deck…** chooses one local video directly without changing the pad library. A failed, timed-out or canceled replacement keeps the previous working deck.

- Filenames become pad labels. No prescribed names or companion JSON, WAV or reference images are required.
- Pads sort naturally by their folder path and filename. Subfolders appear in **Scene / folder**; more than ten clips use additional pad pages. Selecting a folder/group only changes browsing.
- Use original Krea MP4 downloads to retain their soundtrack. The older compressed ZIP clips were silent; they can still play as silent video.
- File choices last for the tab. Choose the folder again after changing files on disk, refreshing or reopening. The app does not watch folders or keep persistent browser copies.
- Local files remain on the device. The HTML makes no network requests and its content security policy blocks connections.
- Source decoding remains at original resolution, so very large replacements can cost more GPU/CPU work. The displayed/recorded composition is 1280 × 720.

## What the controls mean

| Control | Behavior |
| --- | --- |
| Deck A / Deck B | Selects which deck receives the next pad/file. The other deck keeps playing. |
| Crossfader | Moves between A and B. In Follow fader, audio gains are `1 − x` and `x`. |
| Fade to A/B | Moves the fader automatically over the chosen number of seconds. Manual movement cancels the automatic fade. |
| Dissolve | The usual picture crossfade. |
| Brightest | Combines weighted whole frames by keeping their maximum channel values. Both frames have full weight at the center; endpoints show only A or B. |
| Add light | Adds the weighted frames; the center may brighten or clip. Endpoints still show only A or B. |
| Music | Follows the fader or holds one deck's soundtrack. |
| Sound → light | Smoothed audio amplitude increases image brightness. It is not kick detection. Requires Canvas filter support. |
| Scene color | Samples a representative color when each clip loads and blends the surrounding accent with the fader. It is not a frame-by-frame color analysis. |
| Changes / Clock | Now, next beat or next bar on an adjustable manual clock, initially 120 BPM. Applies to prepared clip assignments and automatic fades. |
| Pause | Pauses both decks and the manual clock. |
| Record / Stop / Save video | Records the displayed mix and master audio, including fades and brightness effects. |

The clock schedules actions after media is ready. It does not analyze the videos' tempo, time-stretch audio, synchronize the clips' internal rhythms or make loop seams exact. The supplied Krea clips keep their native durations. Matching camera views are the most straightforward place to compare bright blending; camera motion can produce overlapping contours.

Keyboard: **1–5 / Q–T** load the currently visible pads, **D** switches the target deck, and **X** starts a fade toward the other side.

## Recording

The displayed canvas is also the recording source. Record requests 1280 × 720 at 24 fps with the master audio mix. Keep the tab visible while recording; background browser throttling may affect capture. Use **Record → Stop → Save video** and save before closing.

Folder changes and file replacement dialogs are disabled while recording. The already listed pads, fader, picture modes, music selection and pause remain usable. Stopping a recording releases the recording tracks while leaving deck playback running. A previous completed take remains available if a new recording fails.

## What was checked — November 2, 2026

- Both embedded MP4 previews fully decode with FFmpeg and contain H.264 video plus AAC audio. The original Amber A/B downloads also decode successfully.
- Twelve tests run the shipped app's state and interaction code with simulated browser media: embedded startup/demo, audio routing, crossfade/automation, folder paging, failed-load recovery, cancellation/timeout, manual clock scheduling, pause, recording lifecycle, brightness routing and direct deck replacement.
- Four tests use a real Canvas implementation to check blend pixel values: all endpoints, Dissolve midpoint, Brightest midpoint, Add light midpoint. These are rendering-arithmetic tests, not a browser video test.
- JavaScript syntax and Git whitespace checks pass.
- **Real browser playback, audible mixing, file export playback, responsive layout and laptop/iPad performance remain unverified for this build.** The execution environment restricts local Chromium, and the remote browser blocks local-file URLs. The tests above do not establish end-to-end browser success.

Developer checks, not needed to use the app:

```sh
npm --prefix mixer ci
npm --prefix mixer test
```

The bundled starter data lives in the `starter-media` JSON block inside the HTML, with a still poster in its CSS. It adds about 2.3 MB of base64 data but removes a separate media-copy step. Application logic is below that block. User-selected files always use their original bytes through local Blob URLs; the app does not recompress imports.

## Sources and continuity

Starter material is KP's supplied Krea output, with its existing soundtrack:

- [Memory Basin Amber A — original](https://app-uploads.krea.ai/public/dcd47bc6-ed29-43c9-ac9b-c5b63b1e47d4-video.mp4)
- [Memory Basin Amber B — original](https://app-uploads.krea.ai/public/8cf45d12-2fbf-4a93-9a80-b8a2ed7f05a3-video.mp4)

Preview preparation: 896-pixel width, H.264 CRF 24, AAC 128 kb/s, original duration (~5.184 s). The poster is a frame from Amber A.

The UI direction comes from KP's supplied two-deck Claude study and the existing Jukebox. The scene-pack loader, prepared music beds, reference-image subtraction and prior scene analysis are not part of this file.

- [Reactor H3 handoff](https://app.notion.com/p/3e41f16ba962817d8144cdd570f83673)
- [One-screen playback and recording milestone](https://app.notion.com/p/3fc1f16ba962817e8098d7742e644398)
- [Simpler scenes and pads](https://app.notion.com/p/4001f16ba9628129be9ef0b1a2b9ffb1)
- [One JavaScript mixing gesture](https://app.notion.com/p/4021f16ba96281fb8a46e710a388ba67)
- Browser references: [Canvas blends](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/globalCompositeOperation), [Canvas filters](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/filter), [folder selection](https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/webkitdirectory).
