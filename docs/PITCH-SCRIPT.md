# Gym Neutron — pitch script, demo and Q&A prep

8-minute presentation + 5-minute Q&A, in person.
Deck: https://thedalelandoy.github.io/gym-neutron/pitch/ (PDF copy: `docs/Gym-Neutron-Pitch.pdf`).
Site: https://thedalelandoy.github.io/gym-neutron/

Speaking parts below are a suggestion so each of us explains a part, as the brief asks. We built
everything together, so swap freely.

## Before you start (5 minutes early)

1. Open two browser tabs: the **deck** and the **site**. Check the venue Wi-Fi: the 3D loads from
   the internet. If Wi-Fi is down, present the PDF and demo the site from a phone hotspot.
2. Deck tab: press **F** for fullscreen. Press **P** to open the presenter view (notes, timer, next
   slide) and drag it to the laptop screen if the projector is set to extend.
3. Site tab: scroll back to the top. Have this ready to paste for the expired-state demo:
   `https://thedalelandoy.github.io/gym-neutron/?now=2026-12-01T00:00:00%2B08:00#claim`
4. Controls: **→ / Space / click** next, **←** back. On slide 3, each click adds one bonus and one
   plate. Slide 4 builds in three clicks.

## Run of show

| Time | Slide | Speaker | Say this (short version) |
|---|---|---|---|
| 0:00–0:30 | 1 Title | Raiven | "We're Gym Neutron. This is the Confidence Catalyst, our launch campaign for complete beginners. In eight minutes: who we target, the offer, how we spend ₱30,000, and the site, live." |
| 0:30–1:45 | 2 Problem | Raiven | "Our customer is the nervous first-timer: 18 to 30, lives near the gym, maybe paid once and quit. Price isn't the problem; these three fears are." Read the three fears. "So we sell certainty and safety, not access." |
| 1:45–3:15 | 3 Offer | Jefferson | Click once per bonus. "₱4,900 of value for ₱0. The No-Judgment Promise answers fear two. The 100 slots are real: it's how many orientations our coaches can run. We make money on the back end: finish 12 workouts and get 20% off a coaching pack." |
| 3:15–4:45 | 4 Numbers | Jefferson | Click 1: "Meta ₱18,000, TikTok ₱12,000, ₱1,000 a day." Click 2: read the three formulas. Click 3: "We call every lead within 5 minutes. 60% book, 70% show: about 101 people for 100 slots. 25 coaching packs bring about ₱64,000, 2.1 times what we spent." |
| 4:45–6:45 | 5 Live demo | Dale | Switch to the site tab. Follow the demo checklist below. |
| 6:45–7:30 | 6 Testing | Dale | "16 of 16 test cases passed on six screen sizes, including the expired state. If traffic is high but leads are low, the page is the problem, and we check these four things in order." |
| 7:30–8:00 | 7 Team | All | "We built this together, from idea to code. We used AI as a partner, as the class allows, and each of us can walk you through any file. Thank you; questions?" |

## Live demo checklist (2 minutes)

1. **Hero**: let the atom spin for a second. "Kettlebell nucleus, equipment on orbits: 'select your element'."
2. **Scroll to the offer**: the bar loads a plate per bonus and the total climbs to ₱4,900.
3. **Form, invalid**: press *Claim my free 30 days* with the form empty. Point at the summary and the message under each field.
4. **Form, valid**: fill `Juan Dela Cruz`, `juan@example.com`, `0900 000 0000` (a dummy number), a time, tick consent, submit. "Simulated confirmation: nothing is stored or sent."
5. **Quiz**: answer the four questions and show the element tile.
6. **Expired state**: paste the `?now=` link. "Same page, clock set to December 1: the countdown is replaced by 'offer closed' and the form locks."
7. **Phone layout**: open the site on a phone, or narrow the browser window.

## Q&A prep

**Why give it away for free? How do you make money?**
The free 30 days removes the biggest barrier, which is fear, not price. Revenue comes from
coaching packs after the challenge: 25 of 100 graduates at ₱2,560 is about ₱64,000 on ₱30,000 of
ads. Our free limited-access tier stays free afterwards, so anyone who doesn't buy stays in the
community.

**What if traffic is high but leads are low?**
Then the ads work and the page doesn't. In order: headline matches the ad hook, the page loads
fast on mobile data, the form is short with clear errors, the offer and deadline are visible
without scrolling. Change one thing at a time and compare page conversion day to day.

**Why split ₱18,000 Meta and ₱12,000 TikTok?**
Meta reaches 18–30-year-olds in Calamba most reliably and suits clean carousels and Reels. TikTok
is cheaper per visit and suits raw coach videos. Both point to one landing page, so we can compare
cost per lead and move money to whichever is cheaper after week one.

**Where did 5% conversion and ₱7.50 / ₱5.00 per visit come from?**
They're planning assumptions for a free local offer, stated as assumptions. We show a conservative
case (3%, 144 leads, ₱208 per lead) and a stretch case (7%, 336 leads, ₱89). Week one's real data
replaces them.

**What happens after 100 sign-ups?**
Registrations beyond 100 go on a waitlist for the next intake, because the limit is real coaching
capacity.

**Why ask for a mobile number as well as email?**
The brief requires name, email and consent. We added mobile because the front desk calls or texts
every lead within 5 minutes; a quick call is what turns a sign-up into a booked orientation.

**Is any personal data stored?**
No. The form validates in the browser and shows a simulated confirmation. There's no network
request, no local storage, and nothing in the address bar (we tested this, TC-05).

**How does the countdown know the offer ended?**
`getCountdown()` in `js/logic.js` subtracts the current time from a fixed deadline,
`2026-11-30T23:59:59+08:00`. If the result is zero or less, `expired` is true and `app.js` swaps the
countdown for the "offer closed" panel and disables the form. The `?now=` address lets us preview
any moment for testing.

**How did you make the 3D?**
With Three.js, all in code; there are no downloaded 3D models. Each piece is built from simple
shapes at real sizes: plates are a profile spun around an axis (`LatheGeometry`), the dumbbell heads
are extruded hexagons, the kettlebell handle is a tube along a curve. GSAP ScrollTrigger tells us
where you are on the page, and every value eases toward its target so nothing snaps.

**Does it work on phones?**
Yes. Below 900 px the layout becomes one column with the 3D on top, the menu collapses, and the 3D
drops its heavier effects. We tested at 390 and 360 px wide with no sideways scrolling.

**How much of this did AI do?**
We used AI as a design and coding partner, which our professor allowed. The ideas, the offer and
the numbers came from our plan, and we reviewed, tested and changed everything. Each of us can
explain the code; the walkthrough is below.

## How the code works

**Files.** `index.html` is the page structure. `css/styles.css` is all styling. `js/logic.js` holds
pure functions (no page access) so they can be unit-tested. `js/app.js` connects those functions to
the page. `js/scene/` is the 3D.

**Feature 1: form validation** (`js/logic.js` → `validateRegistration`, `js/app.js` → `initRegistration`)
1. On submit, `app.js` stops the browser's normal submit (`event.preventDefault()`) and reads the
   five fields.
2. `validateRegistration()` checks each field with its own rule: a first and last name using
   letters; an email pattern like `name@domain.com`; an 11-digit PH mobile (it also accepts `+63`);
   a time from the off-peak list; consent ticked. It returns an `errors` object.
3. `app.js` writes each error under its field, marks the field `aria-invalid`, shows a summary at
   the top and moves focus to the first problem. After the first attempt, errors clear as you type.
4. If there are no errors, it hides the form and shows the confirmation with the first name. Nothing
   is saved or sent.

**Feature 2: countdown and expired state** (`getCountdown`, `parseNowOverride`, `initCountdown`)
1. The deadline is a fixed date with a time zone: `2026-11-30T23:59:59+08:00`.
2. Every second, `getCountdown(now, deadline)` returns days, hours, minutes and seconds left, never
   below zero, and `expired: true` from the deadline on.
3. When expired, `showExpired()` hides the countdown, shows "offer closed", disables the submit
   button and relabels the claim buttons.

**Feature 3: element quiz** (`scoreQuiz`, `initQuiz`)
1. Each answer is worth one element: Fe (strength), O (cardio), Ca (mobility) or Nu (all-rounder).
2. `app.js` shows one question at a time and won't move on until one answer is picked.
3. `scoreQuiz()` counts the picks. The most-picked element wins; a tie goes to the first answer,
   since question one asks what you want most.
4. The result tile shows the element's number, symbol, plan and a button to the form.

**The 3D scene** (`js/scene/`)
- `equipment.js` builds each object from basic shapes at real sizes (1 unit = 1 metre).
- `rigs.js` assembles the atom, the bar that loads plate by plate, and the dumbbell pair.
- `choreography.js` lists a target pose for each page section; the page's scroll position becomes
  a number called the cursor (section 0, 1, 2, …), and the scene blends between neighbouring poses.
- `main.js` creates the renderer, lights and camera, reads the cursor through GSAP ScrollTrigger,
  eases every value toward its target each frame, and pauses when the tab is hidden. If WebGL or
  the internet isn't available, the page still works without the 3D.
