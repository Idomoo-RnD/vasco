# Idomoo design best practices — read BEFORE authoring a scene

A practical guide for designing personalized videos that communicate clearly, hold attention, and drive action. **Read this before writing the scene JSON** — it governs layout, hierarchy, typography, colour, and personalization decisions you bake into the IDM. Pair it with [motion-design.md](motion-design.md) (how things move) and [format.md](format.md) (how to express it in the scene format).

Based on the design principles deck by Yosi Bercovich (Head of Design) and Danny Kalish (CTO).

---

## How to use this guide

The guide is split into three parts:

1. **Core design principles** that apply to any visual communication.
2. **Idomoo Personalized Video (PV) capabilities and best practices** specific to dynamic, personalized, and interactive video.
3. **Production tips** for filming source footage such as talking heads.

Each principle pairs a short rule with the reasoning behind it and concrete do and don't guidance.

---

## Part 1: Core Design Principles

### Space

Give content room to breathe. Generous spacing prevents the viewer from feeling overwhelmed and lets them focus on what matters.

- Avoid filling every pixel. Empty space is an active design choice, not wasted area.
- Cluttered compositions (think a wall of billboards) bury the message. Clean compositions let a single product or idea lead.

### Less is more

Being minimalistic does not mean being timid. You can still be bold and brave with a restrained design.

- Reduce noise to increase legibility.
- Do not fill up every space with content.
- Avoid decorative elements that do not serve the message.
- "Don't shout." A loud, busy frame reads as cheap. A confident, simple frame reads as premium.

### Visual hierarchy

Hierarchy controls the order in which the viewer notices what they see. It improves scannability and readability so people find the important information faster.

- Always keep the business goal in mind. Decide what the viewer must see first, second, and third, then design to that order.
- Use the **stamp test**: squint or glance at the frame for a moment, then ask "what did I see first?" If it is not the most important element, adjust size, color, contrast, or placement.
- The brain processes images faster than text, so lead with a strong visual when speed of comprehension matters.
- Typical priority in a marketing frame: the product and the call to action should win the first glance.

### The F pattern

The most common eye movement pattern is the **F pattern**, because it mirrors how people read a book, a letter, or a web page (left to right, top to bottom, with attention concentrating on the top and left).

- Place the highest priority content along the top and left.
- Anchor secondary content where the eye naturally travels next.

### The rule of thirds

Divide the frame into a three by three grid. This grid predicts how and where a person will look at an image.

- Attention is not evenly distributed across the grid. The upper regions, and the upper left in particular, draw the most attention, while the lower right draws the least.
- Place your subject and key elements on the grid lines or at their intersections rather than dead center.

### Contrast

Contrast is strongest when two elements sit in opposition: dark and bright, thick and thin, modern and traditional.

- High contrast guides the viewer's eyes to the most important parts of the design first.
- Use contrast deliberately to create a clear focal point rather than letting everything compete equally.

### Proximity

Group similar or related elements together to create a relationship between them.

- Proximity is most useful in lists, calls to action, and menus.
- Spacing communicates grouping. Items placed close together read as belonging together. Items spaced apart read as separate.

### Alignment

Alignment creates a sharp, ordered appearance and reinforces the connection between elements.

- Keep a clear order and consistent sizing. This increases focus and directs the eye toward a single focal point.
- Misaligned, mismatched elements read as careless and scatter attention.

### Consistency

Keep your art direction focused. Do not mix too many styles. A coherent brand presence is a strength.

- Commit to a small set of stylistic choices and repeat them.
- Consistency builds recognition and trust across a video and across a campaign.

### Color

Color communicates on an emotional and subconscious level and can change the feel of a scene entirely.

- The same scene can look completely different depending on its color treatment, so pay close attention when designing templates.
- Apply brand colors consistently and strategically. This increases brand awareness and recognizability.
- Choose color to set emotional tone, not just for decoration.

### Imagery and look & feel

Photography and footage should feel like they belong to the same world.

- Ensure photographs look cohesive, as if shot under the same art direction and photographic style.
- Even a simple, consistent filter can unify a set of images and create a coherent look and feel.

### Text and fonts

Typography carries the message, so keep it disciplined.

- **Limit typefaces.** Using more than two different fonts makes a design look unstructured and unprofessional.
- Emphasize key (often dynamic) text by varying color, weight, or size rather than by adding another font.
- **Define fallback fonts** to handle unexpected or special characters gracefully.
- **Set default text inside each placeholder** with its parameters, or define a validation rule, so missing data never breaks the layout.

#### Text usage essentials

- Keep it short and lead with value.
- Use simple language that is easy to understand.
- Do not place text on a busy object or a bright background where it loses legibility.

---

## Part 2: Idomoo Personalized Video Capabilities & Best Practices

These practices apply specifically to dynamic, personalized, and interactive video produced with Idomoo PV.

### Motion and animated text

Animated elements are excellent for grabbing attention.

- Idomoo PV supports text rendered in a **middle layer** of the scene, not only as a flat overlay.
- Text animation is supported, so motion can be used to draw the eye to dynamic or personalized values.

### Cinematic "magic effect" text

Blended cinematic text moves through the scene to capture attention, set a tone, and entertain.

- Place dynamic text in interesting locations within the composition rather than always parking it in a caption bar.
- Because text can live in a middle layer, it can sit naturally inside the scene and feel integrated with the footage.

### Speech bubbles and background shapes

A speech bubble (also called a background shape) helps the viewer follow the story easily.

- The bubble **grows automatically** to fit the size of the dynamic text inside it.
- You can control the shape of the bubble.
- Text can be placed in 3D environments, not only flat 2D.

### Text in dynamic video

Dynamic text changes per viewer, so design the container, not just the words.

- **Define the text bounding box correctly** (paragraph text) so content has predictable limits.
- **Add a transparent dark layer on top of dynamic images** so overlaid text stays legible regardless of the underlying image.
- **Define the shrink and break line policy correctly** for dynamic text, so long or short values still fit and read well.
- **Define default text** inside each placeholder, or a validation rule, to handle missing data.

### Personalization best practices

- **Time the personalization well.** Personalized voice and text should appear early, but not too early. Videos often start muted, so a personalized greeting placed at the very start can be missed entirely.
- **Place the name in the thumbnail, off center.** Including the personalized name in the thumbnail is powerful, but keep it away from the exact center so it does not collide with the play button.
- **Give the personalization meaning.** Pair voiceover and visuals so the information lands, for example, "You will be happy to know that ...".
- **Help the viewer spot personalized content** by setting it apart with a different color, size, font, or other formatting.

### Interactive best practices

- **Hold the ending.** Pause or loop the video at the final call to action scene so the viewer is not left on a dead frame.
- **Add hover text** to give more information where it helps.
- **Encourage in-player customization** with a dedicated button (for example, a greeting the viewer can set).
- **Make clickable elements look clickable.** The design should make interactivity obvious.
- **Use a visited effect on menus** so viewers can see where they have already been (for example, a Ted Talk style menu).
- **A button can be any shape**, including a live action video element.
- **Converge all paths.** Every alternate path should end in the same final scene, so the completion rate metric stays meaningful.
- **Support long videos** (over two minutes) with swipe gestures and chapters.
- **Respect the player chrome.** Clickable areas should not overlap the player toolbars.
- **Separate primary from secondary.** Make sure the primary (default) call to action is clear and visually distinct from the secondary options.

---

## Part 3: Production Tips

### Filming a talking head

**Lighting**

- Use a 45 degree key light.
- Avoid over lighting and under lighting.
- Daylight is ideal.

**Composition**

- Use a tripod for a stable shot.
- Check the layout and leave a gap between the top of the head and the top of the frame.
- Align using a nine grid (rule of thirds) layout.
- Keep the background clean.
- Wear a plain shirt with no patterns.

**Audio**

- Check the audio quality before and during the shoot.
- Use a microphone whenever possible.
- Close windows and turn off electronic devices to reduce noise.

---

## Quick Checklist

Before shipping a personalized or interactive video, confirm:

- [ ] The most important element wins the first glance (stamp test passes).
- [ ] There is enough space and the frame is not overcrowded.
- [ ] No more than two typefaces are used.
- [ ] Dynamic text has a defined bounding box, shrink and break line policy, and fallback fonts.
- [ ] Placeholders have default text or validation for missing data.
- [ ] A transparent dark layer protects text legibility over dynamic images.
- [ ] Brand colors are applied consistently.
- [ ] Imagery shares a cohesive look and feel.
- [ ] Personalization appears early but not so early it is missed while muted.
- [ ] The personalized name in the thumbnail avoids the play button area.
- [ ] Clickable elements clearly look clickable and avoid the player toolbars.
- [ ] The primary call to action is distinct from secondary options.
- [ ] All interactive paths end in the same final scene.
- [ ] The video pauses or loops on the final call to action.
