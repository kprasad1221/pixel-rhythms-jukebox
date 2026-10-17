# Pixel Rhythms · Omni prototype 0.1.8

## Record a pad performance

Play a pad, press **Record**, perform with pads / fades / volume / Pause, press **Stop**, then **Save video**. Recording is entirely local and sends no Reactor request. A timer shows when recording is active; Save becomes available after the browser finishes the video. The downloaded file contains the main pad picture and its mixed audio. It does not contain the interface, meters, or the separate Live Preview.

Output is 1280×720 at a requested 24 fps. The browser selects a supported format, usually WebM (VP8 + Opus) in Chrome/Brave. Both deck images are composited with their actual stacking order and fade opacity; audio is tapped after the master volume. Portrait or 4:3 clips are contained without cropping. Pause holds the picture while recording time continues and the paused deck falls silent.

The latest finished take stays in memory until the page closes or another recording finishes. Save downloads the video; it does not assign it to a pad. Keep this tab visible while recording; background-tab throttling and long recordings have not been validated. Save before refreshing. Existing media assignments and the IndexedDB schema are unchanged.

## Performance layout

Pads show **1–10**, independent of their editable names and current media. Keyboard shortcuts remain 1–5 and Q–T. Volume, fade and Pause now sit beside the main display, with Record and Save video underneath. On narrow screens those controls move below the picture and the volume slider becomes horizontal. The performance area sizes to the viewport; pad setup and the collapsible Activity log remain accessible below. Very short windows may still require scrolling to preserve usable controls.

## Update and first local check

1. End Reactor, then stop the server with Ctrl+C.
2. From `D:\Projects\reactor-jukebox-git`, run `git pull --ff-only`.
3. From `D:\Projects\reactor-jukebox-git\omni`, run `npm.cmd run dev`.
4. Refresh `http://127.0.0.1:8093`; the header should say **0.1.8**.
5. Play an existing pad; Record; switch to another pad; adjust volume; Stop; Save video. Open the downloaded video and check picture, dissolve and sound.

Live generation still uses its separate preview. Routing that stream into the main performance output is the next increment. No paid test is needed or authorized by this update; SDK 3.1.0 and the existing session safeguards are unchanged.

## Validation

Verified for this checkpoint: 44 offline checks and build pass. A Chromium recording was downloaded and decoded at 1280×720 with VP8 video and stereo Opus audio. Saved-frame samples verified red → blended → blue across the fade. Decoded audio changed from 440 Hz to 880 Hz, fell from about 0.160 RMS to 0.047 after the volume adjustment, became silent while paused, and resumed afterward. All main performance controls fit at 1366×768, 1920×1080, 1024×768, 768×1024 and 390×844. No token or external requests were made. This is an automated local test, not a test on KP’s Windows laptop or a live Reactor recording.

`npm test` runs offline checks; `npm run build` bundles the app. With Playwright and Chromium available, `npm run test:browser` covers the prior free preview / temporary pad clip / download / saved assignment flow. `npm run test:performance` records two known-colored audiovisual loops across a dissolve, volume adjustment and Pause; downloads and samples the saved video; checks viewport fit at laptop, tablet and phone sizes; and verifies no token or external request. Set `PLAYWRIGHT_MODULE_PATH` and `CHROMIUM_PATH` if those tools are installed outside this project. Browser-test artifacts are reported in the test output.

---
## Historical implementation notes

# Pixel Rhythms · Omni prototype 0.1.7

A ten-pad extension of KP's existing glass Jukebox. Same two playback decks, crossfades, master volume, waveform and stereo meters. Each pad can hold an existing loop, one Krea image, one Daydream reference, and an authored prompt. Musical variation in the generated soundtrack is intentional.

## 0.1.7: display incoming video first

This is a smaller integration step: **Check inputs → Show free live pattern → Generate and watch one clip**. Generate stays disabled until the free live-pattern display passes in this visit. The toolbar generation mode has been removed. Pads always play local loops/takes. Only the explicit **Generate and watch one clip** action can request paid generation after its one-attempt checkbox is enabled.

Incoming Reactor tracks are attached directly to the visible LIVE PREVIEW video element with `srcObject`, then the single clip's `play` command is sent. The preview starts muted, with native video controls available. `requestVideoFrameCallback` reports the first displayed frame and counts frame callbacks separately from SDK track availability or inbound decoded-frame stats. A rejected browser play, video-element error, or no displayed frame within eight seconds requests session cleanup. The preview is not a recorder: it creates no generated pad take and no downloadable video. Recording is deliberately absent from this generation path until direct display is verified.

On `clip_finished`, the session disconnects immediately; there is no capture/drain wait. Final frames may be cut short by disconnect or the unchanged overall deadline. The requested server session limit remains 30 seconds, the local attempt deadline remains 25 seconds, and disconnect failure still blocks further attempts in this page. These limits are unchanged; no new paid test was performed. The October 15 22:08 Anchorage attempt cost $0.21 by observed balance change and ended CLOSED. It decoded 139 video frames, but the previous recorder returned no usable bytes and the local deadline interrupted its final capture wait. That observation does not establish why recording failed.

First test after updating to **0.1.7**:

1. Open Arrange pads. Leave paid generation unchecked.
2. Click **Show free live pattern**. A moving rectangle and increasing frame number should appear in LIVE PREVIEW for three seconds. The result reports displayed frame callbacks. This uses a local canvas MediaStream attached to the same video element and helper as Reactor tracks; no recorder, API call, camera or microphone is used.
3. Share the free test result before considering another paid attempt. This is a local MediaStream display check, **not** proof of receiving Reactor WebRTC media.

The earlier free pad recording/download check remains in the collapsed **Earlier local recording test** section. It retains its temporary take behavior and does not replace original assignments. Existing generated takes from a previous visit are not made persistent by this change.

Verification: 41 offline tests and build pass. The Chromium browser check displayed 67 direct-stream frame callbacks at 640×360, then verified the independent free pad recording/playback/crossfade/download/reload path. It made zero token and external requests and reported no browser errors. An offline regression makes MediaRecorder construction throw and verifies that generation orchestration still attaches tracks, sends one play command, and disconnects. A local WebRTC peer-to-peer test could not establish ICE candidates in this execution environment; remote-stream behavior has not been reproduced here. No claim of live Reactor display or generated-video saving is made.

Update: End Reactor, stop the local server, `git pull --ff-only`, `npm.cmd run dev`, and refresh the same `http://127.0.0.1:8093` address. `.env.local`, SDK version, and IndexedDB schema are unchanged. This revision does not authorize another paid test. The older sections below are historical implementation notes.

## 0.1.6: restore connection handshake polling

The first 0.1.5 attempt stopped at `waiting` with `timed out: no SDP answer after 1 polls`, followed by completed SDK disconnect. No uploads or enqueue were logged. The added `maxAttempts: 1` connection option was wrong: the official [Reactor class reference](https://docs.reactor.inc/sdk-reference/reactor-class) defines it as maximum SDP polling attempts (default six), not generation retries. Removing the override restores normal handshake polling within the same session. The 25-second local attempt deadline, 30-second token session limit, automatic cleanup and single enqueue remain unchanged. A regression test models a pending handshake and verifies one token request, no single-poll override, and no generation command during connect. No live retest or paid request was performed for this correction. Update to 0.1.6 before considering a separately agreed attempt; check account usage for the failed attempt rather than assuming its charge.

## 0.1.5: bounded sessions and the free pattern through a real pad

Reactor bills GPU session time, including idle time after ready, rather than output clip duration. A request for a 5.875-second passage is not a cost limit. The previous stalled session lasted 2m41s. No additional paid run was made for this update.

Spending controls:

- The server requests `max_sessions: 1` and `max_session_duration_seconds: 30` on every model-scoped token. Reactor documents server termination after that duration, independent of browser cleanup. Token lifetime alone does not impose a session limit.
- One attempt has a 25-second local deadline, including input checks and connection time. Stalled connection, upload, commands, generation, reception or capture trigger non-recoverable SDK disconnect. Capturing a clip successfully also disconnects before local playback. Disconnect confirmation gets five seconds; if it fails or hangs, this page blocks further attempts and asks for an account check.
- No automatic generation retries. SDK connection polling uses its normal default; this does not enqueue additional generations. Duplicate attempts are blocked. The paid checkbox resets when an attempt begins, and successful generation returns the pads to Play loops.
- At the published $0.0125/sec rate checked October 15, 30 billable seconds would be $0.375. This is a rate-times-duration calculation, **not a verified account charge or a platform dollar cap**. Server enforcement and exact charges remain untested. The short session may end before a generation/capture completes. No future paid test is authorized by this update.

Free workflow after updating:

1. Open Arrange pads and select Pad 1 (or another pad without a generated take).
2. Click **Create free test clip for Pad 1**. It records three seconds locally, disables paid generation, switches to Play loops, and labels the pad **LOCAL TEST**.
3. Press Pad 1 in the ten-pad grid. The main screen and normal audio/crossfade path play the test. The small preview is optional.
4. With Pad 1 selected in the editor, click **Download Pad 1 test clip**. It requests a video and a JSON record identifying this as a synthetic test, not a Reactor generation. The browser may ask permission for multiple downloads. Check the downloaded video separately.
5. Reload clears the temporary take; the original assigned loop and prompts remain saved. A test never replaces an existing generated take; choose a different pad if one exists.

**36 offline checks pass**, along with the build and the separate Chromium pad/download check. Offline checks cover hangs at connection/upload/autoplay/enqueue/generation/play, duplicate attempts, disconnect failures/timeouts, zero-byte capture, and recorder-stop exceptions. Token-route tests assert that the server-side duration limit is included. The Chromium browser check exercises actual recording, pad playback, two-deck crossfades, both downloads, replaying downloaded bytes, and original assignment persistence after reload. These verify local behavior, not live Reactor reception or server termination.

Update with **End Reactor**, Ctrl+C, then:

```powershell
cd D:\Projects\reactor-jukebox-git\omni
git pull --ff-only
npm.cmd run dev
```

Refresh the same local address and look for **0.1.5**. No dependencies changed. Keep paid generation unchecked for the free workflow. `.env.local` and the browser database schema are unchanged.

Developer verification: `npm test` and `npm run build`. Optional browser check: install Playwright separately (`npm install --no-save playwright`, `npx playwright install chromium`), then `npm run test:browser`. A preinstalled Playwright module can be selected with `PLAYWRIGHT_MODULE_PATH` and a browser executable with `CHROMIUM_PATH`. The browser check launches its own server with an empty API key, aborts external HTTPS requests, and asserts zero token requests. It requires no authored media fixtures.

Sources: [Reactor billing](https://docs.reactor.inc/resources/billing), [token constraints](https://docs.reactor.inc/authentication), [server session-duration enforcement](https://docs.reactor.inc/resources/rate-limits), installed SDK 3.1.0 declarations/source. The older sections below describe previous versions and are retained as history; use the 0.1.5 instructions above.

## 0.1.3: isolate empty browser capture without another paid generation

KP's single 5.875-second test at 05:01 UTC on October 16 confirmed reference uploads, `clip_queued`, `clip_generated`, `clip_started`, and `clip_finished`. The browser recorder returned zero bytes; SDK disconnect completed. This confirms model-side generation and stream-send events. It does **not** confirm that frames/audio arrived in the browser or that the generated passage played locally. The cause of the empty capture is still unresolved.

**Next action is free:** after updating, leave paid generation unchecked, open Arrange pads and click **Test browser capture (no credits)**. This records three seconds of a local canvas pattern and synthesized tone, using the same capture helper as the Reactor stream. It requests no camera/microphone access and makes no API call. A separate, clearly labeled local test video appears below the controls. Press Play on that video; it is muted initially. A recording that plays verifies local browser capture/playback for this synthetic source, not live Reactor reception. Saved assignments and generated takes are not replaced by this test.

The real incoming path now records track `readyState`, `enabled`, and `muted`, plus mute/unmute/end events. It logs numeric inbound WebRTC byte/frame/sample counters before playout, at `clip_finished`, and after transport drain (when available). Recorder logs include its state, first nonempty chunk, empty events and final byte/chunk totals. Raw peer-connection data, candidate addresses and tokens are not logged. These observations separate missing incoming media from a recorder problem; they do not assume a cause.

Verification: build and **23** automated checks pass, including zero-byte failure, final-chunk delivery, encoder-error reporting, and inbound-stat filtering. Actual Chromium self-test generated a **68,445-byte** WebM with VP8 video and Opus audio; its 320×180 recording played in the browser. No token calls, external requests or browser errors occurred. The new editor/result was visually inspected. This was local synthetic media only; no second paid generation was performed during this update. The live capture failure remains open.

References: [MediaRecorder data delivery and stop ordering](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/dataavailable_event), [Reactor JavaScript class](https://docs.reactor.inc/sdk-reference/reactor-class), and the installed SDK 3.1.0 declarations. Reactor's `clip_finished` remains a model send event, not proof of a received/playable file.

Update in the Git checkout using End Reactor, Ctrl+C, `git pull --ff-only`, then `npm.cmd run dev`. Refresh the same address and look for **0.1.3**. Use the free capture test before considering another separately agreed paid attempt.

## 0.1.2: fix the stall after SDK ready

KP's first prototype log confirmed scoped token exchange, both output tracks and SDK `ready`, but no upload or enqueue. The readiness gate incorrectly read `reactor.status`; the installed SDK 3.1.0 exposes `reactor.getStatus()` instead. An undefined property kept the application in its waiting loop even after the ready event. The offline fake had repeated that incorrect property, masking the integration bug.

The gate and ready-session reuse now call `getStatus()`. The fake has private state and the same method as the SDK, and a regression check inspects the real installed class without connecting. Two added log entries distinguish completion of the SDK connect call from waiting for the autoplay command reply.

All **19** automated checks and the build pass. This is a correction to the readiness gate, not evidence that live upload, generation or generated-media capture succeeds. No paid retest was run during this fix.

For the new Windows Git checkout, use **End Reactor**, stop the server with **Ctrl+C**, then:

```powershell
cd D:\Projects\reactor-jukebox-git\omni
git pull --ff-only
npm.cmd run dev
```

Refresh the same local address and look for **0.1.2**. The private environment file and browser storage are unchanged. Agree a paid-test limit before retrying generation.

## Recovery update: make one attempt observable

This update keeps the ten-pad instrument and its existing IndexedDB database (`pixel-rhythms-omni-v1`). It does not modify `.env.local`, the server, SDK version, storage schema, or saved media assignments.

### Install into the existing Windows folder

1. With paid generation still disabled, stop the old server with **Ctrl+C**. If a Reactor session is already open, use **End Reactor** first.
2. Download this branch ZIP from GitHub and extract it into a temporary folder. Keep your existing `D:\Projects\reactor-jukebox\omni` folder.
3. From the extracted ZIP's `omni` folder, copy **only** `index.html`, `style.css`, and the entire `src` folder into `D:\Projects\reactor-jukebox\omni`, accepting replacement of these source files. Keep a backup copy of those three items if you have local source edits. Do not replace `.env.local` or delete any browser data. All other files can stay as they are; dependencies have not changed.
4. In PowerShell:

   ```powershell
   cd D:\Projects\reactor-jukebox\omni
   npm.cmd run dev
   ```

5. Open **http://127.0.0.1:8093** in the same browser/profile as before, then refresh. The heading should say **0.1.3**. Keep this exact host and port to retain the same browser assignments.

For a Git checkout with no uncommitted edits, pulling `codex/omni-jukebox-prototype` is an alternative to copying source files. Do not reset or clean your local checkout.

### First check: no credits

- **Arrange pads** opens the existing selected-pad inputs. The new **Generate selected pad** button sits beside those inputs. It requests one new passage when paid generation is enabled; it works regardless of the toolbar mode. Pads still generate in **Generate variations** mode and play clips in **Play loops** mode.
- Leave **Enable paid generation** unchecked. Use **Check inputs (no credits)**. This checks assigned fields, image decoding/dimensions, audio metadata/duration, and browser recording support without connecting to Reactor or uploading files. Passing is local readiness, not proof of server acceptance.
- An empty Daydream field shows **Choose this pad’s Daydream audio reference** in the missing-input list and in the result beside the button. A pad-triggered validation failure opens the relevant editor and scrolls this result into view.
- **Activity log** below the editor keeps the latest 200 timestamped events for this visit, newest first. **Copy log** copies those events for review/sharing. Logs are not saved across reloads. They do not intentionally include tokens, upload references, or prompt bodies; URL/token-like strings in error descriptions are redacted. Review descriptions before sharing.
- The log separates **Local validation → Connection → Upload → Request → Request acceptance → Generation → Reception → Capture → Playback**. These are observations, not promises that all stages will succeed. Uploads are logged separately. `clip_queued` is acceptance, `clip_generated` is readiness, `clip_finished` means media was sent by Reactor, and a nonempty capture still needs to play in the local Jukebox.
- Do not enable paid generation until we agree a small limit and verify current pricing. This update does not authorize or perform a paid test. To finish the free check, use **End Reactor**, then **Ctrl+C** in PowerShell.

### Verification for this update

- `npm run build` and all **17** automated tests passed, including simulated upload failure, refused/undefined enqueue, generation failure after acceptance, and simulated capture-stage reporting. Simulated media is not evidence that real Reactor capture works.
- Headless Chromium check with synthetic local media: all ten pads present; image + prompt but missing audio produces an in-view error; complete inputs pass the free check; paid-disabled Generate stops before token exchange; image/prompt assignments survive reload; two local clips play and crossfade. Zero token requests and zero browser errors in that check.
- The missing-input editor and log were inspected in a browser screenshot. Windows/iPad rendering and real service connection, reference uploads, generation, stream capture, and generated-take playback remain unverified. No paid run was performed.
- SDK **3.1.0** remains pinned. Reply/refusal and track behavior were checked against its installed declarations and the current [official Omni schema](https://docs.reactor.inc/model-api-reference/fast-h3-omni/schema) / [tutorial](https://docs.reactor.inc/model-api-reference/fast-h3-omni/tutorial). The [project handoff](https://app.notion.com/p/3e41f16ba962817d8144cdd570f83673) and its BPVR callback/loading source informed the separation of stages; archived code was not treated as verified SDK code.

## First run: arrange and play, with no API key

Requires Node 22+ (your recorded Node 24 setup is suitable). Download this branch as a ZIP and extract it to a new folder on D:, or clone this branch. Open PowerShell in this `omni` subfolder:

```powershell
npm.cmd install
npm.cmd run dev
```

Open http://127.0.0.1:8093. Keep the terminal open.

1. Open **Arrange pads**. All ten pads are present; keep the inherited names or rename them.
2. Choose a pad and assign its **Existing loop**, **Krea image**, **Daydream reference**, and **Direction**. Start by furnishing two or three pads, then fill the others when ready.
3. Use **Save pad**. **Play existing loop** auditions the chosen source. In **Play loops** mode the performance pads use the newest generated take if one exists, otherwise the existing clip.
4. Try the 0.5, 1.5, and 3-second fades. Mouse/touch and keys 1–5 / Q–T use the same actions.

No generation happens on opening the page, loading media, playing local loops, or changing a prompt.

## What to prepare

Per pad: one existing MP4/WebM (optional for generation, useful while waiting), one JPEG/PNG/WebP, one 2–15-second audio excerpt, and your authored prompt. Images/audio references must each be at most 25 MiB. Use an image below 25 megapixels and between 1:4 and 4:1.

Use `<Picture 1>` and `<Audio 1>` if helpful in the prompt. The app appends a short sentence assigning the picture as visual guidance and the audio as music guidance. It does not use an LLM to rewrite your prompt. Requested durations are the model's supported values, not arbitrary musical bar lengths.

All ten presets share the same implementation; there are no fake example generations and no placeholder media presented as yours. The layout is intended to preserve the existing instrument rather than redesign it.

## Enable Reactor later

First agree a small paid-test limit and check current Reactor pricing/account usage. This prototype has **no dollar spending cap**. No paid run was performed during source development.

Copy `.env.example` to `.env.local` in this `omni` folder. Privately copy the `REACTOR_API_KEY` value from your working Omni project's `.env.local` into this new file. Do not upload either environment file to GitHub or chat. Restart `npm.cmd run dev` after changing it.

In the app choose **Generate variations**, open **Arrange pads**, enable paid generation there only after agreeing a limit, then press a configured pad or **Generate selected pad**. One request is allowed at a time. It uploads that pad's two references, generates a fresh clip, receives the clip offstage, and crossfades the recorded result into the two-deck player. Your current local loop keeps playing while this happens. Repeated generation requests use the model's advancing seed; this app does not pin it.

The five-minute client session timer calls disconnect. It is a rehearsal convenience, not a billing guarantee; in-flight requests may still cost money. **End Reactor** explicitly disconnects and keeps local playback usable. To finish, click **End Reactor**, then press **Ctrl+C** in PowerShell. Closing a tab attempts cleanup, but is not the recommended shutdown method.

## Saving

Pad configuration and selected file copies use IndexedDB in this browser, tied to this local address. Use the same browser and `127.0.0.1:8093`. Browser storage can be cleared/evicted; keep original media backed up.

**Export prompt settings** downloads names/prompts/durations and reference filenames, not the media. Importing settings keeps current media assignments. Generated takes are held only for this page visit. **Save latest take** downloads the video and its prompt record; the browser may ask to allow the second download. Assign a saved take as an Existing loop to use it across visits.

## What is and is not verified

- Build and automated checks cover preset import, asynchronous clip matching, local token-route boundaries, and serving the SDK's WebAssembly asset.
- No paid generation, end-to-end Reactor media capture, or Windows laptop playback test has been performed. The 0.1.1 local browser checks are listed above.
- The recording uses browser MediaRecorder over Reactor's received video/audio tracks. It allows a short drain interval after `clip_finished`, which reports sent media. Captures may contain leading/trailing padding; audio/video alignment, capture format, seams and performance require testing. Seamless loops and beat alignment are not claimed.
- This version receives a complete passage before fading it in. Waiting includes model generation plus playback/capture time. Direct stream transitions are a later experiment.
- Reference audio steers the generated soundtrack; it is not substituted with the original Daydream track.
- No X delivery, physical MIDI integration, public hosting, or continuation between pads is included yet.
- The local server binds to loopback and serves an explicit file allowlist. It should stay on your laptop. The API key remains on the server; the browser receives only a scoped token. Selected references go to Reactor only when you request generation.

## Code map

- `index.html`, `style.css`: the ten-pad performance surface and collapsible setup.
- `src/player.js`, `src/meters.js`: local playback, crossfades, and audio feedback adapted from the original Jukebox.
- `src/app.js`, `src/pads.js`, `src/store.js`: pad actions, prompt configuration, and browser persistence.
- `src/activity.js`: bounded timestamped activity log with URL/token redaction.
- `src/capture.js`: shared browser recorder and local synthetic capture test.
- `src/reactor.js`, `src/events.js`: session lifecycle, reference uploads, matched generation events, and media capture.
- `server.mjs`: local files and server-side token exchange.
- `build.mjs`: bundles the browser code and copies its required WebAssembly asset.

Pinned transport: `@reactor-team/js-sdk` 3.1.0. This separate prototype does not change the dependencies of your existing local Reactor projects. The original root `index.html` remains the baseline.

To check after editing:

```powershell
npm.cmd run build
npm.cmd test
```

References: [Omni schema](https://docs.reactor.inc/model-api-reference/fast-h3-omni/schema), [Omni tutorial](https://docs.reactor.inc/model-api-reference/fast-h3-omni/tutorial), [original Jukebox baseline](https://github.com/kprasad1221/pixel-rhythms-jukebox/tree/18a5b4a01931187f9d6765118e0677934aa2b1de).
