# Mobile Web Pre-Deploy Checklist

Use this checklist before each deploy that affects mobile web.

## 1) Environment and Build Safety

- [ ] `npm install` finishes without errors.
- [ ] `npm run test:cohort-shift` passes.
- [ ] `npm run test:mobile` passes on all configured Playwright mobile projects.
- [ ] App boots locally with `npm run start` and serves on expected URL.

## 2) Core Functional Flow (Mobile)

- [ ] Landing page loads and navigation is usable on touch.
- [ ] Login/Signup forms are usable without zooming issues.
- [ ] Map/list of dormitories opens and key actions are reachable.
- [ ] Room detail and registration flows are usable end-to-end.
- [ ] Critical student pages (profile, room status, maintenance) are usable.

## 3) Responsive and Layout Quality

- [ ] No horizontal overflow on key pages.
- [ ] Header/menu does not overlap page content.
- [ ] Buttons and form controls are large enough for touch.
- [ ] Text remains readable on small screens.
- [ ] Modal/dialog layouts fit mobile viewport.

## 4) Accessibility Baseline

- [ ] `meta viewport` exists on all key pages.
- [ ] Keyboard focus remains visible for forms and dialogs.
- [ ] Form inputs have labels and clear validation messages.
- [ ] Color contrast is sufficient on action buttons and status badges.

## 5) Performance Baseline

- [ ] Initial mobile page load is acceptable on local throttled network.
- [ ] No obvious layout shifts during first render.
- [ ] Large media is optimized for mobile usage.

## 6) Security and Dependency Hygiene

- [ ] Run `npm audit` and review vulnerabilities.
- [ ] Run `npm audit fix` for non-breaking safe fixes.
- [ ] Confirm no sensitive data is exposed in client-side logs.

## 7) Release Readiness

- [ ] Smoke test against staging URL on at least one Android and one iOS device.
- [ ] Capture and archive Playwright HTML report (`npm run test:mobile:report`).
- [ ] Confirm rollback plan and monitoring are in place.
