import type { TroubleshootingCheck } from "../lib/troubleshooting";

export function TroubleshootingPanel({
  title,
  checks
}: {
  title: string;
  checks: TroubleshootingCheck[];
}) {
  return (
    <div className="troubleshooting-panel">
      <h4>{title}</h4>
      <ul>
        {checks.map((check) => (
          <li key={check.id} className={`troubleshooting-check troubleshooting-check--${check.status}`}>
            <strong>{check.label}</strong>
            <span>{check.status}</span>
            <p>{check.detail}</p>
            {check.action ? <small>{check.action}</small> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
