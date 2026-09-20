import { testExpressionsWithEvaluator } from '../../test/utils/test-expressions-with-evaluator.js';
import { FunctionEvaluator } from './function-evaluator.js';

describe('FunctionEvaluator', () => {
	describe('Test all expression evaluation fixtures', () => {
		testExpressionsWithEvaluator(FunctionEvaluator);
	});
});
