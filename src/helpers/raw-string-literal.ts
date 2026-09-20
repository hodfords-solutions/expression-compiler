import type { namedTypes } from 'ast-types';
import { builders } from 'ast-types';

type LiteralWithRaw = namedTypes.Literal & { extra?: { raw: string; rawValue: string } };

// Captured at load time so a replaced global cannot affect printing.
const safeStringify = JSON.stringify;

// String literal with a precomputed printed form (`extra.raw`), emitted verbatim by recast.
export function rawStringLiteral(value: string) {
	const literal: LiteralWithRaw = builders.literal(value);
	// U+2028/U+2029 are escaped so the emitted literal stays single-line.
	const raw = safeStringify(value)
		.replace(/\u2028/g, '\\u2028')
		.replace(/\u2029/g, '\\u2029');
	literal.extra = { raw, rawValue: value };
	return literal;
}
