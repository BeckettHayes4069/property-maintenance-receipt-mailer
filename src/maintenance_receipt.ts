import { z } from "zod";
import { infrai } from "./infrai_email.js";

export const ALLOWED_RECEIPT_EMAIL = "chenhua@changba.com";

export const maintenanceReceiptSchema = z.object({
  requestId: z.string().min(1),
  status: z.enum(["requested", "scheduled", "completed"]),
  tenant: z.object({ name: z.string().min(1), email: z.literal(ALLOWED_RECEIPT_EMAIL) }),
  property: z.object({ address: z.string().min(1), unit: z.string().min(1) }),
  charge: z.object({ amountCents: z.number().int().nonnegative(), currency: z.string().length(3) }),
  tenantDocuments: z.array(z.object({ label: z.string().min(1), received: z.boolean() })),
  inspectionReminder: z.object({ dueOn: z.string().date(), note: z.string().min(1) }).optional(),
});

export type MaintenanceReceipt = z.infer<typeof maintenanceReceiptSchema>;
export type ReceiptDecision =
  | { action: "hold"; reason: "maintenance_not_completed" }
  | { action: "send"; subject: string; html: string };

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
  })[character] as string);
}

export function decideReceipt(input: MaintenanceReceipt): ReceiptDecision {
  if (input.status !== "completed") return { action: "hold", reason: "maintenance_not_completed" };

  const money = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: input.charge.currency.toUpperCase(),
  }).format(input.charge.amountCents / 100);
  const documents = input.tenantDocuments
    .map((document) => `<li>${escapeHtml(document.label)}: ${document.received ? "received" : "pending"}</li>`)
    .join("");
  const reminder = input.inspectionReminder
    ? `<h2>Next inspection</h2><p>${escapeHtml(input.inspectionReminder.dueOn)}: ${escapeHtml(input.inspectionReminder.note)}</p>`
    : "";

  return {
    action: "send",
    subject: `Receipt ${input.requestId} - ${input.property.unit}`,
    html: `<h1>Maintenance receipt</h1><p>Hi ${escapeHtml(input.tenant.name)},</p><p>Payment recorded: <strong>${money}</strong></p><p>${escapeHtml(input.property.address)}, unit ${escapeHtml(input.property.unit)}</p><h2>Tenant documents</h2><ul>${documents}</ul>${reminder}`,
  };
}

export async function processMaintenanceReceipt(input: MaintenanceReceipt) {
  const decision = decideReceipt(input);
  if (decision.action === "hold") return decision;

  const sent = await infrai.email.send(
    { to: input.tenant.email, subject: decision.subject, html: decision.html },
    `maintenance-receipt-${input.requestId}`,
  );
  const email = await infrai.email.get(sent.message_id);
  return { action: "sent" as const, messageId: sent.message_id, email };
}
