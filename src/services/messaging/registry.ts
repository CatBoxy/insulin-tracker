/**
 * Channel registry.
 *
 * Adapters register themselves at startup via registerChannel().
 * The sender resolves a channel by name at send time — it never
 * imports adapter modules directly.
 *
 * Adding a new channel = one new adapter file + one registerChannel() call.
 * No changes to the sender, scheduler, or message log.
 */

import { Channel } from "./types";

const channels: Map<string, Channel> = new Map();

export function registerChannel(name: string, channel: Channel): void {
  channels.set(name, channel);
}

export function getChannel(name: string): Channel | undefined {
  return channels.get(name);
}

export function listChannels(): string[] {
  return Array.from(channels.keys());
}
