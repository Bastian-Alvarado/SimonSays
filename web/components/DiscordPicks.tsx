/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The server's channels and roles, for pickers deep inside an editor — the
 * action step editor renders itself recursively, and passing these down
 * through every level of it would be a prop on every step for the sake of one.
 */
import React, { createContext, useContext } from 'react';

export interface DiscordPickData {
  channels: { id: string; name: string; type: number }[];
  roles: { id: string; name: string; color?: number; managed?: boolean }[];
}

const DiscordPicksContext = createContext<DiscordPickData>({ channels: [], roles: [] });

export const DiscordPicksProvider = ({ value, children }: { value: DiscordPickData; children: React.ReactNode }) => (
  <DiscordPicksContext.Provider value={value}>{children}</DiscordPicksContext.Provider>
);

export const useDiscordPicks = () => useContext(DiscordPicksContext);

/** Channels a message can be posted in: text and announcement channels. */
export const textChannels = (channels: DiscordPickData['channels']) => (channels || []).filter((c) => c.type === 0 || c.type === 5);

/** Roles a message can ping: not @everyone itself, and not a bot's own managed role. */
export const pingableRoles = (roles: DiscordPickData['roles']) => (roles || []).filter((r) => r.name !== '@everyone' && !r.managed);
