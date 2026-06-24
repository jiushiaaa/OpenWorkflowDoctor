import type { Translator } from "../lib/i18n";
import type { CommandItem } from "./workbench-shared";

export function CommandPalette({
  commands,
  t,
  onClose
}: {
  commands: CommandItem[];
  t: Translator;
  onClose: () => void;
}) {
  function runCommand(command: CommandItem) {
    if (command.disabled) {
      return;
    }

    command.action();
    onClose();
  }

  return (
    <div className="command-overlay" role="presentation">
      <section className="command-palette" role="dialog" aria-modal="true" aria-label={t("toolbar.commandPalette")}>
        <header>
          <div>
            <span>{t("toolbar.commandPalette")}</span>
            <h2>{t("command.title")}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label={t("actions.close")}>
            {t("actions.close")}
          </button>
        </header>
        <ul>
          {commands.map((command) => (
            <li key={command.label}>
              <button
                type="button"
                disabled={command.disabled}
                onClick={() => runCommand(command)}
              >
                <strong>{command.label}</strong>
                <small>{command.hint}</small>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
