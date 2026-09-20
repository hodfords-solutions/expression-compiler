import { parse as esprimaParse } from 'esprima-next';
import type { Config as EsprimaConfig } from 'esprima-next';
import { getOption } from 'recast/lib/util.js';

// recast-compatible parser; parse failures are normalised to `SyntaxError`.
export function parseWithEsprimaNext(source: string, recastOptions?: any): any {
	try {
		return esprimaParse(source, {
			loc: true,
			locations: true,
			comment: true,
			range: getOption(recastOptions, 'range', false) as boolean,
			tolerant: getOption(recastOptions, 'tolerant', true) as boolean,
			tokens: true,
			jsx: getOption(recastOptions, 'jsx', false) as boolean,
			sourceType: getOption(recastOptions, 'sourceType', 'module') as string,
		} as EsprimaConfig);
	} catch (error) {
		if (error instanceof Error) throw new SyntaxError(error.message);
		throw error;
	}
}
