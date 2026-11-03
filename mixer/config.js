// Pixel Rhythms mixer — your scenes, clips and music.
// Edit this file to assign media. Paths are relative to this mixer folder.
// For temporary swaps, play a scene and open "Change clips" in the page.
// Those swaps last for this tab only; this file is the saved starting setup.
//
// A scene is one world: a music loop plus up to 4 light voices.
// Each voice is a video of the same shot with a different light performance.
// The mixer layers the light each voice adds on top of the scene's still first frame.
//
//   video  (required) the clip. Its own audio is ignored; music comes from the scene.
//   ref    (optional) a still of the clip's first frame. Leave it out and the mixer
//          grabs the first frame itself, which works for Krea H3 downloads because
//          they start on the source image. The prepared clips include refs because
//          some of them were seam-crossfaded and no longer start on that image.
//   color  (optional) the pad colour for this voice.
//   music  (optional, per scene) a loop that plays under the scene. A WAV cut to
//          whole bars loops cleanly. You can also point it at an MP4 to use that
//          clip's soundtrack if your browser can decode its audio. The supplied
//          MP4s are silent. A 5.2 s H3 soundtrack won't land on the bar.
//
// Up to 8 scenes (keys 1–8) and 4 voices per scene (keys Q W E R).

window.MIXER_CONFIG = {
  bpm: 125,
  scenes: [
    {
      name: 'Memory Basin · Amber',
      music: 'media/music/basin_amber_a.wav',
      voices: [
        { name: 'Amber A', video: 'media/clips/basin_amber_a.mp4', ref: 'media/refs/basin_amber_a.jpg', color: '#ffa260' },
        { name: 'Amber B', video: 'media/clips/basin_amber_b.mp4', ref: 'media/refs/basin_amber_b.jpg', color: '#ffbd60' },
      ],
    },
    {
      name: 'Memory Basin · Turquoise',
      music: 'media/music/basin_turq_a.wav',
      voices: [
        { name: 'Turquoise A', video: 'media/clips/basin_turq_a.mp4', ref: 'media/refs/basin_turq_a.jpg', color: '#60d7ff' },
        { name: 'Turquoise B', video: 'media/clips/basin_turq_b.mp4', ref: 'media/refs/basin_turq_b.jpg', color: '#60f1ff' },
      ],
    },
    {
      name: 'Ancient Grove · Shore',
      music: 'media/music/grove_a.wav',
      voices: [
        { name: 'Grove A', video: 'media/clips/grove_a.mp4', ref: 'media/refs/grove_a.jpg', color: '#60ffd7' },
        // Grove B is the passage into the Roots. Passages come in a later step.
      ],
    },
    {
      name: 'Ancient Grove · Roots',
      music: 'media/music/grove_c.wav',
      voices: [
        { name: 'Grove C', video: 'media/clips/grove_c.mp4', ref: 'media/refs/grove_c.jpg', color: '#ffc46b' },
        { name: 'Grove D', video: 'media/clips/grove_d.mp4', ref: 'media/refs/grove_d.jpg', color: '#60f1ff' },
      ],
    },
    {
      name: 'Stellar Tide Court',
      music: 'media/music/court_a.wav',
      voices: [
        { name: 'Court A', video: 'media/clips/court_a.mp4', ref: 'media/refs/court_a.jpg', color: '#ffbd60' },
        { name: 'Court B', video: 'media/clips/court_b.mp4', ref: 'media/refs/court_b.jpg', color: '#60f1ff' },
        { name: 'Court C', video: 'media/clips/court_c.mp4', ref: 'media/refs/court_c.jpg', color: '#b49cff' },
      ],
    },
    {
      name: 'Celestial Observatory',
      music: 'media/music/obs_a.wav',
      voices: [
        { name: 'Rings', video: 'media/clips/obs_a.mp4', ref: 'media/refs/obs_a.jpg', color: '#ffbd60' },
        { name: 'Moon', video: 'media/clips/obs_b.mp4', ref: 'media/refs/obs_b.jpg', color: '#ffd98a' },
        // Observatory C (the push-in) moves the camera, so it can't layer. It comes back with one-shots later.
      ],
    },

    // Example: a raw Krea download with no ref and its own soundtrack as the music.
    // {
    //   name: 'My new world',
    //   music: 'media/clips/my-take-a.mp4',
    //   voices: [
    //     { name: 'Take A', video: 'media/clips/my-take-a.mp4' },
    //     { name: 'Take B', video: 'media/clips/my-take-b.mp4' },
    //   ],
    // },
  ],
};
