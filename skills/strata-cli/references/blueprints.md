# Blueprints — whole-video recipes by type

Structure-level recipes for the common video kinds. Each gives a beat skeleton, pacing, which [blocks](blocks.md) to use, and the narration shape — feed it into the storyboard stage (SKILL.md step 2), get sign-off, then author. All assume an audio-anchored timeline: I size each scene to the **narration's returned duration** and put **0.3–0.5s transitions** between clips. Default 1920×1080 (or 1080×1920 for social).

Pick one, adapt the beats, keep every layer name unique.

## Product launch / promo
**Arc:** hook → problem → product → proof → CTA. 6–8 beats, 20–40s.
1. **Hook** (0–3s) — bold title + a moving background (animated still or video). One sentence.
2. **Problem** (3–7s) — the old way / friction; kinetic text.
3. **Product reveal** (7–13s) — `device-frame` block with the product shot pushing in; a `lower-third` naming the feature.
4. **Benefits** (13–20s) — 2–3 `stat-card`s or feature cards, staggered.
5. **Proof** (20–25s) — `quote-card` (testimonial) or a logo wall.
6. **CTA** (25–30s) — `end-card` block; **hold** on it.
Narration ≤~20 words/beat; brand colours throughout; ≤2 typefaces.

## Explainer (faceless)
**Archetype:** concept · how-to · listicle · story. 4–8 beats, 30–90s.
- Open with an **establishing shot** that frames the topic; show, don't tell.
- One idea per beat; build diagrams/graphics over a calm background.
- Use `stat-card`/charts (see [recipes.md](recipes.md) data-viz) for any numbers.
- Close on a one-line takeaway + soft CTA.
Generate narration first, then pace beats to its word timings.

## Social promo (9:16, 5–15s)
- Frame **1080×1920**; reserve the bottom ~17% for captions/safe area; keep text in the title-safe ~90%.
- 2–4 punchy beats, fast 300–400ms transitions, big type, one message.
- Assume **muted autoplay**: lead with a strong visual + on-screen text; personalized value appears early but not at t=0.

## Data story / KPI
- A grid or stack of metrics; reveal each with a **count-up** + **bar/ring** (recipes.md data-viz).
- Animate the **reveal**, not the data (a mask wipe in the growth direction); the number/shape carries the value.
- Group related stats; one hero stat gets the biggest move/scale.

## Logo reveal / sting (3–6s)
- `logo-sting` block: logo scales/fades in with light overshoot, a quick accent (glow or a wipe), settle, hold.
- Optional tagline fades in under it; end on a clean hold.

## Website / app showcase
- Capture a screenshot of the site/app (the agent can use the browser tools), bring it in as an `image` layer.
- **Ken-Burns** the screenshot (slow scale+position) or place it in a `device-frame`; add kinetic **callouts** pointing at features (a small `solid` chip + a `lower-third`-style label, or an animated cursor image layer following the UI).
- Don't loop a captured screen-recording clip — cut to the next shot when it ends, or `playback_mode:"hold"`.

## Overlay an existing video (lower-thirds / captions / callouts)
- Put the source MP4 as a full-frame `video` layer at the back (`loop:false`; size the scene to the clip).
- Add `lower-third` blocks, callout chips, or a logo bug **on top**, timed to moments in the footage.
- Don't recolour the footage — the graphics are the only addition. Drop a subtle `solid` scrim only where text sits over busy areas.

---
**Always:** run it through the storyboard stage for sign-off; give every layer a unique name; verify the poster before calling it done (`strata snapshot`).
