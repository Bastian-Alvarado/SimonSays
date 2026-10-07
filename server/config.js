/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Environment-driven configuration.
 *
 * V2 hardcoded secrets directly in server.js ("YOUR_CLIENT_ID_HERE"). That made
 * the file impossible to commit safely and impossible to run in more than one
 * environment. Everything now comes from the environment with sane defaults.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Minimal .env loader.
 *
 * Node's own `--env-file` flag is version-sensitive (it hard-errors on a
 * missing file before 20.12), and pulling in dotenv for ~15 lines of parsing
 * is not worth a dependency. Real environment variables always win, so
 * `PORT=9000 npm start` still overrides the file.
 */
function loadEnvFile() {
  const candidates = [
    process.env.ENV_FILE,
    path.join(__dirname, '..', '.env'),
    path.join(__dirname, '.env'),
  ].filter(Boolean);

  const file = candidates.find((p) => fs.existsSync(p));
  if (!file) return;

  for (const rawLine of fs.readFileSync(file, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const eq = line.indexOf('=');
    if (eq === -1) continue;

    const key = line.slice(0, eq).trim();
    if (key in process.env) continue; // real env wins

    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnvFile();

const num = (v, fallback) => {
  const n = Number.parseInt(v ?? '', 10);
  return Number.isNaN(n) ? fallback : n;
};

const bool = (v, fallback) => {
  if (v === undefined || v === '') return fallback;
  return v === 'true' || v === '1';
};

export const config = {
  port: num(process.env.PORT, 8081),
  host: process.env.HOST || '0.0.0.0',

  // Where runtime state lives. Override to relocate the whole database.
  dataDir: process.env.DATA_DIR || path.join(__dirname, '..', 'data'),
  assetsDir: process.env.ASSETS_DIR || path.join(__dirname, '..', 'assets'),

  // Served to the config UI so it can build OAuth redirect URLs.
  publicUrl: process.env.PUBLIC_URL || 'http://localhost:5173',

  discord: {
    clientId: process.env.DISCORD_CLIENT_ID || '',
    clientSecret: process.env.DISCORD_CLIENT_SECRET || '',
    botToken: process.env.DISCORD_BOT_TOKEN || '',
  },

  twitch: {
    clientId: process.env.TWITCH_CLIENT_ID || '',
    // Optional: only needed for the app-access-token flows.
    clientSecret: process.env.TWITCH_CLIENT_SECRET || '',
  },

  spotify: {
    clientId: process.env.SPOTIFY_CLIENT_ID || '',
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET || '',
    // How often the server polls the Now Playing endpoint.
    pollIntervalMs: num(process.env.SPOTIFY_POLL_MS, 3000),
  },

  kick: {
    clientId: process.env.KICK_CLIENT_ID || '01KG2S47PDE3JBHWBHZBCS1M6G',
  },

  obs: {
    host: process.env.OBS_HOST || 'localhost',
    port: num(process.env.OBS_PORT, 4455),
    password: process.env.OBS_PASSWORD || '',
    autoConnect: bool(process.env.OBS_AUTOCONNECT, true),
  },

  tiktok: {
    // How often to retry connecting while a creator is offline.
    //
    // Deliberately 5 minutes: each attempt consumes a request against the
    // signing service's rate limit, and polling aggressively burns through the
    // quota. Do not lower this without a signing API key that can afford it.
    pollIntervalMs: num(process.env.TIKTOK_POLL_MS, 5 * 60 * 1000),

    // Optional Euler Stream key. Requests are signed through that service;
    // without a key you get the shared anonymous quota, which is the reason
    // the poll interval above is conservative.
    signApiKey: process.env.TIKTOK_SIGN_API_KEY || process.env.EULER_API_KEY || '',
  },

  gemini: {
    apiKey: process.env.GEMINI_API_KEY || process.env.API_KEY || '',
  },

  logLevel: process.env.LOG_LEVEL || 'info',

  // Auto-reconnect platforms on boot using stored credentials.
  autoStart: bool(process.env.AUTO_START, true),
};

export function describeConfig() {
  const mask = (s) => (s ? `${'*'.repeat(Math.max(0, Math.min(8, s.length - 4)))}${s.slice(-4)}` : '(unset)');
  return {
    port: config.port,
    dataDir: config.dataDir,
    discordClientId: config.discord.clientId || '(unset)',
    discordBotToken: mask(config.discord.botToken),
    twitchClientId: config.twitch.clientId || '(unset)',
    spotifyClientId: config.spotify.clientId || '(unset)',
    obs: `${config.obs.host}:${config.obs.port}`,
    geminiKey: mask(config.gemini.apiKey),
  };
}
