import { DATA_NODE_NAME } from './constants/data-node-name.js';
import { FunctionEvaluator } from './evaluators/function-evaluator.js';
import { getExpressionCode } from './helpers/expression-builder.js';
import type { ExpressionAnalysis } from './interfaces/expression-analysis.interface.js';
import type { ExpressionCompilerHooks } from './interfaces/expression-compiler-hooks.interface.js';
import type {
	ExpressionEvaluator,
	ExpressionEvaluatorClass,
} from './interfaces/expression-evaluator.interface.js';
import type { ReturnValue } from './types/return-value.type.js';

export class ExpressionCompiler {
	private evaluator!: ExpressionEvaluator;

	constructor(
		public errorHandler: (error: Error) => void = () => {},
		private readonly dataNodeName: string = DATA_NODE_NAME,
		EvaluatorClass: ExpressionEvaluatorClass = FunctionEvaluator,
		private readonly hooks: ExpressionCompilerHooks = { before: [], after: [] },
	) {
		this.setEvaluator(EvaluatorClass);
	}

	setEvaluator(EvaluatorClass: ExpressionEvaluatorClass) {
		this.evaluator = new EvaluatorClass(this);
	}

	getExpressionCode(expression: string): [string, ExpressionAnalysis] {
		return getExpressionCode(expression, this.dataNodeName, this.hooks);
	}

	execute(expression: string, data: unknown): ReturnValue {
		if (!expression) {
			return expression;
		}
		return this.evaluator.evaluate(expression, data);
	}
}
