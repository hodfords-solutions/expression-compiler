import { ExpressionCompiler } from '../expression-compiler.js';

const evaluator = new ExpressionCompiler((e) => {
	throw e;
});

describe('generated code', () => {
	it('generates identifier code independent of the global JSON.stringify', () => {
		const [pristine] = evaluator.getExpressionCode('{{ customerName }}');
		expect(pristine).toContain('"customerName"');

		const bogus = 'BOGUS_STRINGIFY_OUTPUT';
		const originalStringify = JSON.stringify;
		let generated: string;
		try {
			JSON.stringify = (() => bogus) as unknown as typeof JSON.stringify;
			[generated] = evaluator.getExpressionCode('{{ orderTotal }}');
		} finally {
			JSON.stringify = originalStringify;
		}

		expect(generated).not.toContain(bogus);
		expect(generated).toBe(pristine.replace(/customerName/g, 'orderTotal'));
	});

	it('renders text chunks and the join separator independent of the global JSON.stringify', () => {
		const [pristine] = evaluator.getExpressionCode('Total: {{ orderTotal }}');
		expect(pristine).toContain('["Total: "');
		expect(pristine).toContain('].join("")');

		const bogus = 'BOGUS_STRINGIFY_OUTPUT';
		const originalStringify = JSON.stringify;
		let generated: string;
		try {
			JSON.stringify = (() => bogus) as unknown as typeof JSON.stringify;
			[generated] = evaluator.getExpressionCode('Total: {{ orderTotal }}');
		} finally {
			JSON.stringify = originalStringify;
		}

		// The text chunk and join separator render verbatim; neither is routed
		// through the global.
		expect(generated).toContain('["Total: "');
		expect(generated).toContain('].join("")');
	});

	it.each([
		['a line separator', 'line\u2028break'],
		['a paragraph separator', 'para\u2029break'],
		['quotes, a backslash and a newline', 'note: "fragile"\\\n\thandle'],
	])('round-trips text chunks containing %s', (_, text) => {
		expect(evaluator.execute(`${text} {{ count }}`, { count: 3 })).toBe(`${text} 3`);
	});
});
