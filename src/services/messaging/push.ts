import pool from "@/lib/db";
import { registerChannel } from "./registry";
import type { Channel, SendResult } from "./types";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

async function deactivateToken(token: string) {
  await pool.query(
    "DELETE FROM device_tokens WHERE token = $1",
    [token]
  );
  await pool.query(
    "UPDATE patient_channels SET active = false, opted_out_at = NOW() WHERE channel = 'push' AND identifier = $1",
    [token]
  );
}

const pushChannel: Channel = {
  name: "push",

  async send(message): Promise<SendResult> {
    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        to: message.to,
        body: message.body,
        title: message.templateName || "GlycoFit",
        sound: "default",
        data: message.variables ? { variables: message.variables } : undefined,
      }),
    });

    if (!res.ok) {
      return { success: false, error: `Expo API error: ${res.status}` };
    }

    const json = await res.json();
    const ticket = json.data?.[0] ?? json.data;

    if (!ticket) {
      return { success: false, error: "No ticket in Expo response" };
    }

    if (ticket.status === "error") {
      if (ticket.details?.error === "DeviceNotRegistered") {
        await deactivateToken(message.to);
      }
      return { success: false, error: ticket.message || ticket.details?.error || "Push failed" };
    }

    return { success: true, providerMsgId: ticket.id };
  },
};

registerChannel("push", pushChannel);
