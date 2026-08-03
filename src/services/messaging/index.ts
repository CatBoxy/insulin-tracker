/**
 * Messaging channel abstraction — public API.
 *
 * Consumers import from "@/services/messaging":
 *   import { sendMessage, registerChannel, recordEvent } from "@/services/messaging";
 */

export type { Channel, SendResult } from "./types";
export { registerChannel, getChannel, listChannels } from "./registry";
export { sendMessage } from "./sender";
export { recordEvent, updateMessageStatus } from "./events";
