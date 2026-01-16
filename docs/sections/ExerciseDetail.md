# Exercise Detail

## Goal
- Show weight breakdown, manage sets, rest timer, warmup, and finish flow.

## UI states
- Weight controls (+/- 2.5kg).
- Plate breakdown per side.
- Sets progress with rest timer.
- Warmup active shows current warmup weight.

## Data flow
- Read `users/{uid}/exercises/{exerciseId}`.
- Update `currentWeight`, `setsDone`, `timerEndsAt`, `warmupEnabled`, `warmupSetIndex`.

## Edge cases
- Weight cannot drop below bar weight.
- Warmup caps at target weight.
- Timer ends while app in background: use notifications if enabled.
