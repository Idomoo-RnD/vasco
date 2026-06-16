# Video design — the thinking behind good motion

The concept layer: story, shots, pacing, and animation craft — independent of the IDM/VASCO syntax. Read this first to decide *what* the video is and *how it moves*; then use [design-best-practices.md](design-best-practices.md) for layout/typography, [motion-design.md](motion-design.md) for execution craft (timing/easing/entrances), [format.md](format.md) for the scene syntax, and [recipes.md](recipes.md) for paste-ready patterns.

## Story first, always

Before animating a single frame, get the story straight:

- **Find the arc.** What is the beginning, the tension, and the resolution? Every piece, even a 10-second one, has one.
- **Name the message.** What is the single idea the viewer should walk away with? If you can't say it in one sentence, the video isn't ready.
- **Identify the characters and the tension.** Who or what is in conflict? The product vs. the old way, the user vs. friction, before vs. after. Tension is what holds attention.
- **Align before building.** Run the concept by the user/stakeholders first. Re-cutting an idea is cheap; re-rendering a finished video is not.

## Show, don't tell

- Prefer **showing** the idea over captioning it. Use titles and text only when they genuinely add something words do better than pictures.
- Ground scenes in a **real context** — a desk, a phone, a UI, a place. Elements floating in empty space read as unfinished. Give the action a world to live in.
- Open scenes with an **establishing shot** that sets the scene, then move in on the action.

## Think in shots

A scene is a sequence of deliberate shots. Decide what each one is:

- A slow push-in that starts wide and settles on the point of focus.
- A hard cut or rapid back-and-forth between two things in tension.
- A follow shot that tracks something — a cursor, a line on a graph, a character — as it moves.
- A reveal that builds an image or layout piece by piece.

Vary your shots. Sameness is the enemy of attention.

## Keep it alive

- **Something is always moving.** Except for a deliberate held beat, the camera, an element, or a transition should be in motion — a slow drift, a gentle zoom, a build. A truly static frame looks like a bug.
- **Images are never still.** Give photos and stills a slow zoom or pan (Ken Burns), or build graphics and text over them.
- **Let it breathe.** Give text and images time to land — on the order of seconds — before moving on. Pacing is a feature, not dead air.

## Animation craft

Apply the classic principles of animation:

- **Anticipation** — wind up before the action so the eye is ready.
- **Easing** — nothing in the real world starts or stops instantly; ease in and out.
- **Follow-through & overlap** — parts trail and settle after the main move.
- **Exaggeration** — push the motion a little past literal for clarity and life.
- **Staging** — compose each frame so the eye goes exactly where you want it.

## Following motion (walkthroughs & demos)

When the video follows a cursor, pointer, or moving subject, **move the camera with it** — a smooth, damped follow that zooms in on the action (the way a polished screen recording does). The viewer should never lose the thing they're meant to watch. In the IDM engine there are no live element refs, so compute target pixel positions from the layout and keyframe a `camera` layer (or a cursor image layer) along them with eased motion.

## Craft check

Before calling it done, ask:

- Is the message unmistakable?
- Does every shot earn its place?
- Is there a moment of stillness *and* a moment of energy?
- Does the pacing let the key beats land?
- Would the first three seconds make someone keep watching?
