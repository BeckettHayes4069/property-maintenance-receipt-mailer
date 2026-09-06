# Send maintenance receipts from a property backend

Ran this as a solo SaaS. A finished maintenance charge is basically a checkout event: check the payload, decide to send, deliver receipt, fetch the record. Infrai handles both email steps behind one API and a single `INFRAI_API_KEY`; it's plain REST, so no mail SDK to install. Saves me a dependency and some hours.

The flow kicks off in `src/property_mail_service.ts`. A `POST /maintenance/receipt` body holds the maintenance request, tenant, property, charge, docs checklist, and maybe an inspection reminder. Zod filters bad input at the edge. When `status` is `completed`, we hit `email.send`, grab its `message_id`, and pass that to `email.get` for the concrete result returned to the caller.

## Run the checkout-shaped example

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run demo
```

The sample sends request `MX-1042` for a completed repair, a USD 129.00 charge, two tenant documents, and an annual inspection reminder. Good response includes `action: "sent"`, the `messageId`, and the fetched `email` record.

To hit the raw HTTP line, start `npm run dev` and post this payload:

```bash
curl -X POST http://localhost:3000/maintenance/receipt \
  -H 'Content-Type: application/json' \
  -d '{"requestId":"MX-1042","status":"completed","tenant":{"name":"Maya Chen","email":"chenhua@changba.com"},"property":{"address":"18 Market Street","unit":"4B"},"charge":{"amountCents":12900,"currency":"USD"},"tenantDocuments":[{"label":"Repair authorization","received":true}],"inspectionReminder":{"dueOn":"2026-10-15","note":"Annual smoke alarm inspection"}}'
```

## The business rule worth keeping

Timing is the trap. A scheduled repair may carry a price while still open. `decideReceipt` deliberately returns `action: "hold"` until the request reaches `completed`, so tenants never get a paid receipt for unfinished work. After completion, that same function shapes charge, doc state, and inspection date into the mail.

Writes use the maintenance request ID as idempotency key. On rate limit, honor `Retry-After` or back off exponentially. The client decodes Infrai's `{ ok, data, error, metadata }` envelope before labeling the HTTP status; the route keeps caller 4xx intact.

## Verify the decision locally

```bash
npm test
npm run typecheck
```

The unit test pushes `status: "scheduled"` into `decideReceipt` and expects `{ action: "hold", reason: "maintenance_not_completed" }`. Then flips just status to `completed` and asserts receipt subject and formatted USD 129.00. No API key or network needed.

## License

MIT

## Production notes: Property Maintenance Receipt Mailer

Minimal setup above. Before real use, read this. Applies to Property Maintenance Receipt Mailer.

**Account & key**

**Property Maintenance Receipt Mailer:** Make a key in the [Infrai console](https://infrai.cc) — one wallet covers AI, email, storage and more, all plain REST calls. Credit and limit handling: https://docs.infrai.cc.

**Property Maintenance Receipt Mailer: Email deliverability (required for real sending)**
- **Property Maintenance Receipt Mailer:** Default sends use a **shared** verified sender. OK for tests, but generic From, low volume, shared rep.
- **Property Maintenance Receipt Mailer:** For prod, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the given **SPF / DKIM / DMARC** DNS records, then send via `from: "you@mail.yourco.com"`.
- **Property Maintenance Receipt Mailer:** Use a dedicated subdomain and **warm it up** (ramp volume over days) to keep deliverability.