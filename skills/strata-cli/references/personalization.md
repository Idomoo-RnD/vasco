# Personalization & data-driven batch — one template, many videos

Idomoo's superpower: a single IDM is a **template** whose layers are **placeholders** replaced per-viewer at generate time, keyed by **layer name**. The animation, layout, effects, and timing stay exactly as authored; only the *content* (a text value or a media asset) swaps. This is how you render thousands of personalized variants from one scene — something pure motion-graphics tools can't do.

## Author the template for replacement
- **Name every layer meaningfully and uniquely** — names are the replacement keys (`first_name`, `hero_photo`, `monthly_amount`, `cta_label`). Duplicate names are both a render bug (auto-uniquified) and a personalization hazard — keep them distinct.
- **Text** — assume values longer *and* shorter than your sample. **Text auto-fits its box** (the compiler defaults `shrink:true`), so a long value scales down to fit rather than overflowing — verified: a long name in a fixed box shrinks while a short one stays large. Still give generous box width and set a `min_size` if you don't want it shrinking below a floor; opt out with `"shrink": false`. Choose alignment deliberately (left-aligned grows right; centred grows both ways). Never split one personal value across hand-positioned layers. Put a realistic **long** sample in the scene so the layout is proven against the hard case.
- **Media** — assume any aspect ratio arrives. `fit:"fill"` for full-bleed slots (crops to cover) or `fit:"fit"` over a designed backdrop (letterboxes). Anchor at the box centre so Ken-Burns works on any replacement.
- **Animations are content-agnostic** — per-character text animators adapt to any string; prefer `percentage` range units over `index` so 6- and 14-character names both cascade.
- **Graphs/charts** — author at the canonical/full state and animate the *reveal*; the swapped image carries the data (see data-viz recipes).

## The batch flow (concept)
1. Build and approve **one** scene; confirm it renders (`strata render … --library <id>`).
2. Prepare a **data set** — a JSON/CSV with one row per viewer, columns = layer names → values (text or a media URL/path):
   ```json
   [ { "first_name": "Dana", "monthly_amount": "$48", "hero_photo": "./a.jpg" },
     { "first_name": "Marco", "monthly_amount": "$112", "hero_photo": "./b.jpg" } ]
   ```
3. Render one variant per row, supplying that row's values as **data-points** keyed by layer name. Each render reuses the **same library and template**; only the data changes.
4. Collect the resulting `video_url`s (one per row).

## Notes
- Keep all variants in **one library** (don't mint a new library per render).
- Time the personalized reveal **early but not at t=0** — videos often start muted, so a name shown at the very start gets missed.
- Give personalized content a visual tell (distinct colour/size/weight) so the viewer notices it's about them.
- Pair voiceover with the visual so the personal value lands ("Dana, you saved $48 this month…").
- For the cloud-managed brief/blueprint flow (not local IDM authoring), use the separate `idomoo` CLI.
