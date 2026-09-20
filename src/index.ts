export type { types as astTypes } from 'recast';
export { visit as astVisit } from 'recast';
export { builders as astBuilders, type namedTypes as astNamedTypes } from 'ast-types';

export { ExpressionCompiler } from './expression-compiler.js';
export type { ExpressionCompilerHooks } from './interfaces/expression-compiler-hooks.interface.js';
export type {
	ExpressionEvaluator,
	ExpressionEvaluatorClass,
} from './interfaces/expression-evaluator.interface.js';
export type { ASTAfterHook, ASTBeforeHook } from './types/ast-hook.type.js';
export type { ReturnValue } from './types/return-value.type.js';
