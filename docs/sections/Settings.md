# Settings

## Goal
- Allow users to update bar weight, plate config, rest timer, and notifications.

## UI states
- Editable fields for bar weight, plate list, and rest timer seconds.
- Notification enable button.
- Sign out button.

## Data flow
- Update `users/{uid}.preferences`, including `restTimerSeconds`.
- Store `fcmToken` when notifications are enabled.

## Edge cases
- Invalid plate input: filter non-numeric values.
- Notifications permission denied: keep preference disabled.
