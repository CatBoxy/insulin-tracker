/**
 * Shared types for the messaging channel abstraction.
 *
 * Channel adapters (WhatsApp, push, future channels) implement the
 * Channel interface.  The sender and scheduler depend only on these
 * types — never on adapter internals.
 */

export interface SendResult {
  success: boolean;
  providerMsgId?: string;
  error?: string;
}

export interface Channel {
  name: string;
  send(message: {
    to: string;
    body: string;
    templateName?: string;
    variables?: Record<string, string>;
  }): Promise<SendResult>;
}
