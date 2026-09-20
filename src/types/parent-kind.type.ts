import type {
	CatchClauseKind,
	ExpressionKind,
	PatternKind,
	PropertyKind,
	SpreadElementKind,
	SpreadPropertyKind,
	StatementKind,
	SwitchCaseKind,
	VariableDeclaratorKind,
} from 'ast-types/lib/gen/kinds';

export type ParentKind =
	| ExpressionKind
	| StatementKind
	| PropertyKind
	| PatternKind
	| VariableDeclaratorKind
	| CatchClauseKind
	| SpreadElementKind
	| SpreadPropertyKind
	| SwitchCaseKind;
