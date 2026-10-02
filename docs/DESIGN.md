# Signify design direction

The reference images inform the treatment, not the medical product depicted in them. Signify centers hands, editable words, and the person across from you.

- Pearl `#edf0ee`: the quiet canvas.
- Graphite `#28322e`: primary text and deliberate actions.
- Frost `#f7f9f6`: conversation surfaces.
- Silver `#bcc3be`: camera welcome scene.
- Sage `#668371`: capture and connection feedback.
- Manrope gives large statements a soft, precise shape; DM Sans keeps controls readable. Fonts are served locally.

Desktop pairs the camera with an immediately editable conversation. Phone layouts stack these areas, with a live message preview inside the camera and a thumb-accessible navigation dock. The camera owns the visual emphasis; supporting tools stay restrained. The first pass was reviewed against the supplied references: glass is limited to camera overlays, instead of applied indiscriminately to every surface. No decorative performance metrics, synthetic confidence percentages, or fabricated translation appear in the welcome view.

```
Desktop                           Phone
brand / navigation / preferences brand / preferences
intro                             intro
camera          conversation      camera + live message
scope + demo                      conversation
quick phrases                     quick phrases
                                  floating navigation
```

Feedback follows actions: camera permission/loading states, landmark overlays, a settling progress bar, capture flash, optional vibration, and confirmation toasts. Reduced motion follows the OS preference. Haptics are progressive enhancement; all successful actions have a visual counterpart. Native dialogs provide keyboard focus containment and Escape dismissal.

## Generated artwork

`public/hand-study.png` was generated with the built-in image generation tool. It is decorative; use the inherited ASL reference chart for instruction.

Prompt:

> Use case: photorealistic-natural. Asset type: background artwork for an elegant sign language communication app, wide landscape 1536x1024. A beautifully photographed close-up of a single real human hand and forearm emerging from bottom center, palm toward camera, fingers naturally open and slightly curved, sculptural and expressive. Exactly five anatomically correct fingers. Hand is large centered, occupies middle 60% of composition with generous surrounding negative space. Soft grainy monochrome black and white editorial photography. Background is a seamless silver gray studio backdrop with soft atmospheric shadows, subtle defocus. Gentle directional window light from upper left, visible skin texture, dramatic yet serene premium technology campaign aesthetic. Wrist and lower forearm in a dark charcoal sleeve. No text, no UI, no symbols, no frame, no jewelry. This is decorative hand photography, not an instructional sign diagram.
