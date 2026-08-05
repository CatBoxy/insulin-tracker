import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock pool.query
const mockQuery = vi.fn();
vi.mock("@/lib/db", () => ({
  default: { query: (...args: unknown[]) => mockQuery(...args) },
}));

// Mock sendMessage
const mockSendMessage = vi.fn();
vi.mock("@/services/messaging/sender", () => ({
  sendMessage: (...args: unknown[]) => mockSendMessage(...args),
}));

// Mock checkArmGate
const mockCheckArmGate = vi.fn();
vi.mock("@/services/messaging.service", () => ({
  checkArmGate: (...args: unknown[]) => mockCheckArmGate(...args),
}));

// Mock cron-parser to always match (we test cron separately)
vi.mock("@/services/messaging/cron-parser", () => ({
  matches: () => true,
}));

import { runScheduler } from "@/services/messaging/scheduler";

function makeRule(overrides: Partial<{
  id: number;
  template_key: string;
  trigger_type: string;
  cron_expr: string | null;
  params: Record<string, unknown> | null;
}> = {}) {
  return {
    id: 1,
    template_key: "daily_reminder",
    trigger_type: "cron",
    cron_expr: "0 8 * * *",
    params: null,
    ...overrides,
  };
}

function makeTemplate(overrides: Partial<{
  id: number;
  channel: string;
  body: string;
  variables: string[];
}> = {}) {
  return {
    id: 10,
    channel: "whatsapp",
    body: "Hello!",
    variables: [],
    ...overrides,
  };
}

const activeParticipant = {
  id: 1,
  patient_id: 42,
  participant_code: "GF-001",
  arm: "intervention" as const,
  enrolled_at: "2026-01-01",
  consent_version: "1.0",
  consent_signed_at: "2026-01-01",
  baseline_hba1c: 7.2,
  withdrawn_at: null,
  withdrawal_reason: null,
};

describe("runScheduler", () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockSendMessage.mockReset();
    mockCheckArmGate.mockReset();
  });

  it("suppresses when alreadySentToday returns true (idempotency)", async () => {
    const rule = makeRule();
    const template = makeTemplate();

    mockQuery
      // 1. Fetch active rules
      .mockResolvedValueOnce({ rows: [rule] })
      // 2. getActiveTemplate
      .mockResolvedValueOnce({ rows: [template] })
      // 3. getCronCandidates
      .mockResolvedValueOnce({ rows: [{ participant_id: 1, patient_id: 42 }] })
      // 4. alreadySentToday -> YES (already sent)
      .mockResolvedValueOnce({ rows: [{ "?column?": 1 }] });

    mockCheckArmGate.mockResolvedValueOnce({
      allowed: true,
      participant: activeParticipant,
    });

    const result = await runScheduler();

    expect(result.suppressed).toBe(1);
    expect(result.sent).toBe(0);
    expect(mockSendMessage).not.toHaveBeenCalled();
    expect(result.details[0].reason).toContain("Already sent today");
  });

  it("suppresses when inactivityAlreadyFired returns true", async () => {
    const rule = makeRule({
      trigger_type: "inactivity",
      cron_expr: null,
      params: { days_threshold: 3 },
    });
    const template = makeTemplate();

    mockQuery
      // 1. Fetch active rules
      .mockResolvedValueOnce({ rows: [rule] })
      // 2. getActiveTemplate
      .mockResolvedValueOnce({ rows: [template] })
      // 3. getInactivityCandidates
      .mockResolvedValueOnce({ rows: [{ patient_id: 42 }] })
      // 4. inactivityAlreadyFired -> YES
      .mockResolvedValueOnce({ rows: [{ "?column?": 1 }] });

    mockCheckArmGate.mockResolvedValueOnce({
      allowed: true,
      participant: activeParticipant,
    });

    const result = await runScheduler();

    expect(result.suppressed).toBe(1);
    expect(result.sent).toBe(0);
    expect(mockSendMessage).not.toHaveBeenCalled();
    expect(result.details[0].reason).toContain("Inactivity message already sent");
  });

  it("skips a rule with no active template", async () => {
    const rule = makeRule({ template_key: "nonexistent_template" });

    mockQuery
      // 1. Fetch active rules
      .mockResolvedValueOnce({ rows: [rule] })
      // 2. getActiveTemplate -> no template found
      .mockResolvedValueOnce({ rows: [] });

    const result = await runScheduler();

    expect(result.evaluated).toBe(0);
    expect(result.sent).toBe(0);
    expect(result.suppressed).toBe(0);
    expect(mockSendMessage).not.toHaveBeenCalled();
    expect(mockCheckArmGate).not.toHaveBeenCalled();
  });

  it("suppresses a control patient via arm gate refusal", async () => {
    const rule = makeRule();
    const template = makeTemplate();

    mockQuery
      // 1. Fetch active rules
      .mockResolvedValueOnce({ rows: [rule] })
      // 2. getActiveTemplate
      .mockResolvedValueOnce({ rows: [template] })
      // 3. getCronCandidates (control patient somehow in the list)
      .mockResolvedValueOnce({ rows: [{ participant_id: 2, patient_id: 43 }] });

    mockCheckArmGate.mockResolvedValueOnce({
      allowed: false,
      reason: "Participant GF-002 is in the control arm",
    });

    const result = await runScheduler();

    expect(result.suppressed).toBe(1);
    expect(result.sent).toBe(0);
    expect(mockSendMessage).not.toHaveBeenCalled();
    expect(result.details[0].status).toBe("suppressed");
    expect(result.details[0].reason).toContain("control arm");
  });
});
