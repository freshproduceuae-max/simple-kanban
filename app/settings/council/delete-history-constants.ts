/**
 * F29 — constants shared between the delete-history Server Action and
 * its UI surface. Extracted from `./actions.ts` because a `'use server'`
 * module may only export async functions.
 */

/**
 * The literal phrase the user must type into the confirmation input
 * before `deleteAllHistoryAction` will run. Comparison is
 * case-insensitive and trimmed.
 */
export const DELETE_ALL_PHRASE = 'delete my history';
