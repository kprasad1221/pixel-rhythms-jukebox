# Pixel Rhythms — experimental mixer

> Historical notes for the earlier two-deck study. The active build and current setup instructions are in [../README.md](../README.md). This archived HTML still requires its own original `data.json`, which was not present in the later, simpler ZIP.

This is the separate `mixer` branch, starting from the latest existing Omni checkpoint, `2078d00`. The original Jukebox at the repository root and the working `omni/` prototype remain available. Open **`/mixer/`** to reach this experiment.

## Handoff status

KP supplied Claude's `index(4).html` on November 2, 2026. The first mixer commit preserves it verbatim as `mixer/index.html`. The next change adds startup checks and these setup notes; the mixing engine has not been redesigned.

**The companion `data.json` and media were not attached or present in either existing GitHub branch.** The HTML alone cannot recreate the six scenes. This checkout therefore shows **Scene pack not ready** until those files are restored. No original-media playback or Windows performance result is claimed.

Recover the complete project folder from Claude, including `data.json`, videos, reference images, thumbnails, prepared audio loops and any media-preparation scripts. Copy the contents beside `mixer/index.html`, preserving the relative subfolders used by `data.json`. Keep this branch's HTML when copying the pack. Do not include credentials or environment files.

The mixer itself uses local media, WebGL and Web Audio. It contains no Reactor client, API key field, live generation or paid-session request. The separate Omni folder still pins Reactor SDK **3.1.0**; that SDK is not loaded by this mixer.

## First local test — Windows PowerShell

Use a separate checkout so you can keep your current Jukebox folder as it is:

```powershell
cd D:\Projects
git clone --branch mixer https://github.com/kprasad1221/pixel-rhythms-jukebox.git pixel-rhythms-mixer
cd pixel-rhythms-mixer
npx.cmd --yes http-server . -a 127.0.0.1 -p 8094 -c-1
```

Node.js and Git must be installed. The first `npx` run may download the static server package. Open **http://127.0.0.1:8094/mixer/** in Chrome or Edge. This is a static server; it does not start the Omni backend.

1. Before restoring the pack, expect a clear missing-`data.json` message and a disabled Start button. This confirms you opened the experiment.
2. Restore the pack under `D:\Projects\pixel-rhythms-mixer\mixer\` and refresh. Missing media paths are reported before Start is enabled. The checks establish file availability, not codec support or correct analysis data.
3. With the complete original pack, press **Start with sound**. Intended behavior: Court on Deck A, Grove Roots on Deck B, with B in the cue preview. This remains to be verified against the recovered media.
4. Press **Fade to B**. In this imported design the fade waits for the next bar, then lasts the selected number of bars. Deck tabs change which deck's pads you edit; the crossfader changes what reaches the main output.

**Stop:** press Pause to stop playback, close the browser tab, then press **Ctrl+C** in PowerShell to stop the server.

For later code updates, stop the server, run `git pull --ff-only` inside `pixel-rhythms-mixer`, and run the server command again. Personal media and `data.json` are ignored by Git. Keep a separate backup of the complete media pack.

## Where the video choices live

This version has no file picker or saved browser assignments. Its source of truth is `mixer/data.json`, loaded at startup. Paths are relative to `mixer/`; use `media/clip.mp4`, for example, rather than a Windows `D:\...` path.

| Field | What it controls |
| --- | --- |
| `scenes[].id`, `name`, `look` | Scene identity and labels. Startup currently expects `court` and `grove-roots`. |
| `scenes[].plate_thumb` | Scene thumbnail and startup poster. |
| `scenes[].voices[].file` | Video for that pad. Video audio is muted. |
| `voices[].ref` | Reference still subtracted from the video when mixing light changes. |
| `voices[].thumb`, `label`, `colour` | Pad preview, name and RGB accent. |
| `voices[].kind` | `layer` loops; `move` plays once; `passage` plays once and changes scene. |
| `voices[].duration_s`, `fps`, `frames`, `size` | Clip timing and dimensions. Must match the replacement clip. |
| `voices[].offsets`, `light` | Per-frame alignment offsets and light measurements from the preparation stage. |
| `voices[].drift_max_px`, `adds_light_share`, `loop_note` | Imported analysis shown in the measurements table; not independently verified here. |
| `scenes[].beds[].file`, `take`, `bpm` | Separate audio-loop path, unique take identifier and source-tempo metadata. Voice `take` associates its metadata with a bed. |
| `scenes[].shared_audio`, `passage_to` | Shared music behavior and destination scene for a passage. |

For an equivalent re-export with unchanged framing and timing, replacing the corresponding media file can be enough. For a different Krea generation, update its related reference, metadata and audio together. Changing only `voices[].file` can produce misalignment, incorrect pad feedback or unexpected timing. The preparation scripts are needed to reproduce the original measurements; none came with this handoff.

The shader compares complete videos against reference stills. It does **not** separate fog, lights or architecture into true independent layers. “Brightest wins” chooses the strongest positive image difference; “Add light” sums them.

The imported transport is fixed at **125 BPM**. Audio beds were described by the imported UI as prepared two-bar loops. Editing the BPM label or `beds[].bpm` does not retime arbitrary audio. There are at most four voices per scene and six numbered scene shortcuts in this study. These are current assumptions to revisit after the original pack plays.

## Next small interaction pass

First restore and play the original two scenes. Then tackle one flow: **choose a clip → see which deck it belongs to → preview → fade it into the output**. A media picker is proposed, not implemented in this checkpoint. Its import path needs to handle reference images and analysis data as well as video selection.

Other observations to test with actual media: startup/loading feedback, pause during a pending scene change, rapid scene changes, passage preparation, and whether editing a cue deck is visually distinct from bringing it on air. Recording and live generation from Omni have not been integrated here.

## Validation for this checkpoint

`node --test mixer/tests/startup.test.mjs` passes nine checks of missing/malformed packs, asset availability, required scenes, WebGL failure and input before readiness. These execute the actual inline application script with DOM/canvas stubs. They do not verify rendering, decoding, sound or interaction feel. JavaScript syntax and Git whitespace checks also pass. A real browser run was unavailable in the development environment; original-media playback still needs the recovered pack and a local test.

## Continuity

- [Reactor H3 handoff](https://app.notion.com/p/3e41f16ba962817d8144cdd570f83673)
- [One-screen playback and recording milestone](https://app.notion.com/p/3fc1f16ba962817e8098d7742e644398)
- [Scenes, cascading pads and finding a simpler interface](https://app.notion.com/p/4001f16ba9628129be9ef0b1a2b9ffb1)

These sources establish the existing playable foundation and the unresolved browsing-versus-playing question. They are not evidence that Claude's new mixer has passed playback tests.
