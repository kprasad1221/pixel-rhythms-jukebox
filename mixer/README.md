# Pixel Rhythms — experimental mixer

The `mixer` branch now uses the complete `pixel-rhythms-mixer.zip` supplied on November 2, 2026. Open `/mixer/` to play it. The root Jukebox and `omni/` app are unchanged.

This ZIP is a **different, simpler Claude build** from the original attached HTML: six scenes, twelve light voices, one scene playing at a time, and crossfades between scenes. It uses `config.js`, not `data.json`. The earlier two-deck prototype is preserved in [archive/two-deck-study.html](archive/two-deck-study.html) and Git history. It still needs its own original manifest and is not the active playable build.

## Run on Windows

If you already cloned this branch:

```powershell
cd D:\Projects\pixel-rhythms-mixer
git pull --ff-only
```

For a new checkout instead:

```powershell
cd D:\Projects
git clone --branch mixer https://github.com/kprasad1221/pixel-rhythms-jukebox.git pixel-rhythms-mixer
cd pixel-rhythms-mixer
```

**Restore the media:** extract the supplied ZIP somewhere temporary. Copy only its `mixer/media` folder into `D:\Projects\pixel-rhythms-mixer\mixer\`. The result should include `mixer\media\clips`, `mixer\media\refs` and `mixer\media\music`. Keep the Git checkout's updated HTML and config files. Media remains local and is ignored by Git.

Then, from the repository folder:

```powershell
npx.cmd --yes http-server . -a 127.0.0.1 -p 8094 -c-1
```

Open **http://127.0.0.1:8094/mixer/**. The first `npx` run may download the static server. No build or Reactor key is needed. This page makes no Reactor requests.

1. Click **Memory Basin · Amber**. Its first light and music should start on the next bar.
2. Click **Amber B** to layer the other take. Light changes wait for the bar line, then fade over one beat.
3. Choose **Memory Basin · Turquoise** to test a scene crossfade. The Scene fade control determines its length.
4. Press **Pause**, close the tab, and press **Ctrl+C** in PowerShell when finished.

These are the first hands-on playback checks to do on KP's laptop. Automated logic and file-decoding checks are described below; browser rendering/audio quality have not been verified in this environment.

## Swap files without editing code

Play a scene, then expand **Change clips** below the controls:

1. Choose its **Light pad**.
2. Choose a **Replacement video**.
3. Optionally choose a **Reference image** and/or **Scene music**.
4. Click **Apply to this scene**. The current scene continues while the replacement loads; it changes on the next bar. If loading fails, the previous scene is retained.

A replacement video automatically uses its first frame as the reference unless you select an image. Replacing the video keeps the scene's music. Choose a separate music file to change that too; WAV and MP3 are straightforward choices. The supplied MP4s are silent, so selecting one as music will not provide a soundtrack. Audio decoding from other video containers depends on browser support.

Changes last **until the page reloads or closes**. They remain when visiting other scenes in the same tab. **Restore this scene** brings back its original files and releases unused temporary media. Files are not uploaded, copied into Git, or saved in browser storage by this panel. Keep your original files separately. This first swapping step edits existing pads; adding scenes/pads and saving an arrangement are separate next changes.

For a permanent assignment, place files under `mixer/media/` and edit the relevant scene in `config.js`. Each scene has `name`, optional `music`, and up to four `voices`; each voice has `name`, `video`, optional `ref`, and optional `color`. Paths are relative to `mixer/`. After saving, refresh. There is no per-frame analysis file to regenerate in this packaged build.

## What the mixer is doing

It compares each complete video against a still reference frame, adding bright differences and averaging dark differences. This does not isolate lights or fog as independent layers. Related takes from the same fixed camera view work best; camera motion or mismatched framing can produce ghosting. Higher-resolution replacements are accepted but increase decoding/upload work, so first swap one clip and judge laptop responsiveness.

The provided pack contains fourteen H.264 MP4s, fourteen JPEG references and ten WAV loops. Twelve videos and six music loops are assigned in `config.js`. Grove B (passage) and Observatory C (camera push-in), plus alternate music loops, are preserved in the pack but not assigned in this simpler build.

The videos are 896 pixels wide, 500 or 512 pixels high, about 4.48–5.21 seconds long, and contain no embedded audio. The stereo WAVs are 32 kHz, 16-bit, and exactly 3.84 seconds: two 4/4 bars at **125 BPM**. The transport stays at 125 for this pack. The videos themselves have different lengths and are not beat-synchronized. Changing `bpm` changes scheduling; it does not time-stretch replacement music or video.

## Validation and limits

- All thirty configured file paths resolve in the supplied pack.
- All fourteen videos and ten audio loops decode fully with FFmpeg without errors.
- Ten integration checks execute the actual app and DOM with simulated video/audio/GPU services: scene switching, queued lights, pause, replacement/reference/music choices, reset, failed-load rollback, resource cleanup and competing clicks.
- Nine checks for the archived two-deck startup continue to pass.
- JavaScript syntax and Git whitespace checks pass.

The headless browser could not launch under this environment's socket restrictions. The checks above do **not** establish real browser rendering, sound, timing accuracy, loop seams, Windows performance or iPad behavior. No paid generation was attempted.

Developer checks (not needed to play): `npm --prefix mixer ci`, then `npm --prefix mixer test`. The DOM-only integration tests deliberately simulate media and GPU services; use the actual clips in a browser for visual/audio judgments.

## Project continuity

- [Reactor H3 handoff](https://app.notion.com/p/3e41f16ba962817d8144cdd570f83673)
- [One-screen playback and recording milestone](https://app.notion.com/p/3fc1f16ba962817e8098d7742e644398)
- [Scenes, cascading pads and finding a simpler interface](https://app.notion.com/p/4001f16ba9628129be9ef0b1a2b9ffb1)

The existing Omni recording/live-generation features have not been integrated into this mixer. The first experiment is to play the supplied scenes and swap one light voice, then refine what the controls mean through use.
