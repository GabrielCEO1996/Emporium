---
name: frontend-design
description: Create distinctive, production-grade frontend interfaces with high design quality. Use this skill when building web components, pages, artifacts, posters, or applications (websites, landing pages, dashboards, React components, HTML/CSS layouts, or when styling/beautifying any web UI). Generates creative, polished code and UI design that avoids generic AI aesthetics.
---

# Frontend Design — Premium Web Interfaces

## Core Philosophy

Generic AI-generated UI looks like everything else: rounded corners, soft gradients, centered cards, predictable spacing. **Avoid the AI aesthetic.** Real design has opinion, restraint, and craft.

When designing, ask yourself:
- Would Apple ship this?
- Would Aesop put this on their site?
- Does it have a point of view?

If the answer is no, iterate.

## Design Principles

### 1. Typography first
Typography carries 80% of the design. Get it right before anything else.

- **Pair a serif with a sans-serif.** Serif (Cormorant Garamond, Playfair Display, Fraunces) for headlines. Sans (Inter, GT Walsheim, system-ui) for body and UI.
- **Use only 2-3 sizes.** A page with 7 text sizes feels chaotic. Headlines, body, caption — that's enough.
- **Generous line-height.** Body: 1.6-1.8. Headlines: 1.05-1.15.
- **Letter-spacing on uppercase.** Always 0.05em-0.3em on UPPERCASE labels.
- **Italic for emphasis, not bold.** Italic feels editorial. Bold feels heavy.
- **Avoid font-weight 600 or 700.** Use 400 regular, 500 medium. Heavier is amateur.

### 2. Restraint over decoration
- **No gradients on backgrounds.** Solid colors only. Maybe a 2-tone fade for hero sections.
- **No drop shadows.** Use borders, position, or spacing to create hierarchy.
- **No glow, blur, or neon.** Ever.
- **No "glassmorphism" except sticky nav.** It's overused.
- **No emoji in UI.** Use SVG icons instead.

### 3. Color discipline
- **Pick 3 colors maximum.** One neutral (cream, off-white, charcoal), one accent, one for action.
- **Use the same palette consistently.** Don't introduce new colors per section.
- **Premium palettes lean warm.** Cream #fafaf7, gold #d4a574, forest #2d4a3e, charcoal #0a0a0a.
- **Avoid pure white #ffffff and pure black #000000.** They look harsh. Use #fafaf7 and #0a0a0a.

### 4. Spacing breathes
- **Generous whitespace.** Section padding 60-80px desktop, 40-60px mobile.
- **Vertical rhythm.** Use consistent multiples of 8px or 12px.
- **Cards have padding 24-32px.** Not 16px.
- **Margin between sections: 80-120px.**

### 5. Motion with purpose
- **Animations should have meaning.** Don't animate just because.
- **Use cubic-bezier(0.16, 1, 0.3, 1)** for "ease-out-expo" — feels premium.
- **Stagger reveals.** Items appear 100-150ms apart, not simultaneously.
- **Parallax sparingly.** Only 1-2 elements per page.
- **Scroll-driven > time-driven.** Content reveals as user scrolls feels intentional.

### 6. Composition
- **Asymmetry is interesting.** Centered everything is boring.
- **Use the rule of thirds.** Hero text at 1/3 from left, image fills the rest.
- **Big numbers.** Stats should be 48-96px serif, not 24px.
- **Editorial layout.** Magazine-style with mixed alignments.

## Tech Stack for Premium Web

### Required libraries
```bash
npm install gsap lenis
npm install -D @types/gsap
```

- **GSAP + ScrollTrigger** — Industry standard for scroll-driven animations. Used by Apple, Nike, Awwwards winners.
- **Lenis** — Smooth scroll (essential for premium feel).
- **Framer Motion** — Component-level animations (fade-in, hover effects).

### Font loading
Use `next/font` for performance:
```tsx
import { Cormorant_Garamond, Inter } from 'next/font/google';

const serif = Cormorant_Garamond({ subsets: ['latin'], weight: ['400', '500'] });
const sans = Inter({ subsets: ['latin'], weight: ['400', '500'] });
```

### Color system (Tailwind config or CSS variables)
```css
:root {
  --bg-cream: #fafaf7;
  --bg-dark: #0a0a0a;
  --accent-gold: #d4a574;
  --accent-forest: #2d4a3e;
  --text-primary: #1a1a1a;
  --text-muted: rgba(0, 0, 0, 0.55);
  --border-subtle: rgba(0, 0, 0, 0.08);
}
```

## Patterns

### Hero — Cinematic Reveal
```tsx
useEffect(() => {
  const ctx = gsap.context(() => {
    gsap.to('.hero-image', {
      scale: 0.5,
      y: -100,
      scrollTrigger: {
        trigger: '.hero',
        start: 'top top',
        end: 'bottom top',
        scrub: 1,
      }
    });
  });
  return () => ctx.revert();
}, []);
```

### Stagger reveal on scroll
```tsx
gsap.from('.product-card', {
  y: 60,
  opacity: 0,
  stagger: 0.1,
  duration: 1,
  ease: 'expo.out',
  scrollTrigger: {
    trigger: '.products-grid',
    start: 'top 80%',
  }
});
```

### Smooth scroll setup
```tsx
import Lenis from 'lenis';

useEffect(() => {
  const lenis = new Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  });
  
  function raf(time: number) {
    lenis.raf(time);
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);
  
  return () => lenis.destroy();
}, []);
```

## Reference Sites — Study These

- **apple.com/apple-vision-pro** — Scroll-driven storytelling
- **aesop.com** — Restraint, typography, color
- **glossier.com** — Warmth, photography
- **hims.com** — Wellness commerce
- **olivia-burton.com** — Premium product detail
- **diptyqueparis.com** — Editorial luxury
- **lemonade.com** — Friendly premium

## Anti-patterns — Never Do This

❌ Centered hero with gradient bg + 4 feature cards in a row  
❌ "Hero text — Subtitle text — CTA button" boilerplate  
❌ Purple-to-pink gradients  
❌ Glassmorphism on everything  
❌ Material Design icons in a premium site  
❌ Stock illustrations from Storyset/unDraw  
❌ "We help X do Y better" copy  
❌ Testimonial cards with circular avatars in a row  

## Workflow

When designing a new page:

1. **Find 3 reference sites** that match the vibe. Save screenshots.
2. **Define the palette** — 3 colors, no more.
3. **Pick the typography** — 1 serif + 1 sans.
4. **Sketch the structure** — what goes in each section?
5. **Build mobile-first** — design works on 375px, then expand.
6. **Add animations last** — never let animation hide bad design.
7. **Critique honestly** — "would I ship this?" If no, iterate.

## Common Mistakes to Avoid

- Making everything animate (motion fatigue)
- Using too many fonts
- Poor contrast ratios (premium ≠ illegible)
- Not testing on real devices
- Forgetting accessibility (alt text, ARIA, keyboard nav)
- Ignoring loading states
- No empty states

Remember: **Restraint is the hardest design discipline.** The best designs feel inevitable, not impressive.
