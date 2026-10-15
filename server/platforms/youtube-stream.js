/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * YouTube's live chat as it is sent, rather than asked for every few
 * seconds: liveChatMessages.streamList over HTTP. The answer is one JSON
 * array that never closes while the chat goes on, each element a
 * liveChatMessageListResponse — `[{…}` now, `,{…}` a moment later — so it is
 * read a piece at a time and each whole element handed over as it completes.
 *
 * One connection costs what one look at the chat did (5 units), where looking
 * every seven seconds cost about 2,600 an hour. server/platforms/youtube.js
 * opens it, opens it again from where it left off when YouTube closes it, and
 * goes back to looking when this does not work.
 */

/**
 * Whole values out of a streamed top-level JSON array, as they complete:
 * `feed(text)` with each piece as it arrives, `onItem(value)` for each
 * element. Text before the array that is not one (an object, an HTML error
 * page) throws a "not a stream" error, so the caller can stop expecting one.
 */
export function streamedArray(onItem) {
  let opened = false;
  let depth = 0;
  let inString = false;
  let escaped = false;
  let current = '';
  return (text) => {
    for (const ch of text) {
      if (!opened) {
        if (ch === '[') { opened = true; continue; }
        if (/\s/.test(ch)) continue;
        const err = new Error('YouTube: the answer is not a stream of chat');
        err.reason = 'notAStream';
        throw err;
      }
      if (depth === 0) {
        // Between elements: commas, line breaks, and the array's end.
        if (ch === '{' || ch === '[') { depth = 1; current = ch; }
        continue;
      }
      current += ch;
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === '\\') escaped = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') inString = true;
      else if (ch === '{' || ch === '[') depth += 1;
      else if (ch === '}' || ch === ']') {
        depth -= 1;
        if (depth === 0) {
          const whole = current;
          current = '';
          onItem(JSON.parse(whole));
        }
      }
    }
  };
}

/** A refusal from YouTube as an error the rest of youtube.js understands: its status, message and reason (quotaExceeded, liveChatEnded…). */
function refused(status, body) {
  const json = Array.isArray(body) ? body[0] : body;
  const err = new Error(`YouTube ${status}: ${json?.error?.message || 'refused'}`);
  err.reason = json?.error?.errors?.[0]?.reason || '';
  err.status = status;
  return err;
}

/**
 * One connection to the chat, read until YouTube closes it (resolves) or it
 * fails (throws). `onResponse` gets each liveChatMessageListResponse.
 */
export async function readChatStream({ url, token, signal, onResponse, fetchImpl = fetch }) {
  const res = await fetchImpl(url, { headers: { Authorization: `Bearer ${token}` }, signal });
  if (!res.ok) {
    let body = null;
    try { body = JSON.parse(await res.text()); } catch { /* not JSON: said by its status */ }
    throw refused(res.status, body);
  }
  if (!res.body || typeof res.body[Symbol.asyncIterator] !== 'function') {
    const err = new Error('YouTube: the answer is not a stream of chat');
    err.reason = 'notAStream';
    throw err;
  }
  const feed = streamedArray((item) => {
    if (item?.error) throw refused(item.error.code || res.status, item);
    onResponse(item);
  });
  const decoder = new TextDecoder();
  for await (const chunk of res.body) feed(typeof chunk === 'string' ? chunk : decoder.decode(chunk, { stream: true }));
}

/**
 * A streamed message in the shape the list method gives, which is what
 * handleMessage reads: the stream may name a type as the proto does
 * (TEXT_MESSAGE_EVENT) where the list says textMessageEvent.
 */
export function asListed(item) {
  const type = item?.snippet?.type;
  if (typeof type !== 'string' || !/^[A-Z_]+$/.test(type)) return item;
  const camel = type.toLowerCase().replace(/_([a-z])/g, (_, c) => c.toUpperCase());
  return { ...item, snippet: { ...item.snippet, type: camel } };
}
