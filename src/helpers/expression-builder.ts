import type { namedTypes } from 'ast-types';
import { builders } from 'ast-types';
import type { ExpressionKind, StatementKind } from 'ast-types/lib/gen/kinds';
import type { types } from 'recast';
import { parse, print, visit } from 'recast';

import { ERROR_HANDLER_PARAM_NAME } from '../constants/error-handler-param-name.js';
import type { ExpressionAnalysis } from '../interfaces/expression-analysis.interface.js';
import type { ExpressionCode } from '../interfaces/expression-code.interface.js';
import type { ExpressionCompilerHooks } from '../interfaces/expression-compiler-hooks.interface.js';
import type { ExpressionText } from '../interfaces/expression-text.interface.js';
import type { DataNode } from '../types/data-node.type.js';
import { splitExpression } from './expression-splitter.js';
import { globalIdentifier } from './global-identifier.js';
import { parseWithEsprimaNext } from './parser.js';
import { rawStringLiteral } from './raw-string-literal.js';
import { jsVariablePolyfill } from './variable-polyfill.js';

type ParsedFile = types.namedTypes.File;
type ParsedCodeChunk = ExpressionCode & { parsed: ParsedFile };
export type ParsedChunk = ExpressionText | ParsedCodeChunk;

// Parameter of each chunk function, reused as the local holding its value.
const valueIdentifier = builders.identifier('v');

// Identifiers that always require a try/catch wrapper.
const ALWAYS_WRAP_IDENTIFIERS = ['window', 'global', 'this'];

function isParsedCodeChunk(chunk: ParsedChunk): chunk is ParsedCodeChunk {
	return chunk.type === 'code';
}

// Member access, calls and host-global reads can throw at runtime.
function shouldWrapInTry(node: namedTypes.ASTNode): boolean {
	let shouldWrap = false;

	visit(node, {
		visitMemberExpression() {
			shouldWrap = true;
			return false;
		},
		visitCallExpression() {
			shouldWrap = true;
			return false;
		},
		visitIdentifier(path) {
			if (ALWAYS_WRAP_IDENTIFIERS.includes(path.node.name)) {
				shouldWrap = true;
				return false;
			}
			this.traverse(path);
			return;
		},
	});

	return shouldWrap;
}

function hasFunction(node: namedTypes.ASTNode): boolean {
	let found = false;

	visit(node, {
		visitFunctionExpression() {
			found = true;
			return false;
		},
		visitFunctionDeclaration() {
			found = true;
			return false;
		},
		visitArrowFunctionExpression() {
			found = true;
			return false;
		},
	});

	return found;
}

// Template literals without `${}` interpolation do not count.
function hasTemplateString(node: namedTypes.ASTNode): boolean {
	let found = false;

	visit(node, {
		visitTemplateLiteral(path) {
			if (path.node.expressions.length) {
				found = true;
				return false;
			}
			this.traverse(path);
			return;
		},
	});

	return found;
}

// try { <statement> } catch (e) { E(e, this) }
function wrapInErrorHandler(statement: StatementKind): namedTypes.TryStatement {
	const caughtError = builders.identifier('e');

	return builders.tryStatement(
		builders.blockStatement([statement]),
		builders.catchClause(
			caughtError,
			null,
			builders.blockStatement([
				builders.expressionStatement(
					builders.callExpression(builders.identifier(ERROR_HANDLER_PARAM_NAME), [
						caughtError,
						builders.thisExpression(),
					]),
				),
			]),
		),
	);
}

// A leading `{` would parse as a block statement.
function wrapObjectLiteral(code: string): string {
	if (code.trimStart()[0] === '{') {
		return '(' + code + ')';
	}
	return code;
}

// v = (<expression>)
// return v || v === 0 || v === false ? v : ""
function buildChunkFunctionBody(expression: ExpressionKind): namedTypes.BlockStatement {
	const assignValue = builders.expressionStatement(
		builders.assignmentExpression('=', valueIdentifier, expression),
	);
	const isKeptFalsy = builders.logicalExpression(
		'||',
		builders.logicalExpression(
			'||',
			valueIdentifier,
			builders.binaryExpression('===', valueIdentifier, builders.literal(0)),
		),
		builders.binaryExpression('===', valueIdentifier, builders.literal(false)),
	);
	const returnValueOrEmpty = builders.returnStatement(
		builders.conditionalExpression(isKeptFalsy, valueIdentifier, rawStringLiteral('')),
	);

	return builders.blockStatement([assignValue, returnValueOrEmpty]);
}

// Template string quasis keep literal new lines; escape them.
function escapeNewLines(text: string): string {
	return text.replace(/\n/g, '\\n');
}

function fixTemplateStringNewLines(file: ParsedFile): ParsedFile {
	visit(file, {
		visitTemplateElement(path) {
			this.traverse(path);
			const { cooked, raw } = path.node.value;
			const element = builders.templateElement(
				{
					cooked: cooked === null ? null : escapeNewLines(cooked),
					raw: escapeNewLines(raw),
				},
				path.node.tail,
			);
			path.replace(element);
		},
	});

	return file;
}

// before hooks -> variable polyfill -> after hooks
function prepareCodeChunk(
	chunk: ParsedCodeChunk,
	dataNode: DataNode,
	hooks: ExpressionCompilerHooks,
): namedTypes.ExpressionStatement {
	const file = fixTemplateStringNewLines(chunk.parsed);
	for (const beforeHook of hooks.before) {
		beforeHook(file, dataNode);
	}

	const statement = jsVariablePolyfill(file, dataNode)?.[0];
	if (statement?.type !== 'ExpressionStatement') {
		throw new SyntaxError('Not a expression statement');
	}

	for (const afterHook of hooks.after) {
		afterHook(statement, dataNode);
	}

	return statement;
}

// (function (v) { <body> }).call(this)
function buildChunkCall(statement: namedTypes.ExpressionStatement): namedTypes.CallExpression {
	const functionBody = buildChunkFunctionBody(statement.expression);

	if (shouldWrapInTry(statement)) {
		const [assignValue, returnValue] = functionBody.body;
		functionBody.body = [
			wrapInErrorHandler(assignValue),
			// Emits the `;` after the try/catch (`emptyStatement` prints to nothing).
			builders.expressionStatement(builders.identifier('')),
			returnValue,
		];
	}

	const chunkFunction = builders.functionExpression(null, [valueIdentifier], functionBody);
	return builders.callExpression(
		builders.memberExpression(chunkFunction, builders.identifier('call')),
		[builders.thisExpression()],
	);
}

export function getParsedExpression(expression: string): ParsedChunk[] {
	return splitExpression(expression).map<ParsedChunk>((chunk) => {
		if (chunk.type !== 'code') {
			return chunk;
		}
		const parsed = parse(wrapObjectLiteral(chunk.text), {
			parser: { parse: parseWithEsprimaNext },
		}) as ParsedFile;
		return { ...chunk, parsed };
	});
}

// A blank text chunk followed by a single code chunk returns the raw value;
// anything else is joined into a string.
function shouldJoinAsString(chunks: ParsedChunk[]): boolean {
	return (
		chunks.length > 2 ||
		chunks[0].text !== '' ||
		// Blank expression returns an empty string.
		(chunks[0].text === '' && chunks.length === 1)
	);
}

// return [<part>, ...].join(""), or `return <part>` for a single part
function buildJoinedReturn(parts: ExpressionKind[]): namedTypes.ReturnStatement {
	if (parts.length < 2) {
		return builders.returnStatement(parts[0]);
	}
	const nonEmptyParts = parts.filter((part) => !(part.type === 'Literal' && part.value === ''));
	return builders.returnStatement(
		builders.callExpression(
			builders.memberExpression(
				builders.arrayExpression(nonEmptyParts),
				builders.identifier('join'),
			),
			[rawStringLiteral('')],
		),
	);
}

export function getExpressionCode(
	expression: string,
	dataNodeName: string,
	hooks: ExpressionCompilerHooks,
): [string, ExpressionAnalysis] {
	const chunks = getParsedExpression(expression);
	const codeChunks = chunks.filter(isParsedCodeChunk);

	// `this` is captured in a local so member shadowing cannot reach the data context.
	const dataNode: DataNode = builders.identifier(dataNodeName);

	const program = builders.program([
		builders.variableDeclaration('var', [
			builders.variableDeclarator(globalIdentifier, builders.objectExpression([])),
		]),
		builders.variableDeclaration('var', [
			builders.variableDeclarator(dataNode, builders.thisExpression()),
		]),
	]);

	const analysis: ExpressionAnalysis = {
		has: {
			function: codeChunks.some((chunk) => hasFunction(chunk.parsed)),
			templateString: codeChunks.some((chunk) => hasTemplateString(chunk.parsed)),
		},
	};

	if (shouldJoinAsString(chunks)) {
		const parts = chunks.map<ExpressionKind>((chunk) =>
			isParsedCodeChunk(chunk)
				? buildChunkCall(prepareCodeChunk(chunk, dataNode, hooks))
				: rawStringLiteral(chunk.text),
		);
		program.body.push(buildJoinedReturn(parts));
	} else {
		const statement = prepareCodeChunk(chunks[1] as ParsedCodeChunk, dataNode, hooks);
		const returnValue: StatementKind = builders.returnStatement(statement.expression);
		program.body.push(shouldWrapInTry(statement) ? wrapInErrorHandler(returnValue) : returnValue);
	}

	return [print(program).code, analysis];
}
