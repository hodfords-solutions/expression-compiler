import type { ExpressionChunk } from '../types/expression-chunk.type.js';

const OPEN_BRACKETS = '{{';
const CLOSE_BRACKETS = '}}';

const OPEN_BRACKETS_REGEX = /(?<brackets>\{\{)/;
const CLOSE_BRACKETS_REGEX = /(?<brackets>\}\})/;

export function escapeCode(code: string): string {
	return code.replace('\\}}', '}}');
}

function normalizeBackslashes(text: string): string {
	return text.replace(/\\\\/g, '\\');
}

// Escaped when preceded by an odd number of backslashes.
function isEscapedMatch(textBeforeMatch: string): boolean {
	const backslashCount = textBeforeMatch.match(/\\*$/)?.[0]?.length ?? 0;
	return backslashCount % 2 === 1;
}

export function splitExpression(expression: string): ExpressionChunk[] {
	// getExpressionCode relies on an initial text chunk always being present.
	if (expression === '') {
		return [{ type: 'text', text: '' }];
	}

	const chunks: ExpressionChunk[] = [];
	let searchingFor: 'open' | 'close' = 'open';
	let activeRegex = OPEN_BRACKETS_REGEX;
	let buffer = '';
	let cursor = 0;

	while (cursor < expression.length) {
		const remaining = expression.slice(cursor);
		const match = activeRegex.exec(remaining);

		// No more brackets: an unclosed code chunk is accepted and flagged.
		if (!match?.groups) {
			buffer += remaining;
			if (searchingFor === 'open') {
				chunks.push({ type: 'text', text: buffer });
			} else {
				chunks.push({ type: 'code', text: escapeCode(buffer), hasClosingBrackets: false });
			}
			break;
		}

		const textBeforeMatch = remaining.slice(0, match.index);

		if (isEscapedMatch(textBeforeMatch)) {
			const consumed = match.index + OPEN_BRACKETS.length;
			buffer += remaining.slice(0, consumed);
			cursor += consumed;
			continue;
		}

		buffer += textBeforeMatch;

		if (searchingFor === 'open') {
			chunks.push({ type: 'text', text: normalizeBackslashes(buffer) });
			searchingFor = 'close';
			activeRegex = CLOSE_BRACKETS_REGEX;
		} else {
			chunks.push({ type: 'code', text: escapeCode(buffer), hasClosingBrackets: true });
			searchingFor = 'open';
			activeRegex = OPEN_BRACKETS_REGEX;
		}

		cursor += match.index + OPEN_BRACKETS.length;
		buffer = '';
	}

	return chunks;
}

// Only closing brackets are escaped inside code.
function escapeClosingBrackets(code: string) {
	return code.replace(CLOSE_BRACKETS, `\\${CLOSE_BRACKETS}`);
}

export function joinExpression(chunks: ExpressionChunk[]): string {
	return chunks
		.map((chunk) => {
			if (chunk.type === 'code') {
				const closing = chunk.hasClosingBrackets ? CLOSE_BRACKETS : '';
				return `${OPEN_BRACKETS}${escapeClosingBrackets(chunk.text)}${closing}`;
			}
			return chunk.text;
		})
		.join('');
}
