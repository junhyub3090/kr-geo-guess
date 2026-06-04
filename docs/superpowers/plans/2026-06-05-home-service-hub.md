# Home Service Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the homepage into a polished game-service hub that exposes play, maps, friend rooms, rankings, daily challenge, and feedback without changing game logic.

**Architecture:** Keep routing and state in `App.tsx` unchanged. Recompose `HomeScreen` into a service navigation header, primary play hub, settings strip, map selector, and right-side service rail using existing callbacks. Update CSS tokens and responsive rules in `styles.css`, and lock the behavior with Playwright visual QA.

**Tech Stack:** React 19, Vite 6, TypeScript, CSS, lucide-react, Playwright.

---

### Task 1: Service Hub Contract

**Files:**
- Modify: `apps/web/tests/visual-qa.spec.ts`

- [x] Add a Playwright contract that expects `서비스 내비게이션`, section links for `플레이`, `맵`, `친구방`, `랭킹`, `제보`, the headline `한국 골목을 맞혀보세요`, and visible service sections.
- [x] Run the targeted test and confirm RED because the current homepage has no service navigation or hub headline.

### Task 2: Homepage Structure

**Files:**
- Modify: `apps/web/src/features/home/HomeScreen.tsx`

- [x] Add header navigation anchors while preserving the `어디길` heading.
- [x] Recompose the start panel into a hero service hub with real nickname input, start button, non-conflicting friend-room CTA, selected map preview, and setting summaries.
- [x] Preserve existing map, difficulty, timer, room, ranking, daily, and feedback callbacks.
- [x] Keep existing class names used by regression tests where practical.

### Task 3: Visual System And Responsiveness

**Files:**
- Modify: `apps/web/src/styles.css`

- [x] Implement the desktop concept: white/cool-blue surface, blue navigation active state, strong map preview, service rail, and bottom section hint.
- [x] Implement mobile stacking based on the mobile concept with tappable controls and no clipping.
- [x] Update compact desktop constraints so the first viewport remains usable at `1280x720`.

### Task 4: Verification

**Files:**
- Modify as needed: `apps/web/tests/visual-qa.spec.ts`

- [x] Run targeted homepage Playwright tests until green.
- [x] Run desktop and mobile Playwright suites through `npm run qa`.
- [x] Run `npm run qa`.
- [x] Capture rendered desktop and mobile screenshots and compare against generated concepts with `view_image`.
- [x] Keep the implementation ready for commit after verification.
