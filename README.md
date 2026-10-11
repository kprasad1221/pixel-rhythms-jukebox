# Pixel Rhythms Jukebox

A tactile browser instrument for playing visual music. Work in progress.

Tap a pad to switch audiovisual loops. The prototype combines a glass MIDI-inspired layout, a 0.5-second picture-and-sound crossfade, a vertical volume fader, and audio-driven meters and waveforms.

## Run locally

A single HTML file with no build step. With Node.js installed, open a terminal in the project folder and run:

```sh
npx --yes http-server . -a 0.0.0.0 -p 8000 -c3600
```

In Windows PowerShell, use `npx.cmd` if script execution policy blocks `npx`.

Open http://127.0.0.1:8000 on the serving computer. For a phone or tablet on the same Wi-Fi, use `http://YOUR-COMPUTER-LAN-IP:8000`. Allow Node.js through the firewall on your trusted private network if prompted. Keep the terminal open; Ctrl+C stops the server.

This enables one hour of caching. After editing HTML, use a hard refresh or temporarily use `-c-1` during development to avoid seeing a cached version.

## Media

Videos are not included. Place local MP4s beside `index.html`, using these exact filenames, or edit the `stems` list in the script:

| Pad | Scene | Party |
| --- | --- | --- |
| Mountain | Mountain_s.mp4 | Mountain_p.mp4 |
| Car | Car_s.mp4 | Car_p.mp4 |
| Glacier | Glacier_s.mp4 | Glacier_p.mp4 |
| Tree | Tree_s.mp4 | Tree_p.mp4 |
| Ocean | Ocean_s.mp4 | Ocean_p.mp4 |

Each video's embedded audio supplies its music. Back up media separately; `.gitignore` excludes it from normal Git adds. A clone of this repository needs local media to play.

## Controls

- Tap/click a pad to start playback with sound.
- Keys 1–5 select Scene clips; Q, W, E, R, T select Party clips.
- The volume fader controls the mixed output; Pause/Play controls playback.
- Pads lock during loading and transitions. The pending indicator blinks and a progress strip follows the fade.

## Prototype limits

Crossfading does not synchronize beats or keys. Incoming playback starts before the entire file is necessarily buffered, so network throughput and media size can affect playback. Layout and device performance remain areas for refinement.

No backend or API key is required.
