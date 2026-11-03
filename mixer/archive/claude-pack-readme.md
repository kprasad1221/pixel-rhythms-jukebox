# Pixel Rhythms Mixer

Step 1 of layering light voices in the Jukebox. One scene plays at a time. Its lights layer on top of the scene's still first frame, and every change lands on the next bar.

The original jukebox in the folder above is unchanged.

## Run locally

Same as the original. With Node.js installed, open a terminal in this `mixer` folder and run:

```sh
npx --yes http-server . -a 0.0.0.0 -p 8000 -c-1
```

In Windows PowerShell, use `npx.cmd` if script execution policy blocks `npx`.

Open http://127.0.0.1:8000. Keep the terminal open; Ctrl+C stops the server. The page needs to be served like this; opening `index.html` straight from disk blocks the video layering.

## Add media

Media is not stored in Git. Unzip the media pack into this folder so you have:

```
mixer/
  index.html
  config.js
  media/
    clips/   silent video loops, one per light
    refs/    a still of each clip's first frame
    music/   two-bar music loops at 125 BPM
```

## Assign your own clips

Open `config.js`. Each scene has a name, an optional music loop and up to 4 voices. Each voice points at a video file. Save the file and reload the page.

- A voice should be the same shot as the others in its scene, with the camera held still. The mixer subtracts each clip's first frame, so only the light it adds is layered.
- `ref` is optional. Without it, the mixer uses the clip's first frame, which suits raw Krea H3 downloads.
- Clip audio is ignored. The scene's `music` file plays underneath and sets the bar grid. Set `bpm` at the top of `config.js` to match it.

## Controls

| Control | What it does |
| --- | --- |
| Scene pads, keys 1–8 | Switch worlds. The new scene comes in on the next bar and fades over the length set in Scene fade. |
| Light pads, keys Q W E R | Turn a light on or off. It fades in or out over one beat, starting on the next bar. |
| All off, key T | Turn every light off on the next bar, back to the still. |
| Space | Pause and resume. |

A blinking dot and a filling strip on a pad mean it is waiting for the bar line. Each scene remembers which lights you left on.

## What this step leaves out

These were tried in the hosted study and come back one at a time, each tested by playing before the next:

1. Hold a light pad to solo it.
2. A second deck and a crossfader for A/B between scenes.
3. Passages: a clip that plays once and leads into another scene (Grove B).
4. One-shot camera moves (Observatory C).
5. Lights that pulse with the kick.
6. A "brightest wins" layer mode.
