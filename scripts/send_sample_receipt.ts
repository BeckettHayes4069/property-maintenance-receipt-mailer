import { ALLOWED_RECEIPT_EMAIL, maintenanceReceiptSchema, processMaintenanceReceipt } from "../src/maintenance_receipt.js";

const input = maintenanceReceiptSchema.parse({
  requestId: "MX-1042",
  status: "completed",
  tenant: { name: "Maya Chen", email: ALLOWED_RECEIPT_EMAIL },
  property: { address: "18 Market Street", unit: "4B" },
  charge: { amountCents: 12900, currency: "USD" },
  tenantDocuments: [
    { label: "Repair authorization", received: true },
    { label: "Completion acknowledgment", received: true }
  ],
  inspectionReminder: { dueOn: "2026-10-15", note: "Annual smoke alarm inspection" }
});

const result = await processMaintenanceReceipt(input);
console.log(JSON.stringify(result, null, 2));
