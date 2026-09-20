import { builders } from 'ast-types';

// Host global object name.
const hasWindow = typeof (globalThis as { window?: unknown }).window === 'object';

export const globalIdentifier = builders.identifier(hasWindow ? 'window' : 'global');
