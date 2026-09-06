import { createServer } from "node:http";
import { ZodError } from "zod";
import { InfraiError } from "./infrai_email.js";
import { maintenanceReceiptSchema, processMaintenanceReceipt } from "./maintenance_receipt.js";

const port = Number(process.env.PORT ?? 3000);

function json(response: import("node:http").ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/maintenance/receipt") {
    json(response, 404, { error: "route_not_found" });
    return;
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const input = maintenanceReceiptSchema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    const result = await processMaintenanceReceipt(input);
    json(response, result.action === "hold" ? 202 : 201, result);
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      json(response, 400, { error: "invalid_request", details: error.message });
      return;
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      json(response, status, { error: error.code, message: error.message });
      return;
    }
    json(response, 500, { error: "service_error" });
  }
}).listen(port, () => console.log(`Property mail service listening on http://localhost:${port}`));
