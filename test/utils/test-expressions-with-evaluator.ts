import type { ExpressionEvaluatorClass } from '../../src/index.js';
import { ExpressionCompiler } from '../../src/index.js';
import { expressionFixtures } from '../fixtures/expression-fixtures.js';

const builtins = { String, parseFloat, parseInt };

export function testExpressionsWithEvaluator(EvaluatorClass: ExpressionEvaluatorClass) {
	const compiler = new ExpressionCompiler(() => {}, undefined, EvaluatorClass);

	for (const fixture of expressionFixtures) {
		if (fixture.cases.length === 0) {
			test(`compiles: ${JSON.stringify(fixture.expression)}`, () => {
				expect(() => compiler.getExpressionCode(fixture.expression)).not.toThrow();
			});
			continue;
		}

		test(fixture.expression, () => {
			for (const { data, output } of fixture.cases) {
				expect(compiler.execute(fixture.expression, { ...builtins, ...data })).toStrictEqual(
					output,
				);
			}
		});
	}
}
