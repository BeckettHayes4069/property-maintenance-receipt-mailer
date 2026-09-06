import { describe, expect, it } from "vitest";
import { ALLOWED_RECEIPT_EMAIL, decideReceipt, maintenanceReceiptSchema } from "../src/maintenance_receipt.js";

const request = {
  requestId: "MX-1042",
  status: "scheduled" as const,
  tenant: { name: "Maya Chen", email: ALLOWED_RECEIPT_EMAIL },
  property: { address: "18 Market Street", unit: "4B" },
  charge: { amountCents: 12900, currency: "USD" },
  tenantDocuments: [{ label: "Repair authorization", received: true }]
};

describe("maintenance receipt decision", () => {
  it("holds the receipt until the maintenance request is completed", () => {
    const input = maintenanceReceiptSchema.parse(request);
    expect(decideReceipt(input)).toEqual({ action: "hold", reason: "maintenance_not_completed" });
  });

  it("builds the paid receipt after completion", () => {
    const input = maintenanceReceiptSchema.parse({ ...request, status: "completed" });
    const decision = decideReceipt(input);
    expect(decision.action).toBe("send");
    if (decision.action === "send") {
      expect(decision.subject).toBe("Receipt MX-1042 - 4B");
      expect(decision.html).toContain("$129.00");
    }
  });
});
