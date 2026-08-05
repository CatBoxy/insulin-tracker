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
export { registerToken, deactivateToken, getActiveTokens } from "./push-token";
export { personalizeMessage } from "./personalize";
export type { PersonalizationContext, PersonalizationResult, PersonalizationProvenance } from "./personalize";
export { logProvenance } from "./provenance";
export type { ProvenanceParams } from "./provenance";

// Self-register channel adapters
import "./push";
