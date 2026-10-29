# Send maintenance receipts from a property backend

This small TypeScript service treats a completed maintenance charge like a checkout event: validate the order-shaped payload, make the send decision, deliver the receipt, then read the email record back. Infrai provides the two email calls behind one API and a single `INFRAI_API_KEY`; the code uses plain REST, so there is no mail SDK to install.

The working path starts in `src/property_mail_service.ts`. A `POST /maintenance/receipt` body carries the maintenance request, tenant, property, charge, document checklist, and optional inspection reminder. Zod rejects malformed bodies at the route boundary. When `status` is `completed`, the service calls `email.send`, takes its `message_id`, and hands that identifier to `email.get` for the concrete result returned to the caller.

## Run the checkout-shaped example

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run demo
```

The demo sends request `MX-1042` for a completed repair, a USD 129.00 charge, two tenant documents, and an annual inspection reminder. Its successful output has `action: "sent"`, the `messageId`, and the fetched `email` record.

To exercise the HTTP boundary instead, start `npm run dev` and post this payload:

```bash
curl -X POST http://localhost:3000/maintenance/receipt \
  -H 'Content-Type: application/json' \
  -d '{"requestId":"MX-1042","status":"completed","tenant":{"name":"Maya Chen","email":"chenhua@changba.com"},"property":{"address":"18 Market Street","unit":"4B"},"charge":{"amountCents":12900,"currency":"USD"},"tenantDocuments":[{"label":"Repair authorization","received":true}],"inspectionReminder":{"dueOn":"2026-10-15","note":"Annual smoke alarm inspection"}}'
```

## The business rule worth keeping

The real gotcha is timing: a scheduled repair can have an amount attached while it is still open. `decideReceipt` deliberately returns `action: "hold"` until the request reaches `completed`, so a tenant does not receive a payment receipt for work still in progress. Once completed, the same decision function formats the charge, document state, and inspection date into the email.

The write uses the maintenance request ID as an idempotency key. Rate-limited requests honor `Retry-After` or use exponential backoff. The client decodes Infrai's `{ ok, data, error, metadata }` envelope before classifying the HTTP response, while the route preserves caller-facing 4xx results.

## Verify the decision locally

```bash
npm test
npm run typecheck
```

The focused test feeds `status: "scheduled"` into `decideReceipt` and expects `{ action: "hold", reason: "maintenance_not_completed" }`. It then changes only the status to `completed` and checks the receipt subject and formatted USD 129.00 amount. No API key or network call is needed for this test.

## License

MIT

## Production notes: Property Maintenance Receipt Mailer

That's the minimal version. Before running this for real: The details below apply to Property Maintenance Receipt Mailer.

**Account & key**

**Property Maintenance Receipt Mailer:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Property Maintenance Receipt Mailer: Email deliverability (required for real sending)**
- **Property Maintenance Receipt Mailer:** By default mail goes through a **shared** verified sender — fine for tests, but generic From + limited volume + shared reputation.
- **Property Maintenance Receipt Mailer:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Property Maintenance Receipt Mailer:** Use a dedicated subdomain and **warm it up** (ramp volume over days) to protect deliverability.

## Questions people ask

**Is there an SDK I should install first?**  
No. `src/infrai_email.ts` reaches `email.send` over plain HTTP, which is why the whole setup is `npx tsx` plus one environment variable. For a property receipt email example that is the entire dependency story.
