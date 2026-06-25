import { describe, expect, test } from "vitest";
import {
  ONBOARDING_STORAGE_KEY,
  completeOnboarding,
  createDefaultOnboardingState,
  loadOnboardingState,
  resetOnboardingState,
  saveOnboardingState
} from "./onboarding";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  length = 0;

  clear(): void {
    this.values.clear();
    this.length = 0;
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
    this.length = this.values.size;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
    this.length = this.values.size;
  }
}

describe("first-run onboarding state", () => {
  test("defaults to incomplete local onboarding without requiring n8n or AI", () => {
    const state = createDefaultOnboardingState();

    expect(state).toEqual({
      schemaVersion: "openworkflowdoctor.onboarding.v1",
      completed: false,
      trustBoundariesConfirmed: false,
      preferredMode: "demo"
    });
  });

  test("persists completion mode locally", () => {
    const storage = new MemoryStorage();

    saveOnboardingState(
      storage,
      completeOnboarding(createDefaultOnboardingState(), {
        preferredMode: "n8n-readonly",
        completedAt: "2026-06-25T08:00:00.000Z"
      })
    );

    expect(loadOnboardingState(storage)).toEqual({
      schemaVersion: "openworkflowdoctor.onboarding.v1",
      completed: true,
      trustBoundariesConfirmed: true,
      preferredMode: "n8n-readonly",
      completedAt: "2026-06-25T08:00:00.000Z"
    });
  });

  test("ignores invalid stored state and can be reset", () => {
    const storage = new MemoryStorage();
    storage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify({ completed: true, preferredMode: "execute" }));

    expect(loadOnboardingState(storage)).toEqual(createDefaultOnboardingState());

    saveOnboardingState(storage, completeOnboarding(createDefaultOnboardingState(), { preferredMode: "demo" }));
    resetOnboardingState(storage);

    expect(storage.getItem(ONBOARDING_STORAGE_KEY)).toBeNull();
    expect(loadOnboardingState(storage).completed).toBe(false);
  });
});
