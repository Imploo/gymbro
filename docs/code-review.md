# Code Review: Gymbro Vue.js Application

**Reviewer**: Senior Software Developer  
**Date**: January 2026  
**Focus Areas**: Design Patterns, SOLID, DRY, Naming Conventions, Vue.js Best Practices

---

## Executive Summary

This is a well-structured Vue 3 + Pinia fitness tracking PWA with Firebase backend. The codebase demonstrates good separation of concerns and modern Vue patterns, but has several areas for improvement regarding naming consistency, DRY violations, SOLID principles, and security.

---

## 1. Architecture & Design Patterns

### Strengths
- **Strategy Pattern**: Good use in `training-session-flow.js` to abstract solo vs shared session logic
- **Store Pattern**: Proper Pinia store separation (`auth`, `exercises`, `social`, `training-session`)
- **Composition API**: Consistent use of `<script setup>` across all components

### Issues

#### 1.1 Inconsistent Strategy Pattern Implementation

**File**: `src/stores/strategies/training-session-flow.js`

```javascript
export const trainingSessionFlow = {
  getActiveUid({ auth, trainingSession }) {
    return trainingSession.sharedSession?.activeUid ?? auth.user?.uid;
  },
  // ...
};
```

The `trainingSessionFlow` is exported as a plain object but used as if it were a strategy. If you intend to have multiple strategies (e.g., different workout flows), consider using a proper interface/class pattern.

---

## 2. SOLID Principles Violations

### Single Responsibility Principle (SRP) Violations

#### 2.1 ExerciseDetailView.vue is doing too much (~475 lines)

**File**: `src/views/ExerciseDetailView.vue`

This view handles:
- Weight adjustment
- Set completion
- Warmup management
- Timer management  
- Partner session management
- History display
- Exercise deletion
- Modal state

**Recommendation**: Extract into smaller components:
- `WeightControl.vue`
- `SetTracker.vue`
- `WarmupControl.vue`
- `ExerciseHistory.vue`
- `RestTimer.vue`

#### 2.2 training-session.js store has multiple responsibilities (~397 lines)

**File**: `src/stores/training-session.js`

The store manages:
- Shared session CRUD
- Partner exercise subscriptions
- Shared set completion logic
- Session finishing logic

Consider splitting into:
- `shared-session.js` (session lifecycle)
- `partner-exercise.js` (partner subscriptions)

### Open/Closed Principle

#### 2.3 Hard-coded plate colors cannot be extended without modification

**File**: `src/views/ExerciseDetailView.vue`

```javascript
const plateColors = {
  20: "#2b64b4",
  15: "#e2c14b",
  10: "#2f8b57",
  5: "#c73b3b",
  2.5: "#1f1f1f",
  1.25: "#f5f5f2",
};
```

Should be configurable via user preferences or a configuration file.

---

## 3. DRY Violations

### 3.1 Duplicate `partnerProfile` computed property

This exact logic appears in both files:

**File 1**: `src/views/ExerciseDetailView.vue` (lines 174-180)
**File 2**: `src/components/SessionPartners.vue` (lines 47-54)

```javascript
const partnerProfile = computed(() => {
  if (!trainingSession.sharedSession?.participants) return null;
  const entries = Object.entries(trainingSession.sharedSession.participants);
  const other = entries.find(([uid]) => uid !== auth.user?.uid);
  if (!other) return null;
  const [uid, data] = other;
  return { uid, ...data };
});
```

**Fix**: Extract to a composable:

```javascript
// composables/usePartnerProfile.js
export function usePartnerProfile(session, currentUid) {
  return computed(() => {
    if (!session.value?.participants) return null;
    const entries = Object.entries(session.value.participants);
    const other = entries.find(([uid]) => uid !== currentUid.value);
    if (!other) return null;
    const [uid, data] = other;
    return { uid, ...data };
  });
}
```

### 3.2 Duplicate `displaySetsDone` logic

**File 1**: `src/views/ExercisesView.vue` (lines 59-66)
**File 2**: `src/views/ExerciseDetailView.vue` (lines 190-197)

```javascript
const getDisplaySetsDone = (exercise) => {
  const setsDone = exercise?.setsDone ?? 0;
  const setsTarget = exercise?.setsTarget ?? 0;
  if (exercise?.warmupEnabled) {
    return setsDone;
  }
  return Math.min(setsDone + 1, setsTarget);
};
```

### 3.3 Duplicate `isE2E` checking pattern

This pattern is repeated 20+ times across stores:

```javascript
if (isE2E) {
  // localStorage logic
  return;
}
// Firebase logic
```

**Fix**: Create an abstraction layer for data persistence.

---

## 4. Naming Issues

### 4.1 Inconsistent Naming Conventions

| Current Name | Issue | Suggested Name |
|--------------|-------|----------------|
| `trainingSessionFlow` | Vague "flow" | `sessionWorkoutStrategy` |
| `normalizeName` | Just trims | `trimName` |
| `normalizeNameLower` | Does two things | `trimAndLowercase` |
| `getDisplaySetsDone` | "Get" unnecessary for computed | `displaySetsDone` |
| `timerSourceExercise` | Unclear | `restTimerOwnerExercise` |
| `roundStartUid` | Domain-specific, undocumented | Add JSDoc |

### 4.2 Boolean naming should use is/has/should prefixes

**Good examples in codebase**:
- `isE2E` ✓
- `isExerciseActive` ✓

### 4.3 Action naming inconsistencies in stores

**File**: `src/stores/exercises.js`

- `subscribeUserExercises()` - uses "subscribe"
- `loadGlobalExercises()` - uses "load"

Inconsistent naming for similar operations.

---

## 5. Vue.js Specific Issues

### 5.1 Missing Props Validation

**File**: `src/components/PartnerModal.vue`

```javascript
const props = defineProps({
  exercise: {
    type: Object,
    required: true,
  },
});
```

Should have more specific validation:

```javascript
const props = defineProps({
  exercise: {
    type: Object,
    required: true,
    validator: (value) => value.id && value.name,
  },
});
```

### 5.2 Inline Styles in Templates

Multiple instances of inline styles that should be in CSS:

```html
<div class="row" style="justify-content: space-between;">
```

### 5.3 Watchers without cleanup safety

**File**: `src/components/PartnerModal.vue`

```javascript
watch(
  () => searchTerm.value,
  (value) => {
    clearTimeout(searchTimer);
    // ...
    searchTimer = setTimeout(() => {
      social.searchUsers(value);
    }, 250);
  }
);
```

The `searchTimer` should use `ref()` for reactivity safety in component lifecycle.

---

## 6. Security Concerns

### 6.1 Firestore rules (Deferred to Production)

**File**: `firestore.rules`

> **Note**: Current Firestore rules are permissive for development. Proper security rules will be implemented when the app is ready for production. This includes restricting user data access, admin-only writes for global exercises, and participant-only access for shared sessions.

### 6.2 No input sanitization

**File**: `src/stores/exercises.js`

```javascript
async addGlobalExercise(name) {
  const trimmed = normalizeName(name);
```

Exercise names are only trimmed, not sanitized for XSS. Consider adding validation.

---

## 7. Code Quality Issues

### 7.1 Magic Numbers

**File**: `src/utils/plateCalculator.js`

```javascript
const start = currentWeight / 2;
const weight = start + warmupSetIndex * 10;
```

Should be constants:

```javascript
const WARMUP_START_PERCENTAGE = 0.5;
const WARMUP_INCREMENT_KG = 10;
```

### 7.2 Inconsistent error handling

**File**: `src/stores/auth.js`

```javascript
try {
  await signInWithPopup(auth, googleProvider);
} catch (error) {
  await signInWithRedirect(auth, googleProvider);
}
```

Silently catches all errors and tries redirect. Should log or handle specific errors.

### 7.3 Missing TypeScript

The entire codebase uses plain JavaScript. For a codebase this size with complex data structures, TypeScript would significantly improve maintainability.

---

## 8. Testing Review

### Strengths
- Good unit test coverage for strategies (`gymbro.test.js`, `training-session-flow.test.js`)
- E2E tests cover main user flows
- Proper mocking patterns

### Gaps
- No tests for Vue components
- No tests for `social.js` store
- No tests for `auth.js` store
- Missing edge case tests for `plateCalculator` (negative weights, empty configs)

---

## 9. Summary & Priority Recommendations

### High Priority (Architecture)
1. Refactor `ExerciseDetailView.vue` into smaller components
2. Create composables for shared logic (`usePartnerProfile`, `useDisplaySets`)

### Medium Priority (Code Quality)
3. Extract magic numbers to constants
4. Add proper error handling with user feedback
5. Add input validation/sanitization
6. Convert inline styles to CSS classes

### Low Priority (Improvements)
7. Consider TypeScript migration
8. Add component tests
9. Make plate colors configurable
10. Add JSDoc comments for complex domain logic

### Deferred (Production Readiness)
11. Implement proper Firestore security rules

---

## Action Items Checklist

```markdown
- [ ] Refactor ExerciseDetailView.vue into smaller components
- [ ] Create usePartnerProfile composable
- [ ] Create useDisplaySets composable  
- [ ] Extract magic numbers to constants
- [ ] Add error handling with user feedback
- [ ] Add input validation/sanitization
- [ ] Convert inline styles to CSS classes
- [ ] Add component tests
- [ ] Add store tests for social.js and auth.js
- [ ] Consider TypeScript migration
- [ ] Make plate colors configurable
- [ ] Add JSDoc comments for domain logic

### Deferred to Production
- [ ] Implement proper Firestore security rules
```
