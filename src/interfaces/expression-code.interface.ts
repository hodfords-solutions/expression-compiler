export interface ExpressionCode {
	type: 'code';
	text: string;
	// False when the final `}}` is missing.
	hasClosingBrackets: boolean;
}
