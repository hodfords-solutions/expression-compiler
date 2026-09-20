import { ERROR_HANDLER_PARAM_NAME } from '../constants/error-handler-param-name.js';
import type { ExpressionCompiler } from '../expression-compiler.js';
import type { ExpressionEvaluator } from '../interfaces/expression-evaluator.interface.js';
import type { ReturnValue } from '../types/return-value.type.js';

export class FunctionEvaluator implements ExpressionEvaluator {
	private readonly compiledCache: Record<string, Function> = {};

	constructor(private readonly compiler: ExpressionCompiler) {}

	private getCompiledFunction(expression: string): Function {
		if (expression in this.compiledCache) {
			return this.compiledCache[expression];
		}
		const [code] = this.compiler.getExpressionCode(expression);
		const compiledFunction = new Function(ERROR_HANDLER_PARAM_NAME, code + ';');
		this.compiledCache[expression] = compiledFunction;
		return compiledFunction;
	}

	evaluate(expression: string, data: unknown): ReturnValue {
		const compiledFunction = this.getCompiledFunction(expression);
		return compiledFunction.call(data, this.compiler.errorHandler);
	}
}
