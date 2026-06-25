import { describe, expect, test } from "vitest";
import {
  clearN8nSessionApiKey,
  deleteN8nConnection,
  loadN8nConnections,
  normalizeN8nBaseUrl,
  saveN8nConnection,
  saveN8nSessionApiKey,
  getN8nSessionApiKey
} from "./n8n-connections";

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

describe("n8n connection settings", () => {
  test("normalizes n8n base URLs to the public API root", () => {
    expect(normalizeN8nBaseUrl("https://example.app.n8n.cloud")).toBe("https://example.app.n8n.cloud/api/v1");
    expect(normalizeN8nBaseUrl("https://example.app.n8n.cloud/")).toBe("https://example.app.n8n.cloud/api/v1");
    expect(normalizeN8nBaseUrl("https://self-hosted.test/custom/api/v1/")).toBe("https://self-hosted.test/custom/api/v1");
  });

  test("stores non-secret connection metadata locally and API key in session storage only", () => {
    const localStorage = new MemoryStorage();
    const sessionStorage = new MemoryStorage();
    const saved = saveN8nConnection(localStorage, {
      label: "Production n8n",
      baseUrl: "https://example.app.n8n.cloud",
      environmentLabel: "prod",
      now: "2026-06-25T02:00:00.000Z"
    });

    saveN8nSessionApiKey(sessionStorage, saved.connectionId, "n8n_api_secret");

    expect(loadN8nConnections(localStorage)).toEqual([
      {
        connectionId: saved.connectionId,
        label: "Production n8n",
        baseUrl: "https://example.app.n8n.cloud/api/v1",
        environmentLabel: "prod",
        authHeaderName: "X-N8N-API-KEY",
        createdAt: "2026-06-25T02:00:00.000Z",
        lastUsedAt: undefined,
        lastConnectionStatus: "untested"
      }
    ]);
    expect(getN8nSessionApiKey(sessionStorage, saved.connectionId)).toBe("n8n_api_secret");
    expect(JSON.stringify(localStorage)).not.toContain("n8n_api_secret");
  });

  test("clears session keys and deletes connections without touching workflow storage", () => {
    const localStorage = new MemoryStorage();
    const sessionStorage = new MemoryStorage();
    const saved = saveN8nConnection(localStorage, {
      label: "Staging",
      baseUrl: "https://staging.example.test/api/v1",
      now: "2026-06-25T02:00:00.000Z"
    });

    saveN8nSessionApiKey(sessionStorage, saved.connectionId, "session-only-key");
    clearN8nSessionApiKey(sessionStorage, saved.connectionId);
    expect(getN8nSessionApiKey(sessionStorage, saved.connectionId)).toBe("");

    deleteN8nConnection(localStorage, sessionStorage, saved.connectionId);
    expect(loadN8nConnections(localStorage)).toEqual([]);
  });
});
