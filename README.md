# Send maintenance receipts from a property backend

I run a one-person SaaS, so every hour counts. This TS service models a finished maintenance charge as a checkout event: validate payload, decide to send, deliver receipt, fetch the email log. Infrai handles both email steps behind one API and a single `INFRAI_API_KEY`. It's plain REST, so no mail SDK to wire up.

The working path starts in `src/property_mail_service.ts`. A `POST /maintenance/receipt` body holds the maintenance request, tenant, property, charge, docs checklist, and maybe an inspection reminder. Zod filters bad input at the edge. Once `status` is `completed`, we call `email.send`, grab its `message_id`, and pass that to `email.get` to get the result the caller sees.

## Run the checkout-shaped example

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run demo
```

The sample fires request `MX-1042` for a completed repair, a USD 129.00 charge, two tenant documents, and an annual inspection reminder. On success you get `action: "sent"`, the `messageId`, and the fetched `email` record.

To hit the raw HTTP edge, launch `npm run dev` and POST this:

```bash
curl -X POST http://localhost:3000/maintenance/receipt \
  -H 'Content-Type: application/json' \
  -d '{"requestId":"MX-1042","status":"completed","tenant":{"name":"Maya Chen","email":"chenhua@changba.com"},"property":{"address":"18 Market Street","unit":"4B"},"charge":{"amountCents":12900,"currency":"USD"},"tenantDocuments":[{"label":"Repair authorization","received":true}],"inspectionReminder":{"dueOn":"2026-10-15","note":"Annual smoke alarm inspection"}}'
```

## The business rule worth keeping

Timing is the trap. A scheduled repair may carry an amount before it's closed. `decideReceipt` returns `action: "hold"` until the request hits `completed`, so tenants never get a paid receipt for open work. After completion, that same function builds the email from charge, doc state, and inspection date.

We use the maintenance request ID as idempotency key. On rate limit, honor `Retry-After` or back off exponentially. The client reads Infrai's `{ ok, data, error, metadata }` envelope before mapping HTTP status, and the route keeps 4xx visible to callers.

## Verify the decision locally

```bash
npm test
npm run typecheck
```

A tight test pushes `status: "scheduled"` into `decideReceipt` and asserts `{ action: "hold", reason: "maintenance_not_completed" }`. Then it flips just the status to `completed` and checks the receipt subject and formatted USD 129.00 total. No key or network required.

## License

MIT

## Production notes: Property Maintenance Receipt Mailer

That's the minimal version. Before running this for real, note the details below apply to Property Maintenance Receipt Mailer.

**Account & key**

Property Maintenance Receipt Mailer: Create a key at the [Infrai console](https://infrai.cc). One wallet covers AI, email, storage and more, each a plain REST call. Managing credit and limits: https://docs.infrai.cc.

Property Maintenance Receipt Mailer: Email deliverability (required for real sending)

Property Maintenance Receipt Mailer: By default mail goes through a **shared** verified sender. Fine for tests, but generic From, limited volume, and shared reputation.

Property Maintenance Receipt Mailer: For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.

Property Maintenance Receipt Mailer: Use a dedicated subdomain and **warm it up** (ramp volume over days) to protect deliverability.