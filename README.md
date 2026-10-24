# Gym Neutron — Confidence Catalyst launch site

*Select your element. Build your strength.*

Final culminating activity, Marketing × Web Development.
Raiven Contreras, Jefferson Haresco and Dale Ysmael Landoy, Mapúa Malayan Colleges Laguna, 2026.
Gym Neutron is a fictional gym.

A landing page for a free 30-day beginner challenge, with a scroll-driven 3D scene: procedurally
modelled bumper plates, an Olympic barbell, hex dumbbells and a kettlebell, built with Three.js,
GSAP ScrollTrigger and Lenis.

- **Live site:** https://thedalelandoy.github.io/gym-neutron/
- **Pitch deck:** https://thedalelandoy.github.io/gym-neutron/pitch/ (→ next, ← back, F fullscreen,
  P presenter view with notes and timer). PDF copy: `docs/Gym-Neutron-Pitch.pdf`.
- **Expired-offer preview:** https://thedalelandoy.github.io/gym-neutron/?now=2026-12-01T00:00:00%2B08:00#claim

## Run it

The 3D loads ES modules from CDNs, so open the site over `http`, not by double-clicking:

```
python -m http.server 5180 --bind 127.0.0.1
```

Then open http://127.0.0.1:5180/. Opened straight from disk, the page still works (form,
countdown, quiz) but skips the 3D.

To preview the expired offer, add `?now=2026-12-01T00:00:00%2B08:00` to the address.

## The three JavaScript features

| Feature | Where |
|---|---|
| Name, email, mobile, time and consent validation with a simulated confirmation (nothing stored or sent) | `js/logic.js`, `js/app.js` |
| Countdown to November 30, 2026, 11:59:59 PM PHT, with an expired promotion state | `js/logic.js`, `js/app.js` |
| "Select your element" quiz (four questions, four starting paths) | `js/logic.js`, `js/app.js` |

## Files

```
index.html                 the page
css/styles.css             layout, glass panels, responsive rules
js/logic.js                validation, countdown and quiz logic (no DOM; unit tested)
js/app.js                  wires the logic to the page
js/scene/main.js           renderer, post-processing, scroll cursor, render loop
js/scene/equipment.js      procedural plates, barbell, dumbbell, kettlebell
js/scene/rigs.js           the atom, the loadable bar and the dumbbell pair (shared with the deck)
js/scene/choreography.js   keyframes: what the 3D does in each section
pitch/                     the 7-slide pitch deck (same look and 3D as the site)
tests/logic.test.js        unit tests (npm test)
tools/                     headless capture, deck export and screenshot helpers
docs/PLAN.md               strategy, numbers and site plan
docs/TEST-REPORT.md        16 test cases with screenshots
docs/CONTRIBUTIONS.md      what each member did and how we used AI
docs/PITCH-SCRIPT.md       run of show, demo checklist, Q&A prep, how the code works
docs/Gym-Neutron-Pitch.pdf the slides as a PDF
```

## Campaign numbers (₱30,000)

4,800 visitors × 5% = 240 leads · 240 ÷ 4,800 × 100% = 5% lead conversion · ₱30,000 ÷ 240 =
₱125 per lead. Full working and scenarios are in `docs/PLAN.md` and the marketing plan.
