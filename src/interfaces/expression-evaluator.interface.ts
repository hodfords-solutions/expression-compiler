import type { ExpressionCompiler } from '../expression-compiler.js';
import type { ReturnValue } from '../types/return-value.type.js';

export interface ExpressionEvaluator {
	evaluate(expression: string, data: unknown): ReturnValue;
}

export interface ExpressionEvaluatorClass {
	new (compiler: ExpressionCompiler): ExpressionEvaluator;
}
