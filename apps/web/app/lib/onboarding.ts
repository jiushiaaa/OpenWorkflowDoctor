export type OnboardingMode = "demo" | "n8n-readonly";

export type OnboardingState = {
  schemaVersion: "openworkflowdoctor.onboarding.v1";
  completed: boolean;
  trustBoundariesConfirmed: boolean;
  preferredMode: OnboardingMode;
  completedAt?: string;
};

export const ONBOARDING_STORAGE_KEY = "openworkflowdoctor.onboarding.v1";

export function createDefaultOnboardingState(): OnboardingState {
  return {
    schemaVersion: "openworkflowdoctor.onboarding.v1",
    completed: false,
    trustBoundariesConfirmed: false,
    preferredMode: "demo"
  };
}

export function loadOnboardingState(storage: Storage | undefined): OnboardingState {
  if (!storage) {
    return createDefaultOnboardingState();
  }

  const rawValue = storage.getItem(ONBOARDING_STORAGE_KEY);
  if (!rawValue) {
    return createDefaultOnboardingState();
  }

  try {
    return normalizeOnboardingState(JSON.parse(rawValue) as unknown);
  } catch {
    return createDefaultOnboardingState();
  }
}

export function saveOnboardingState(storage: Storage | undefined, state: OnboardingState): void {
  storage?.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(normalizeOnboardingState(state)));
}

export function completeOnboarding(
  state: OnboardingState,
  input: { preferredMode: OnboardingMode; completedAt?: string }
): OnboardingState {
  return {
    ...state,
    completed: true,
    trustBoundariesConfirmed: true,
    preferredMode: input.preferredMode,
    completedAt: input.completedAt ?? new Date().toISOString()
  };
}

export function resetOnboardingState(storage: Storage | undefined): void {
  storage?.removeItem(ONBOARDING_STORAGE_KEY);
}

function normalizeOnboardingState(value: unknown): OnboardingState {
  if (!isRecord(value)) {
    return createDefaultOnboardingState();
  }

  if (value.schemaVersion !== "openworkflowdoctor.onboarding.v1") {
    return createDefaultOnboardingState();
  }

  const preferredMode =
    value.preferredMode === "demo" || value.preferredMode === "n8n-readonly"
      ? value.preferredMode
      : null;
  if (!preferredMode) {
    return createDefaultOnboardingState();
  }

  return {
    schemaVersion: "openworkflowdoctor.onboarding.v1",
    completed: value.completed === true,
    trustBoundariesConfirmed: value.trustBoundariesConfirmed === true,
    preferredMode,
    ...(typeof value.completedAt === "string" && value.completedAt.trim()
      ? { completedAt: value.completedAt }
      : {})
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
