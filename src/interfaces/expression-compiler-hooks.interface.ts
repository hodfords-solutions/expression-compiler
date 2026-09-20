import type { ASTAfterHook, ASTBeforeHook } from '../types/ast-hook.type.js';

export interface ExpressionCompilerHooks {
	// Runs on the parsed AST before free identifiers are rewritten.
	before: ASTBeforeHook[];
	// Runs on the rewritten expression statement.
	after: ASTAfterHook[];
}
