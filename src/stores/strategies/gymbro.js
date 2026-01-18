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
      const nextSetsDone = current.setsDone + 1;
      update.setsDone = nextSetsDone;
    }

    this.exerciseData = { ...this.exerciseData, ...update };
    return update;
  }

  advance() {
    const nextBro = this.next;
    if (nextBro?.canDoSet()) return nextBro;
    if (this.canDoSet()) return this;
    return null;
  }

  static createSolo({ uid, exerciseData, exerciseRef }) {
    return new GymBro({ uid, exerciseData, exerciseRef, next: null });
  }

  static createPaired({
    currentUid,
    currentData,
    currentRef,
    partnerUid,
    partnerData,
    partnerRef,
  }) {
    const current = new GymBro({
      uid: currentUid,
      exerciseData: currentData,
      exerciseRef: currentRef,
    });
    const partner = new GymBro({
      uid: partnerUid,
      exerciseData: partnerData,
      exerciseRef: partnerRef,
    });
    current.next = partner;
    partner.next = current;
    return { current, partner };
  }
}
