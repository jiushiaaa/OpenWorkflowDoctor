import type { OnboardingMode } from "../lib/onboarding";

const trustBoundaries = [
  "OpenWorkflowDoctor does not execute workflows.",
  "It does not write changes back to n8n.",
  "It does not inspect or store credentials.",
  "Patch proposals are review-only.",
  "Imported data stays local."
];

export function OnboardingPanel({
  onStartDemo,
  onStartN8n,
  onSkip,
  onClose
}: {
  onStartDemo: () => void;
  onStartN8n: () => void;
  onSkip: () => void;
  onClose: () => void;
}) {
  return (
    <section className="onboarding-panel" role="dialog" aria-label="First-run onboarding">
      <header>
        <div>
          <span>Local first run</span>
          <h2>Start OpenWorkflowDoctor locally</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="关闭">
          关闭
        </button>
      </header>
      <div className="onboarding-body">
        <section>
          <h3>Choose mode</h3>
          <div className="onboarding-actions" role="group" aria-label="Choose onboarding mode">
            <button type="button" onClick={onStartDemo}>
              Start demo mode
            </button>
            <button type="button" className="secondary-button" onClick={onStartN8n}>
              Connect n8n read-only
            </button>
          </div>
        </section>
        <section>
          <h3>Trust boundaries</h3>
          <ul className="safety-list">
            {trustBoundaries.map((boundary) => (
              <li key={boundary}>{boundary}</li>
            ))}
          </ul>
        </section>
        <section>
          <h3>AI provider</h3>
          <p className="settings-help">Rule-based diagnostics work without AI.</p>
        </section>
        <footer>
          <button type="button" className="secondary-button" onClick={onSkip}>
            Skip for now
          </button>
        </footer>
      </div>
    </section>
  );
}

export function getModeCompletion(mode: OnboardingMode) {
  return mode === "demo" ? "Demo mode" : "Read-only n8n mode";
}
