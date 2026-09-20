import { type ASTAfterHook, type ASTBeforeHook, ExpressionCompiler } from './index.js';

const noop = () => {};

describe('ExpressionCompiler', () => {
	describe('execute', () => {
		const compiler = new ExpressionCompiler(noop);

		test('rejects dynamic import', () => {
			expect(() =>
				compiler.execute('{{ import("fs").then((fs) => fs.readFileSync("/etc/hosts")) }}', {}),
			).toThrow('Imports are not supported');
		});

		test('empty expression returns itself', () => {
			expect(compiler.execute('', {})).toBe('');
		});
	});

	describe('ES6 syntax', () => {
		const compiler = new ExpressionCompiler(noop, '___expression_data');

		test('arrow functions', () => {
			expect(typeof compiler.execute('{{ (item) => item.price * 2 }}', {})).toBe('function');
		});

		test('template literal interpolation', () => {
			expect(
				compiler.execute('{{ `Order ${order.id} has ${order.items.length} items` }}', {
					order: { id: 'ORD-9', items: ['mug', 'tee'] },
				}),
			).toBe('Order ORD-9 has 2 items');
		});

		test('spread operator', () => {
			expect(compiler.execute('{{ Math.max(...prices) }}', { prices: [12.5, 24.5, 9] })).toBe(24.5);
		});
	});

	describe('AST hooks', () => {
		test('before hooks see the AST prior to variable expansion', () => {
			const hook: ASTBeforeHook = (ast) => {
				expect(ast.program.body).toHaveLength(1);
				const [statement] = ast.program.body;
				if (statement.type !== 'ExpressionStatement') {
					expect.fail('Expected ExpressionStatement');
				}
				expect(statement.expression.type).toBe('Identifier');
			};

			const compiler = new ExpressionCompiler(noop, undefined, undefined, {
				before: [hook],
				after: [],
			});
			expect(compiler.execute('{{ quantity }}', { quantity: 4 })).toBe(4);
		});

		test('after hooks see the AST after variable expansion', () => {
			const hook: ASTAfterHook = (statement) => {
				expect(statement.type).toBe('ExpressionStatement');
				expect(statement.expression.type).toBe('MemberExpression');
			};

			const compiler = new ExpressionCompiler(noop, undefined, undefined, {
				before: [],
				after: [hook],
			});
			expect(compiler.execute('{{ quantity }}', { quantity: 4 })).toBe(4);
		});
	});
});
