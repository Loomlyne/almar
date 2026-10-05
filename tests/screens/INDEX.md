# Screens: before and after (plan 03.1-27)

Before: `tests/screens/before/` (pre-conversion baseline, never regenerated).
After: `test-results/screens-after/` (`SCREENS_MODE=after npx playwright test tests/screens-before-after.spec.ts --workers=1`).
Diff ratio: share of pixels that differ (0 = identical, 1 = different size or fully different). Produced by `node scripts/screens-diff.mjs`.

| Route | Locale | Width | Before | After | Diff ratio |
|---|---|---|---|---|---|
| account | ar | 1440 | tests/screens/before/account-ar-1440.png | test-results/screens-after/account-ar-1440.png | 0.0100 |
| account | ar | 390 | tests/screens/before/account-ar-390.png | test-results/screens-after/account-ar-390.png | 0.0300 |
| account | ar | 834 | tests/screens/before/account-ar-834.png | test-results/screens-after/account-ar-834.png | 0.0100 |
| account | en | 1440 | tests/screens/before/account-en-1440.png | test-results/screens-after/account-en-1440.png | 0.0200 |
| account | en | 390 | tests/screens/before/account-en-390.png | test-results/screens-after/account-en-390.png | 0.0300 |
| account | en | 834 | tests/screens/before/account-en-834.png | test-results/screens-after/account-en-834.png | 0.0200 |
| booking-trip | ar | 1440 | tests/screens/before/booking-trip-ar-1440.png | test-results/screens-after/booking-trip-ar-1440.png | 0.0100 |
| booking-trip | ar | 390 | tests/screens/before/booking-trip-ar-390.png | test-results/screens-after/booking-trip-ar-390.png | 0.0300 |
| booking-trip | ar | 834 | tests/screens/before/booking-trip-ar-834.png | test-results/screens-after/booking-trip-ar-834.png | 0.0200 |
| booking-trip | en | 1440 | tests/screens/before/booking-trip-en-1440.png | test-results/screens-after/booking-trip-en-1440.png | 0.0200 |
| booking-trip | en | 390 | tests/screens/before/booking-trip-en-390.png | test-results/screens-after/booking-trip-en-390.png | 0.0400 |
| booking-trip | en | 834 | tests/screens/before/booking-trip-en-834.png | test-results/screens-after/booking-trip-en-834.png | 0.0200 |
| dashboard | ar | 1440 | tests/screens/before/dashboard-ar-1440.png | test-results/screens-after/dashboard-ar-1440.png | 0.0100 |
| dashboard | ar | 390 | tests/screens/before/dashboard-ar-390.png | test-results/screens-after/dashboard-ar-390.png | 0.0100 |
| dashboard | ar | 834 | tests/screens/before/dashboard-ar-834.png | test-results/screens-after/dashboard-ar-834.png | 0.0100 |
| dashboard | en | 1440 | tests/screens/before/dashboard-en-1440.png | test-results/screens-after/dashboard-en-1440.png | 0.0100 |
| dashboard | en | 390 | tests/screens/before/dashboard-en-390.png | test-results/screens-after/dashboard-en-390.png | 0.0100 |
| dashboard | en | 834 | tests/screens/before/dashboard-en-834.png | test-results/screens-after/dashboard-en-834.png | 0.0100 |
| login | ar | 1440 | tests/screens/before/login-ar-1440.png | test-results/screens-after/login-ar-1440.png | 0.0300 |
| login | ar | 390 | tests/screens/before/login-ar-390.png | test-results/screens-after/login-ar-390.png | 0.0700 |
| login | ar | 834 | tests/screens/before/login-ar-834.png | test-results/screens-after/login-ar-834.png | 0.0200 |
| login | en | 1440 | tests/screens/before/login-en-1440.png | test-results/screens-after/login-en-1440.png | 0.0300 |
| login | en | 390 | tests/screens/before/login-en-390.png | test-results/screens-after/login-en-390.png | 0.0700 |
| login | en | 834 | tests/screens/before/login-en-834.png | test-results/screens-after/login-en-834.png | 0.0300 |

## Intended differences for owner UAT

- Primary buttons and headings are teal (was the old blue-teal); gold is lines only.
- Link hover shows a 1px gold underline.
- Corners are square everywhere (radius 0).
- The /account language select is a working control (was broken).
- Nav: stacked charcoal logo from brand/, currency and language selects, no monogram.
- Type scale 12, 14, 16, 20, 32, 48, 64; phone sizes are smaller for hero, display, heading.
