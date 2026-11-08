---
name: Rolearch
description: Career intelligence and job applications. Understand your fit before you apply.
colors:
  atlas-ink: "#0e1f2f"
  atlas-ink-hover: "#1d3247"
  signal-amber: "#e0a35b"
  signal-amber-ink: "#8f5b12"
  paper: "#f4f5f1"
  glass-surface: "rgb(255 255 255 / 0.46)"
  slate-muted: "#4b5a6e"
  hairline: "rgb(14 31 47 / 0.18)"
  ink-wash: "rgb(14 31 47 / 0.07)"
  fit-strong: "#1f7a4d"
  fit-potential: "#2c5585"
  fit-poor: "#b4532a"
typography:
  display:
    fontFamily: "Bricolage Grotesque, ui-sans-serif, system-ui, sans-serif"
    fontSize: "4.6rem"
    fontWeight: 600
    lineHeight: 1.02
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Bricolage Grotesque, ui-sans-serif, system-ui, sans-serif"
    fontSize: "3rem"
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Bricolage Grotesque, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    letterSpacing: "0.12em"
rounded:
  md: "6px"
  lg: "8px"
  xl: "12px"
  2xl: "16px"
  3xl: "24px"
  full: "9999px"
spacing:
  gutter: "16px"
  gutter-wide: "24px"
  container: "72rem"
  section: "96px"
components:
  button-primary:
    backgroundColor: "{colors.atlas-ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.full}"
    padding: "0 20px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.atlas-ink-hover}"
  button-signal:
    backgroundColor: "{colors.signal-amber}"
    textColor: "{colors.atlas-ink}"
    rounded: "{rounded.full}"
    padding: "0 28px"
    height: "56px"
  button-outline:
    textColor: "{colors.atlas-ink}"
    rounded: "{rounded.full}"
    padding: "0 20px"
    height: "44px"
  chip:
    backgroundColor: "{colors.ink-wash}"
    textColor: "{colors.atlas-ink}"
    rounded: "{rounded.full}"
    padding: "6px 14px"
  card:
    backgroundColor: "{colors.glass-surface}"
    rounded: "{rounded.3xl}"
    padding: "24px"
  input:
    backgroundColor: "{colors.glass-surface}"
    textColor: "{colors.atlas-ink}"
    rounded: "{rounded.xl}"
    padding: "0 12px"
    height: "44px"
---

# Design System: Rolearch

## Overview

**Creative North Star: "The Atlas Under Glass"**

Rolearch is a map of where someone's real experience can take them, laid under frosted glass. The ground is a calm paper tone lit from behind by two soft lights, the logo's amber from the top left and a quiet navy-blue from the right. Every raised surface is frosted glass over that light. Text and controls are deep atlas ink, so the page reads as a precise instrument rather than a decorative one.

Density is moderate: generous sections (96px apart), tight groups inside them. The amber signal is the only warm accent and appears where a decision or a next step lives: the primary call to action on dark bands, the current stage, the chosen route, progress. Evidence is the product, so data (fit scores, rings, bars, funnels) is drawn plainly and animated once to show its value, never as ornament.

**Key Characteristics:**
- Frosted glass surfaces over a fixed amber and navy ambient light.
- Deep ink text and pill-shaped ink buttons; amber reserved for signal.
- Bricolage Grotesque display with tight tracking; Geist for everything you read.
- One-time, data-driven motion: routes draw, rings sweep, bars fill.

## Colors

A cool paper ground, deep navy ink and one warm amber signal, with three semantic fit colours for verdicts.

### Primary
- **Atlas Ink** (#0e1f2f): all body text, headings, primary buttons and the dark bands. Hover deepens to Atlas Ink Hover (#1d3247).

### Secondary
- **Signal Amber** (#e0a35b): graphics and fills only (2.0:1 on paper): the logo dot, the chosen route, the current stage, progress, primary buttons on dark bands, chips that mark "Free" or a selection.
- **Signal Amber Ink** (#8f5b12): the amber for text on light grounds (5.2:1): emphasised words, section letters (A–E), links that carry the brand.

### Tertiary
- **Fit Strong** (#1f7a4d), **Fit Potential** (#2c5585), **Fit Poor** (#b4532a): verdict colours for job-fit scores, rings and chips. Stretch uses Signal Amber Ink; insufficient information uses Slate Muted.

### Neutral
- **Paper** (#f4f5f1): the ground, under the ambient light.
- **Glass Surface** (rgb(255 255 255 / 0.46)): every raised surface; frosted with `backdrop-filter: blur(20px) saturate(170%)`.
- **Slate Muted** (#4b5a6e): secondary text, captions, metadata.
- **Hairline** (rgb(14 31 47 / 0.18)): dividers and field borders; translucent so it takes the light behind it.
- **Ink Wash** (rgb(14 31 47 / 0.07)): chip and track fills, quiet backgrounds.

### Named Rules
**The One Warm Light Rule.** Amber is the only warm colour and marks a decision, a selection or progress. Never use it for body text (use Signal Amber Ink) or as a large flat fill on light grounds.

**The Verdict Colours Rule.** Green, blue and rust mean strong, potential and poor fit. They are not decoration and never appear outside fit, outcome or status.

## Typography

**Display Font:** Bricolage Grotesque (with ui-sans-serif, system-ui)
**Body Font:** Geist (with ui-sans-serif, system-ui)

**Character:** a confident grotesque with optical-size character for headlines, paired with a clean, neutral reading face. Numbers that change or compare use tabular figures.

### Hierarchy
- **Display** (600, 2.6rem phone to 4.6rem desktop, 1.02, -0.035em): the homepage hero only, max about 15ch.
- **Headline** (600, 1.875rem to 3rem, 1.05, -0.025em): section titles, balanced wrapping.
- **Title** (600, 1.25rem to 1.875rem, 1.2, -0.02em): feature and card headings; job titles at 1.08rem.
- **Body** (400, 1rem, 1.55): reading text at 60–65ch; leads at 1.125rem in Slate Muted.
- **Label** (600, 0.65–0.75rem, 0.12em, uppercase): column headers, ring captions, "Sample" tags. Never as a kicker above a heading.

### Named Rules
**The Heading Speaks Rule.** No eyebrow labels above headings. Context such as a tag ("Core differentiator") sits beside or under the heading, as in the A–E sections.

## Layout

A single centred container (72rem max) with 16px side gutters on phones and 24px from small tablets up. Sections are separated by about 96px; groups inside them by 8–24px. Marketing sections alternate text and a sample screen in two columns from 1024px, stacking text first on phones. App pages (dashboard, tracker, discover) use the same container with denser stacked panels. A sticky frosted header (64px) stays on top; anchored sections offset by 80–96px so headings clear it. Nothing scrolls sideways at 375px wide.

## Elevation & Depth

Depth comes from glass, not from stacking shadows. Raised surfaces are translucent white, blurred and saturated over the ambient light, with a light white edge (rgb(255 255 255 / 0.7)) as if catching light. Feature samples add one soft, offset shadow. Dark panels are smoked glass: Atlas Ink at 86% with a faint inner highlight.

### Shadow Vocabulary
- **Header float** (`box-shadow: 0 1px 0 rgb(14 31 47 / 0.08), 0 8px 24px -16px rgb(14 31 47 / 0.25)`): the sticky header.
- **Sample lift** (`box-shadow: inset 0 1px 0 rgba(255,255,255,0.8), 0 1px 2px rgba(14,31,47,0.06), 0 24px 60px -16px rgba(14,31,47,0.22)`): sample screens on the homepage.
- **Smoked glass** (`box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.12), 0 1px 2px rgb(14 31 47 / 0.2), 0 24px 60px -12px rgb(14 31 47 / 0.45)`): dark sample panels.
- **Card rest** (`box-shadow: 0 1px 2px rgba(14,31,47,0.04), 0 12px 32px -18px rgba(14,31,47,0.25)`): portfolio cards on the profile.

### Named Rules
**The Something Behind The Glass Rule.** Glass only works over light. Keep the fixed ambient gradients on the body; a glass surface on a flat ground is just a grey box. Browsers without backdrop-filter get near-opaque surfaces (rgb(255 255 255 / 0.92)).

**The Visible Field Rule.** Form fields keep a visible Hairline border; the white glass edge is for cards, never inputs.

## Shapes

Soft, friendly geometry. Pills (fully rounded) for every button, chip and tag; 12px for fields and small tiles; 16px for list cards and panels; 24px for feature cards, samples and dark bands. Nested surfaces use a smaller radius than their parent. Icons are Lucide, one stroke weight, 14–20px.

## Components

### Buttons
- **Shape:** pill (9999px), at least 44px tall.
- **Primary:** Atlas Ink with Paper text, 20px side padding; hover Atlas Ink Hover; pressed scale 0.96.
- **Signal:** Signal Amber with Atlas Ink text, 56px tall, for the main action on dark bands (the free ATS check).
- **Outline:** 1px Atlas Ink border, transparent; hover fills ink with paper text.
- **Focus:** 2px ink outline, 2px offset; amber outline on dark bands.

### Chips
- **Style:** pills on Ink Wash or a 1px Hairline border, 14px padding; popular searches, keyword chips, skill tags.
- **State:** selected chips fill Atlas Ink with Paper text; evidence-backed skills show a check.

### Cards / Containers
- **Corner Style:** 16px for lists and panels, 24px for feature cards.
- **Background:** Glass Surface, frosted.
- **Border:** white glass edge on light grounds.
- **Internal Padding:** 16–24px.

### Inputs / Fields
- **Style:** Glass Surface or a faint paper tint, 1px Hairline border, 12px radius, 44px tall.
- **Focus:** ink outline; caret in Signal Amber Ink.
- **Error:** message in Fit Poor (#b4532a) below the field, with the recovery.

### Navigation
- **Header:** sticky frosted glass bar, logo left; search, Jobs and the account menu right. On phones, search and menu collapse to 40px icon buttons.
- **A–E index:** a five-column ruled row of letter plus name on desktop, a ruled list on phones; letters in Signal Amber Ink.

### Fit Score (signature)
A large percentage in the verdict colour, the verdict and its one-line reason beside it, and three 64px rings (Location, Experience, Alignment) whose arcs sweep to their values once, in turn.

### Sample Screen (signature)
A 24px glass card (or smoked glass) with its title and a "Sample" tag on one header row, showing a real Rolearch screen with labelled sample data. Its data animates once when scrolled into view.

## Do's and Don'ts

### Do:
- **Do** keep text in Atlas Ink (#0e1f2f) and amber text in Signal Amber Ink (#8f5b12).
- **Do** use frosted Glass Surface for every raised surface, over the fixed ambient light.
- **Do** animate data once with the soft ease-out (cubic-bezier(0.22, 1, 0.36, 1)): routes draw, rings sweep, bars fill, columns rise; 400–1100ms, staggered about 100ms.
- **Do** give every motion a reduced-motion path that shows the final state immediately.
- **Do** use tabular figures for scores, counts and percentages.
- **Do** label sample data as "Sample".

### Don't:
- **Don't** put eyebrow labels or kickers above headings.
- **Don't** use amber for body text or large flat fills on light grounds.
- **Don't** use the verdict colours (#1f7a4d, #2c5585, #b4532a) decoratively.
- **Don't** put the white glass edge on form fields; they keep a visible Hairline border.
- **Don't** use monospace for decoration; keep it for keywords and code.
- **Don't** add looping or repeated entrance animations to every section.
