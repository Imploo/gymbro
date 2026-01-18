# Training Session Flow

## Goal
- Keep solo and shared sessions in sync with the same Exercise Detail UI.

## Key concepts
- `trainingSessionFlow` selects active user/exercise, timer source, and set completion.
- `GymBro` encapsulates warmup + sets progression for solo or paired users.
- Shared sessions live in `sharedSessions` and link back to exercises via `sharedSessionId`.

## Solo flow
- Active user is always `auth.user.uid`.
- `completeSet` runs `GymBro.performSet()` and:
  - finishes the exercise when warmups and sets are done, or
  - updates the exercise + schedules rest on the local exercise doc.
- `finishExercise` marks the exercise failed and navigates back to `/exercises`.

## Shared flow
- `createSharedSession` writes `sharedSessions` and ensures both users have an exercise.
- Exercise docs store `sharedSessionId` to bind the session in the UI.
- `subscribeSharedSession` keeps `trainingSession.sharedSession` live.
- `joinSharedSession` fills in the local participant `exerciseId` if missing.
- `completeSharedSet`:
  - loads both exercises in a transaction,
  - uses `GymBro.createPaired()` to advance active + partner,
  - swaps `activeUid` to the next participant,
  - sets rest timer on the primary user's exercise.
- `finishSharedSession`:
  - appends history entries (partner metadata included),
  - resets warmups/sets + clears `sharedSessionId`,
  - marks session `status: finished`.

## Data model
- `sharedSessions/{sessionId}`:
  - `participantIds`, `participants.{uid}.exerciseId`, `primaryUid`, `activeUid`,
    `restTimerSeconds`, `status`, `completedBy`.
- `users/{uid}/exercises/{exerciseId}`:
  - `sharedSessionId`, `warmupEnabled`, `warmupSetIndex`, `setsDone`, `timerEndsAt`.

## Edge cases
- When a session finishes, Exercise Detail clears `sharedSessionId` and exits.
- Partner exercise snapshots are only active while session status is `active`.
- Rest timer only clears on the primary user's exercise document.
