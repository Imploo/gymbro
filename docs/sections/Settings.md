# Settings

## Goal
- Allow users to update bar weight, plate config, and notifications.

## UI states
- Editable fields for bar weight and plate list.
- Notification enable button.
- Sign out button.

## Data flow
- Update `users/{uid}.preferences`.
- Store `fcmToken` when notifications are enabled.

## Edge cases
- Invalid plate input: filter non-numeric values.
- Notifications permission denied: keep preference disabled.
