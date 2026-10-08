import { Injectable, Logger } from "@nestjs/common";

export interface PushMessage {
  to: string;
  title: string;
  body: string;
  /** Read by the app when the notification is tapped (e.g. { url: "/activity" }). */
  data?: Record<string, unknown>;
}

interface ExpoTicket {
  status: "ok" | "error";
  details?: { error?: string };
}

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_BATCH_SIZE = 100;

/**
 * Minimal client for Expo's push service, which relays to APNs/FCM: no SDK
 * dependency, just its documented HTTP API. Returns the tokens Expo reports
 * as no longer registered so callers can forget them.
 */
@Injectable()
export class ExpoPushClient {
  private readonly logger = new Logger(ExpoPushClient.name);

  async send(messages: PushMessage[]): Promise<string[]> {
    const deadTokens: string[] = [];
    for (let i = 0; i < messages.length; i += EXPO_BATCH_SIZE) {
      const batch = messages.slice(i, i + EXPO_BATCH_SIZE);
      try {
        const response = await fetch(EXPO_PUSH_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(
            batch.map((m) => ({ ...m, sound: "default", channelId: "default", priority: "high" })),
          ),
        });
        if (!response.ok) {
          this.logger.warn(`Expo push failed with status ${response.status}`);
          continue;
        }
        const { data } = (await response.json()) as { data?: ExpoTicket[] };
        data?.forEach((ticket, index) => {
          if (ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered") {
            deadTokens.push(batch[index].to);
          }
        });
      } catch (err) {
        this.logger.warn(`Expo push unreachable: ${(err as Error).message}`);
      }
    }
    return deadTokens;
  }
}
