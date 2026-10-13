/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Condition evaluation for `condition` action steps: `{ matchType, conditions[] }`,
 * every check or any of them. (The single-check form V2 saved was read here
 * until 2.0.0; nothing stored still holds it.)
 */

import { resolve, interpolate } from './variables.js';
import { createLogger } from '../core/logger.js';

const log = createLogger('conditions');

/** Coerce the loose values coming out of the UI into a comparable form. */
function truthy(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const s = value.trim().toLowerCase();
    return s !== '' && s !== 'false' && s !== '0' && s !== 'no';
  }
  return Boolean(value);
}

function compare(actual, operator, expected) {
  const aStr = actual === undefined || actual === null ? '' : String(actual);
  const eStr = expected === undefined || expected === null ? '' : String(expected);

  switch (operator) {
    case 'equals':
      return aStr.toLowerCase() === eStr.toLowerCase();
    case 'contains':
      return aStr.toLowerCase().includes(eStr.toLowerCase());
    case 'startsWith':
      return aStr.toLowerCase().startsWith(eStr.toLowerCase());
    case 'endsWith':
      return aStr.toLowerCase().endsWith(eStr.toLowerCase());
    case 'matchesRegex':
      try {
        return new RegExp(eStr, 'i').test(aStr);
      } catch (err) {
        // An invalid regex is an authoring mistake, not a runtime crash.
        log.warn(`invalid regex "${eStr}":`, err.message);
        return false;
      }
    case 'greaterThan':
      return Number(actual) > Number(expected);
    case 'lessThan':
      return Number(actual) < Number(expected);
    case 'isTrue':
      return truthy(actual);
    case 'isFalse':
      return !truthy(actual);
    default:
      log.warn(`unknown operator "${operator}"`);
      return false;
  }
}

/**
 * @returns {boolean} whether the branch should take `thenActions`
 */
export function evaluate(logic, ctx) {
  const matchType = logic?.matchType === 'OR' ? 'OR' : 'AND';
  const conditions = Array.isArray(logic?.conditions) ? logic.conditions : [];

  // A condition step with no conditions passes — matching the UI's implication
  // that an empty condition block is a no-op rather than a hard stop.
  if (conditions.length === 0) return true;

  const results = conditions.map((c) => {
    const actual = resolve(c.variable, ctx);
    // The right-hand side may itself reference variables.
    const expected = interpolate(c.value, ctx);
    const result = compare(actual, c.operator, expected);
    log.debug(`${c.variable}(${JSON.stringify(actual)}) ${c.operator} ${JSON.stringify(expected)} => ${result}`);
    return result;
  });

  return matchType === 'OR' ? results.some(Boolean) : results.every(Boolean);
}
