import { test, expect } from '@playwright/test';
import { shouldPromptUpdate } from '../src/hooks/useServiceWorkerUpdate';

/**
 * Pure unit test (no browser navigation) for the controlled PWA-update decision
 * helper. Verifies the truth table that drives whether the update banner shows.
 */

test('shouldPromptUpdate — a waiting worker prompts an update', () => {
  expect(shouldPromptUpdate({ hasWaiting: true, hasController: true })).toBe(true);
  // Even without a controller yet, an already-waiting worker means an update is ready.
  expect(shouldPromptUpdate({ hasWaiting: true, hasController: false })).toBe(true);
});

test('shouldPromptUpdate — a freshly installed worker WITH a controller prompts', () => {
  expect(
    shouldPromptUpdate({ hasWaiting: false, newWorkerState: 'installed', hasController: true }),
  ).toBe(true);
});

test('shouldPromptUpdate — first install (no controller) does NOT prompt', () => {
  expect(
    shouldPromptUpdate({ hasWaiting: false, newWorkerState: 'installed', hasController: false }),
  ).toBe(false);
});

test('shouldPromptUpdate — nothing waiting or installed does NOT prompt', () => {
  expect(shouldPromptUpdate({ hasWaiting: false, hasController: true })).toBe(false);
  expect(shouldPromptUpdate({ hasWaiting: false, hasController: false })).toBe(false);
  expect(
    shouldPromptUpdate({ hasWaiting: false, newWorkerState: 'installing', hasController: true }),
  ).toBe(false);
});
