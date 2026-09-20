import { joinExpression, splitExpression } from './expression-splitter.js';

describe('expression splitter', () => {
	describe('splitting', () => {
		test('lone expression', () => {
			expect(splitExpression('{{ order.id }}')).toEqual([
				{ type: 'text', text: '' },
				{ type: 'code', text: ' order.id ', hasClosingBrackets: true },
			]);
		});

		test('multiple expressions', () => {
			expect(
				splitExpression(
					'{{ customer.firstName.toUpperCase() }} owes ${{ (order.total).toFixed(2) }}.',
				),
			).toEqual([
				{ type: 'text', text: '' },
				{ type: 'code', text: ' customer.firstName.toUpperCase() ', hasClosingBrackets: true },
				{ type: 'text', text: ' owes $' },
				{ type: 'code', text: ' (order.total).toFixed(2) ', hasClosingBrackets: true },
				{ type: 'text', text: '.' },
			]);
		});

		test('unclosed expression', () => {
			expect(
				splitExpression('{{ customer.firstName.toUpperCase() }} owes ${{ (order.total).toFixed(2)'),
			).toEqual([
				{ type: 'text', text: '' },
				{ type: 'code', text: ' customer.firstName.toUpperCase() ', hasClosingBrackets: true },
				{ type: 'text', text: ' owes $' },
				{ type: 'code', text: ' (order.total).toFixed(2)', hasClosingBrackets: false },
			]);
		});

		test('escaped opening brackets', () => {
			expect(splitExpression('template \\{{ not evaluated }}')).toEqual([
				{ type: 'text', text: 'template \\{{ not evaluated }}' },
			]);
		});

		test('escaped closing brackets', () => {
			expect(splitExpression('badge {{ label.wrap("\\}}") }}')).toEqual([
				{ type: 'text', text: 'badge ' },
				{ type: 'code', text: ' label.wrap("}}") ', hasClosingBrackets: true },
			]);
		});

		test('escaped backslashes before opening brackets', () => {
			const expression =
				'D:\\\\Exports\\\\Invoices\\\\2026\\\\Q3\\\\{{ invoice.attachments[0].fileName }}';

			expect(splitExpression(expression)).toEqual([
				{ type: 'text', text: 'D:\\Exports\\Invoices\\2026\\Q3\\' },
				{ type: 'code', text: ' invoice.attachments[0].fileName ', hasClosingBrackets: true },
			]);
		});
	});

	describe('joining round-trips', () => {
		test.each([
			['lone expression', '{{ order.id }}'],
			[
				'multiple expressions',
				'{{ customer.firstName.toUpperCase() }} owes ${{ (order.total).toFixed(2) }}.',
			],
			[
				'unclosed expression',
				'{{ customer.firstName.toUpperCase() }} owes ${{ (order.total).toFixed(2)',
			],
			['escaped opening brackets', 'template \\{{ not evaluated }}'],
			['escaped closing brackets', 'badge {{ label.wrap("\\}}") }}'],
		])('%s', (_, expression) => {
			expect(joinExpression(splitExpression(expression))).toEqual(expression);
		});
	});
});
