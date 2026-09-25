/**
 * Ordinary HTTP route for human approval of alerts.
 * NOT an MCP tool — agent cannot reach or invoke this endpoint.
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Method not allowed. Use POST." }));
    return;
  }

  // Check ALERT_WEBHOOK_URL environment variable
  const webhookUrl = process.env.ALERT_WEBHOOK_URL;
  if (!webhookUrl || !webhookUrl.trim()) {
    res.statusCode = 503;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        error: "ALERT_WEBHOOK_URL is not set. Add it in Vercel and redeploy."
      })
    );
    return;
  }

  const { draft_id, subject, message } = req.body || {};

  // Validate message length and presence
  if (
    !message ||
    typeof message !== "string" ||
    message.trim().length === 0 ||
    message.length > 500
  ) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        error: "Message is required and must not exceed 500 characters."
      })
    );
    return;
  }

  try {
    const webhookRes = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        content: message, // standard for Discord webhooks
        text: message, // standard for Slack webhooks
        subject: subject || "Transport Alert",
        message,
        draft_id: draft_id || null
      })
    });

    const status = webhookRes.status;

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        status,
        ok: webhookRes.ok,
        draft_id
      })
    );
  } catch (err) {
    res.statusCode = 502;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        error: `Failed to deliver alert to webhook: ${err?.message || "Delivery error"}`
      })
    );
  }
}
