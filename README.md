# Pixel Pets

A pixel-art pet that lives in a panel in your Explorer sidebar. Throw it a ball and it
runs after it. Click it and it gets hearts. Leave it alone for a minute and it falls
asleep. Good company while a build, a test suite, or an agent is running.

![The forest scene, with a cat](images/forest.png)



## Features

- **A pet in the Explorer.** It wanders, sits, and sleeps on its own schedule.
- **Fetch.** Click anywhere in the scene and a ball drops there, bounces, and the pet
  chases it down.
- **Pet it.** Click the animal itself for hearts.
- **Four pets** — cat, dog, fox, and a ghost that floats instead of walking.
- **Three scenes**, switched from the panel's title bar or settings.
- **Rock paper scissors** on `Ctrl+Alt+R`, in a quick pick that floats over the editor,
  terminal, or settings. Win a round and the pet gets a ball thrown for it.

| Night | Snow |
| --- | --- |
| ![Starlit pines with fireflies](images/night.png) | ![Snowfall over pale firs](images/snow.png) |

## Commands

All under **Pixel Pets** in the Command Palette, and in the panel's title bar:

| Command | What it does |
| --- | --- |
| `Pixel Pets: Throw Ball` | Drops a ball for the pet to fetch |
| `Pixel Pets: Choose Pet` | Cat, dog, fox, or ghost |
| `Pixel Pets: Next Scene` | Cycles forest → night → snow |
| `Pixel Pets: Play Rock Paper Scissors` | `Ctrl+Alt+R` (`Cmd+Alt+R` on macOS) |
| `Pixel Pets: Reset Score` | Clears the win/loss record |

## Settings

| Setting | Default | What it does |
| --- | --- | --- |
| `pets.species` | `cat` | Which animal lives in the Explorer. |
| `pets.theme` | `forest` | `forest`, `night`, or `snow`. |
| `pets.showStatusBar` | `true` | Rock-paper-scissors score in the status bar. |


## License

MIT
