# Training Session Code Review

Focus areas: SOLID, DRY, separation of concerns, simplification, and replacing `if`-heavy flow with clearer abstraction.

## Key Findings

### 1. Single Responsibility Overload in `training-session` Store

The store owns Firestore persistence, domain rules, transaction coordination, and exercise progression logic. This creates tight coupling between UI store concerns and domain rules (SRP, DIP). The `completeSharedSet` method bundles validation, transaction orchestration, partner resolution, progression computation, and side-effect scheduling in one place.

### 2. GymBro Already Handles Solo vs Shared—Strategies Are Redundant

The `GymBro` class already encapsulates the solo/shared distinction through its `next` linking mechanism:

```javascript
// gymbro.js
advance() {
  const nextBro = this.next;
  if (nextBro?.canDoSet()) return nextBro;
  if (this.canDoSet()) return this;
  return null;
}
```

- **Solo bro**: `next = null` → `advance()` returns `this` if can do sets, `null` if done
- **Paired bros**: `next` points to partner → `advance()` handles turn alternation automatically

This means the strategy pattern adds unnecessary complexity. The "strategy" is already encoded in how GymBro is constructed (linked or not).

### 3. The "Shared vs Solo" Decision Is Scattered

The decision about solo vs shared flow happens in 4 different places:

1. `trainingSessionFlow` usage in the view (no strategy indirection)
2. Inside each strategy method — `if (!trainingSession.sharedSession)` checks
3. `completeSharedSet` in the store — only called for shared sessions
4. `soloTrainingStrategy` — exists but is never used (dead code)

### 4. sharedTrainingStrategy Duplicates GymBro Logic

The strategy creates a solo GymBro for non-shared sessions, but delegates shared sessions to `completeSharedSet` which also creates GymBros:

```javascript
// shared-training-strategy.js completeSet()
if (!session) {
  // Creates GymBro for solo, handles flow manually
  const currentBro = new GymBro({ uid, exerciseData, exerciseRef: null });
  const update = currentBro.performSet();
  // ... manual handling
}
// For shared: delegates to trainingSession.completeSharedSet
// which ALSO creates GymBros and uses performSet/advance
```

This fragments the flow and duplicates logic.

### 5. DRY Violations

`toggleWarmup` is identical in both strategies. `finishExercise` has similar structure with minor differences.

### 6. Transactional Logic Mixes Domain and Persistence

`completeSharedSet` builds `GymBro` objects, calculates progression, and writes Firestore updates all in one transaction method. This makes the logic harder to test and reuse.

## Root Cause

The strategies were introduced to abstract solo vs shared, but `GymBro` already provides this abstraction through its `next` linking. The strategies add a redundant layer that:

- Duplicates the GymBro-based flow for solo
- Delegates to store methods for shared (which use GymBro anyway)
- Scatters conditional logic instead of centralizing it

## Refactoring Plan

### Phase 1: Extend GymBro to Be the Single Progression Authority

Enhance `GymBro` to return richer results and handle all progression concerns:

```javascript
// gymbro.js
export class GymBro {
  constructor({ uid, exerciseData, exerciseRef, next = null }) {
    this.uid = uid;
    this.exerciseData = exerciseData;
    this.exerciseRef = exerciseRef;
    this.next = next;
  }

  get isLinked() {
    return this.next !== null;
  }

  canDoSet() {
    if (!this.exerciseData) return false;
    if (this.exerciseData.warmupEnabled) return true;
    return this.exerciseData.setsDone < this.exerciseData.setsTarget;
  }

  performSet() {
    if (!this.canDoSet()) return null;
    const update = {};
    const current = this.exerciseData;

    if (current.warmupEnabled) {
      update.warmupSetIndex = current.warmupSetIndex + 1;
      const warmupWeight = current.currentWeight / 2 + update.warmupSetIndex * 10;
      if (warmupWeight >= current.currentWeight) {
        update.warmupEnabled = false;
      }
    } else {
      update.setsDone = current.setsDone + 1;
    }

    // Update internal state for subsequent checks
    this.exerciseData = { ...this.exerciseData, ...update };
    return update;
  }

  advance() {
    if (this.next?.canDoSet()) return this.next;
    if (this.canDoSet()) return this;
    return null;
  }

  static createSolo({ uid, exerciseData, exerciseRef }) {
    return new GymBro({ uid, exerciseData, exerciseRef, next: null });
  }

  static createPaired({ currentUid, currentData, currentRef, partnerUid, partnerData, partnerRef }) {
    const current = new GymBro({ uid: currentUid, exerciseData: currentData, exerciseRef: currentRef });
    const partner = new GymBro({ uid: partnerUid, exerciseData: partnerData, exerciseRef: partnerRef });
    current.next = partner;
    partner.next = current;
    return { current, partner };
  }
}
```

### Phase 2: Delete soloTrainingStrategy (Dead Code)

Remove `solo-training-strategy.js` entirely—it's never used.

### Phase 3: Simplify sharedTrainingStrategy to Always Use GymBro

Replace the branching with a unified GymBro-based flow:

```javascript
// shared-training-strategy.js
export const sharedTrainingStrategy = {
  // Keep getActiveUid, getActiveExercise, getActiveTarget, etc. (view helpers)

  async completeSet({ auth, trainingSession, exercise, restTimerMs, exercises }) {
    if (!exercise) {
      return { finished: false, shouldNavigate: false, shouldScheduleRest: false };
    }

    const session = trainingSession.sharedSession;

    if (session) {
      // Shared: delegate to store (which uses GymBro internally)
      const { finished, shouldFinishSession } = await trainingSession.completeSharedSet(session, exercise);
      const shouldScheduleRest = restTimerMs > 0 && session.primaryUid === auth.user?.uid && !shouldFinishSession;
      return { finished, shouldNavigate: shouldFinishSession, shouldScheduleRest };
    }

    // Solo: use GymBro directly
    const bro = GymBro.createSolo({
      uid: auth.user?.uid,
      exerciseData: exercise,
      exerciseRef: null,
    });

    const update = bro.performSet();
    if (!update) {
      return { finished: false, shouldNavigate: false, shouldScheduleRest: false };
    }

    if (!bro.advance()) {
      await exercises.finishExercise({ ...exercise, ...update }, { success: true });
      return { finished: true, shouldNavigate: true, shouldScheduleRest: false };
    }

    const timerEndsAt = restTimerMs > 0 ? Date.now() + restTimerMs : null;
    await exercises.updateExercise(exercise.id, { ...update, timerEndsAt });
    return { finished: false, shouldNavigate: false, shouldScheduleRest: restTimerMs > 0 };
  },

  // Keep toggleWarmup, finishExercise as-is for now
};
```

### Phase 4: Simplify completeSharedSet Using GymBro Factory

```javascript
// training-session.js completeSharedSet
const { current: currentBro, partner: partnerBro } = partnerData
  ? GymBro.createPaired({
      currentUid: activeUid,
      currentData: current,
      currentRef: exerciseRef,
      partnerUid,
      partnerData,
      partnerRef: partnerExerciseRef,
    })
  : { current: GymBro.createSolo({ uid: activeUid, exerciseData: current, exerciseRef }), partner: null };

const update = currentBro.performSet();
if (!update) return;

const nextBro = currentBro.advance();
const shouldFinishSession = !nextBro;
```

### Phase 5: Extract Shared Utilities (DRY)

Move duplicated code into shared helpers:

```javascript
// utils/training-helpers.js
export async function toggleWarmupForTarget({ activeExercise, exercises, target }) {
  if (!activeExercise || !target?.userId || !target?.exerciseId) return;
  const update = {
    warmupEnabled: !activeExercise.warmupEnabled,
    warmupSetIndex: 0,
  };
  await exercises.updateExerciseByUser(target.userId, target.exerciseId, update);
}
```

### Phase 6 (Future): Extract Persistence Layer

Move Firestore operations into a repository to separate domain from infrastructure:

```javascript
// repositories/session-repository.js
export const sessionRepository = {
  async updateExercise(ref, update, transaction) { /* ... */ },
  async finishSession(sessionRef, transaction) { /* ... */ },
  // etc.
};
```

## Summary

| Before | After |
|--------|-------|
| Strategy pattern with solo/shared split | GymBro handles solo (unlinked) and shared (linked) uniformly |
| Conditional logic scattered across 4 places | Single decision point: is there a shared session? |
| `soloTrainingStrategy` dead code | Deleted |
| Duplicated `toggleWarmup` | Shared utility function |
| Domain + persistence mixed | Domain in GymBro, persistence in store/repository |

## Decisions

- **GymBro stays and expands**: It becomes the single source of truth for progression logic
- **Strategy pattern simplified**: Not deleted, but reduced to view helpers + delegation
- **Repository layer**: Desired for future, not blocking
