/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Server-side speech synthesis via Gemini.
 *
 * The browser's own `speechSynthesis` obviously cannot run headless, so the
 * `browser_tts` step has two paths: `provider: 'browser'` asks a connected
 * client to speak, while `provider: 'gemini'` synthesises here and ships the
 * audio down for playback. Only the second survives having no config UI open,
 * as long as one playback surface (the dock or overlay) is connected.
 */

import { GoogleGenAI, Modality } from '@google/genai';
import { config } from '../config.js';
import { collection } from '../core/store.js';
import { createLogger } from '../core/logger.js';

const log = createLogger('tts');

let client = null;
let clientKey = null;
let settings = null;

/**
 * The model is a preview build, and every Gemini TTS model currently is —
 * there is no stable one to pin instead. When Google retires this id, every
 * single message fails, so the failure is reported once with the model name
 * in it and then kept quiet until it works again. A line per message would
 * bury the one line that explains what to change.
 */
const MODEL = 'gemini-2.5-flash-preview-tts';
let consecutiveFailures = 0;

export function initTts() {
  settings = collection('ai_settings', { geminiApiKey: '' });
}

/**
 * The Gemini key, from the Connections screen first and the environment
 * second — so AI speech can be set up without touching a file on the server.
 */
const apiKey = () => settings?.get().geminiApiKey || config.gemini.apiKey;

/** Whether a key is set. The key itself is never sent to a client. */
export const getSettings = () => ({ hasGeminiKey: Boolean(apiKey()) });
export const setSettings = (patch) => {
  if (!patch || !patch.geminiApiKey) return settings?.get() ?? {};
  return settings.set({ ...settings.get(), geminiApiKey: String(patch.geminiApiKey).trim() });
};

function ai() {
  const key = apiKey();
  if (!key) return null;
  if (!client || clientKey !== key) { client = new GoogleGenAI({ apiKey: key }); clientKey = key; }
  return client;
}

/**
 * @returns {Promise<string|null>} base64 audio, or null if unavailable
 */
export async function synthesise(text, voiceName = 'Puck') {
  const genai = ai();
  if (!genai) {
    log.warn('no Gemini API key — add one on the Connections screen, or set GEMINI_API_KEY');
    return null;
  }

  try {
    const response = await genai.models.generateContent({
      model: MODEL,
      contents: { parts: [{ text }] },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
      },
    });

    const audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    // A response with no audio in it is a failure like any other, and repeats
    // just as relentlessly, so it goes through the same counter.
    if (!audio) throw new Error('Gemini returned no audio payload');

    if (consecutiveFailures > 0) {
      log.info(`Gemini speech recovered after ${consecutiveFailures} failure(s)`);
      consecutiveFailures = 0;
    }
    return audio;
  } catch (err) {
    consecutiveFailures += 1;
    if (consecutiveFailures === 1) {
      log.error(`speech synthesis failed on model "${MODEL}": ${err.message}`);
      log.error('the caller will fall back to the browser voice; further failures are logged at debug level');
    } else {
      log.debug(`speech synthesis still failing (${consecutiveFailures}):`, err.message);
    }
    return null;
  }
}


export const service = { synthesise };
