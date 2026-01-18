# Title
Clear shared session data for all participants on finish

# Status
Completed

# Description
When a shared exercise session is finished, the partner's exercise still keeps
the `sharedSessionId`. This leaves the partner exercise stuck in a shared
state and the UI still treats it as active.

# Technical Solution
- Update `finishSharedSession` in `src/stores/training-session.js` to clear
  `sharedSessionId` on every participant exercise document inside the same
  transaction that finalizes the session.
- Keep the existing local cleanup of `sharedSession` and `sharedSessionId` in
  the store so the UI resets immediately for the finishing user.
