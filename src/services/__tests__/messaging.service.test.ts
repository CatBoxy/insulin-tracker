import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock pool.query before importing the module under test
const mockQuery = vi.fn();
vi.mock("@/lib/db", () => ({
  default: { query: (...args: unknown[]) => mockQuery(...args) },
}));

import { checkArmGate } from "@/services/messaging.service";

describe("checkArmGate", () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it("allows an active intervention participant", async () => {
    const participant = {
      id: 1,
      patient_id: 42,
      participant_code: "GF-001",
      arm: "intervention",
      enrolled_at: "2026-01-01",
      consent_version: "1.0",
      consent_signed_at: "2026-01-01",
      baseline_hba1c: 7.2,
      withdrawn_at: null,
      withdrawal_reason: null,
    };

    // First call: SELECT from study_participants
    mockQuery.mockResolvedValueOnce({ rows: [participant] });

    const result = await checkArmGate(42);

    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(result.participant).toEqual(participant);
      expect(result.participant.arm).toBe("intervention");
    }
    // Should NOT log a refusal
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it("refuses a control-arm participant and logs refusal", async () => {
    const participant = {
      id: 2,
      patient_id: 43,
      participant_code: "GF-002",
      arm: "control",
      enrolled_at: "2026-01-01",
      consent_version: "1.0",
      consent_signed_at: "2026-01-01",
      baseline_hba1c: 6.8,
      withdrawn_at: null,
      withdrawal_reason: null,
    };

    mockQuery
      .mockResolvedValueOnce({ rows: [participant] }) // SELECT
      .mockResolvedValueOnce({ rows: [] }); // INSERT refusal

    const result = await checkArmGate(43);

    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reason).toContain("control arm");
    }

    // Verify refusal was logged
    expect(mockQuery).toHaveBeenCalledTimes(2);
    const insertCall = mockQuery.mock.calls[1];
    expect(insertCall[0]).toContain("INSERT INTO message_send_refusals");
    expect(insertCall[1]).toEqual([43, expect.stringContaining("control arm")]);
  });

  it("refuses a withdrawn intervention participant and logs refusal", async () => {
    const participant = {
      id: 3,
      patient_id: 44,
      participant_code: "GF-003",
      arm: "intervention",
      enrolled_at: "2026-01-01",
      consent_version: "1.0",
      consent_signed_at: "2026-01-01",
      baseline_hba1c: 7.5,
      withdrawn_at: "2026-06-15",
      withdrawal_reason: "Patient requested withdrawal",
    };

    mockQuery
      .mockResolvedValueOnce({ rows: [participant] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await checkArmGate(44);

    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reason).toContain("withdrawn");
    }

    // Verify refusal was logged
    expect(mockQuery).toHaveBeenCalledTimes(2);
    const insertCall = mockQuery.mock.calls[1];
    expect(insertCall[0]).toContain("INSERT INTO message_send_refusals");
    expect(insertCall[1][0]).toBe(44);
  });

  it("refuses a withdrawn control participant and logs refusal", async () => {
    const participant = {
      id: 4,
      patient_id: 45,
      participant_code: "GF-004",
      arm: "control",
      enrolled_at: "2026-01-01",
      consent_version: "1.0",
      consent_signed_at: "2026-01-01",
      baseline_hba1c: 6.5,
      withdrawn_at: "2026-07-01",
      withdrawal_reason: "Lost to follow-up",
    };

    mockQuery
      .mockResolvedValueOnce({ rows: [participant] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await checkArmGate(45);

    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      // Withdrawn check comes before arm check in the code,
      // so it should mention "withdrawn" not "control"
      expect(result.reason).toContain("withdrawn");
    }

    expect(mockQuery).toHaveBeenCalledTimes(2);
  });

  it("refuses a patient with no study_participants record and logs refusal", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // No participant found
      .mockResolvedValueOnce({ rows: [] }); // INSERT refusal

    const result = await checkArmGate(99);

    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reason).toContain("not enrolled");
    }

    // Verify refusal was logged
    expect(mockQuery).toHaveBeenCalledTimes(2);
    const insertCall = mockQuery.mock.calls[1];
    expect(insertCall[0]).toContain("INSERT INTO message_send_refusals");
    expect(insertCall[1][0]).toBe(99);
  });

  it("logs a refusal to message_send_refusals for every refusal case", async () => {
    // Test all three refusal paths and verify each logs
    const cases = [
      {
        name: "not enrolled",
        rows: [],
        patientId: 100,
      },
      {
        name: "withdrawn",
        rows: [
          {
            id: 10, patient_id: 101, participant_code: "GF-010",
            arm: "intervention", withdrawn_at: "2026-01-01",
            enrolled_at: "2025-01-01", consent_version: "1.0",
            consent_signed_at: "2025-01-01", baseline_hba1c: null,
            withdrawal_reason: "adverse event",
          },
        ],
        patientId: 101,
      },
      {
        name: "control arm",
        rows: [
          {
            id: 11, patient_id: 102, participant_code: "GF-011",
            arm: "control", withdrawn_at: null,
            enrolled_at: "2025-01-01", consent_version: "1.0",
            consent_signed_at: "2025-01-01", baseline_hba1c: null,
            withdrawal_reason: null,
          },
        ],
        patientId: 102,
      },
    ];

    for (const testCase of cases) {
      mockQuery.mockReset();
      mockQuery
        .mockResolvedValueOnce({ rows: testCase.rows })
        .mockResolvedValueOnce({ rows: [] });

      const result = await checkArmGate(testCase.patientId);
      expect(result.allowed).toBe(false);

      // Every refusal must trigger an INSERT into message_send_refusals
      const insertCalls = mockQuery.mock.calls.filter(
        (call) => typeof call[0] === "string" && call[0].includes("INSERT INTO message_send_refusals")
      );
      expect(insertCalls).toHaveLength(1);
      expect(insertCalls[0][1][0]).toBe(testCase.patientId);
    }
  });
});
