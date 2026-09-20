import { builders, namedTypes } from 'ast-types';
import type { StatementKind, VariableDeclaratorKind } from 'ast-types/lib/gen/kinds';
import type { NodePath } from 'ast-types/lib/node-path';
import type { Scope } from 'ast-types/lib/scope';
import type { types } from 'recast';
import { visit } from 'recast';

import { EXEMPT_IDENTIFIER_LIST } from '../constants/exempt-identifiers.js';
import { POLYFILL_EXCEPTIONS } from '../constants/polyfill-exceptions.js';
import type { DataNode } from '../types/data-node.type.js';
import type { ParentKind } from '../types/parent-kind.type.js';
import { globalIdentifier } from './global-identifier.js';
import { rawStringLiteral } from './raw-string-literal.js';

// Exhaustiveness guard for the parent-type switch.
function assertNever(_value: never): _value is never {
	return true;
}

// ("name" in <data> ? <data> : global).name
function buildDataContextLookup(
	identifier: types.namedTypes.Identifier,
	dataNode: DataNode,
): namedTypes.MemberExpression {
	const { name } = identifier;
	const owner = builders.conditionalExpression(
		builders.binaryExpression('in', rawStringLiteral(name), dataNode),
		dataNode,
		globalIdentifier,
	);
	return builders.memberExpression(owner, builders.identifier(name));
}

// Nodes that bound a block-scoped declaration. Loop heads are visible in the loop body.
const REGION_TYPES: ReadonlySet<string> = new Set<namedTypes.ASTNode['type']>([
	'BlockStatement',
	'SwitchStatement',
	'Program',
	'ForStatement',
	'ForInStatement',
	'ForOfStatement',
]);

// Node bounding a binding's visibility, 'scope' for the whole scope, or undefined when
// unmodelled (treated as not visible).
type BindingRegion = namedTypes.Node | 'scope' | undefined;

const WHOLE_SCOPE: BindingRegion = 'scope';

function lexicalRegionOf(declaration: NodePath): BindingRegion {
	for (let ancestor: NodePath | null = declaration.parent; ancestor; ancestor = ancestor.parent) {
		const node: namedTypes.Node = ancestor.node;
		if (REGION_TYPES.has(node.type)) {
			return node;
		}
	}
	return undefined;
}

function bindingRegionOf(binding: NodePath): BindingRegion {
	for (let ancestor: NodePath | null = binding.parent; ancestor; ancestor = ancestor.parent) {
		const node: namedTypes.Node = ancestor.node;
		if (namedTypes.VariableDeclaration.check(node)) {
			return node.kind === 'var' ? WHOLE_SCOPE : lexicalRegionOf(ancestor);
		}
		if (namedTypes.ClassDeclaration.check(node)) {
			return lexicalRegionOf(ancestor);
		}
		if (namedTypes.FunctionDeclaration.check(node)) {
			if (node.id !== binding.node) {
				return WHOLE_SCOPE;
			}
			// Annex B hoisting is ignored; block-scoped like strict mode.
			return lexicalRegionOf(ancestor);
		}
		if (namedTypes.CatchClause.check(node) || namedTypes.Function.check(node)) {
			return WHOLE_SCOPE;
		}
	}
	return undefined;
}

function regionContains(region: namedTypes.Node, path: NodePath) {
	let child: NodePath = path;
	for (let ancestor: NodePath | null = path.parent; ancestor; ancestor = ancestor.parent) {
		if (ancestor.node === region) {
			// A switch discriminant is evaluated outside the case environment; a case test is not.
			return !(namedTypes.SwitchStatement.check(region) && child.node === region.discriminant);
		}
		child = ancestor;
	}
	return false;
}

function isInScope(path: NodePath<types.namedTypes.Identifier>) {
	const { name } = path.node;
	let scope = path.scope as Scope;
	while (scope !== null) {
		// declares() is hasOwn; guards names like `constructor` against Object.prototype.
		if (scope.declares(name)) {
			const declaringPaths: NodePath[] = scope.getBindings()[name] ?? [];
			for (const binding of declaringPaths) {
				const region = bindingRegionOf(binding);
				if (region === 'scope') {
					return true;
				}
				if (region !== undefined && regionContains(region, path)) {
					return true;
				}
			}
		}
		scope = scope.parent as Scope;
	}
	return false;
}

// Rewrites a free identifier to resolve through the data context.
function polyfillVar(path: NodePath<types.namedTypes.Identifier>, dataNode: DataNode) {
	if (isInScope(path)) {
		return;
	}
	if (POLYFILL_EXCEPTIONS.includes(path.node.name)) {
		return;
	}
	path.replace(buildDataContextLookup(path.node, dataNode));
}

// Per parent type, which identifier positions are free reads.
type ParentTypePatcher = (
	path: NodePath<types.namedTypes.Identifier>,
	parent: any,
	dataNode: DataNode,
) => void;

const parentTypePatchers: Partial<Record<ParentKind['type'], ParentTypePatcher>> = {
	MemberExpression(path, parent: namedTypes.MemberExpression, dataNode) {
		if (parent.object === path.node || parent.computed) {
			polyfillVar(path, dataNode);
		}
	},
	OptionalMemberExpression(path, parent: namedTypes.OptionalMemberExpression, dataNode) {
		if (parent.object === path.node) {
			polyfillVar(path, dataNode);
		}
	},
	Property(path, parent: namedTypes.Property, dataNode) {
		if (parent.computed && parent.key === path.node) {
			polyfillVar(path, dataNode);
			return;
		}
		if (path.node !== parent.value) {
			return;
		}
		// `const { a } = ...` binds `a`, not a read.
		const objectPattern = path.parent?.parent?.node as namedTypes.ObjectPattern;
		if (!objectPattern) {
			return;
		}
		const patternParent: VariableDeclaratorKind = path.parent.parent.parent?.node;
		if (!patternParent) {
			return;
		}
		if (patternParent.type === 'VariableDeclarator' && patternParent.id === objectPattern) {
			return;
		}

		parent.shorthand = false;
		polyfillVar(path, dataNode);
	},
	AssignmentPattern(path, parent: namedTypes.AssignmentPattern, dataNode) {
		if (parent.right === path.node) {
			polyfillVar(path, dataNode);
		}
	},
	VariableDeclarator(path, parent: namedTypes.VariableDeclarator, dataNode) {
		if (parent.init === path.node) {
			polyfillVar(path, dataNode);
		}
	},
	ArrowFunctionExpression(path, parent: namedTypes.ArrowFunctionExpression, dataNode) {
		// A bare identifier body (`() => value`) is a free read.
		if (parent.body === path.node) {
			polyfillVar(path, dataNode);
		}
	},
	SpreadElement(path, parent: namedTypes.SpreadElement, dataNode) {
		if (parent.argument === path.node) {
			polyfillVar(path, dataNode);
		}
	},
	SpreadProperty(path, parent: namedTypes.SpreadProperty, dataNode) {
		if (parent.argument === path.node) {
			polyfillVar(path, dataNode);
		}
	},
	MethodDefinition(path, parent: namedTypes.MethodDefinition, dataNode) {
		if (parent.computed && parent.key === path.node) {
			polyfillVar(path, dataNode);
		}
	},
	SwitchCase(path, parent: namedTypes.SwitchCase, dataNode) {
		if (parent.test === path.node) {
			polyfillVar(path, dataNode);
		}
	},
	ClassDeclaration(path, parent: namedTypes.ClassDeclaration, dataNode) {
		if (parent.superClass === path.node) {
			polyfillVar(path, dataNode);
		}
	},
	ClassExpression(path, parent: namedTypes.ClassExpression, dataNode) {
		if (parent.superClass === path.node) {
			polyfillVar(path, dataNode);
		}
	},
};

export function jsVariablePolyfill(
	ast: types.namedTypes.File,
	dataNode: DataNode,
): StatementKind[] | undefined {
	visit(ast, {
		visitImportExpression() {
			throw new Error('Imports are not supported');
		},
		visitIdentifier(path) {
			this.traverse(path);
			const parent: ParentKind = path.parent.node;

			if (EXEMPT_IDENTIFIER_LIST.includes(path.node.name)) {
				return;
			}

			switch (parent.type) {
				case 'AssignmentPattern':
				case 'Property':
				case 'MemberExpression':
				case 'OptionalMemberExpression':
				case 'VariableDeclarator':
				case 'ArrowFunctionExpression':
				case 'SpreadElement':
				case 'SpreadProperty':
				case 'MethodDefinition':
				case 'SwitchCase':
				case 'ClassDeclaration':
				case 'ClassExpression':
					const patcher = parentTypePatchers[parent.type];
					if (!patcher) {
						throw new Error(`Couldn't find custom patcher for parent type: ${parent.type}`);
					}
					patcher(path, parent, dataNode);
					break;
				case 'BinaryExpression':
				case 'UnaryExpression':
				case 'ArrayExpression':
				case 'AssignmentExpression':
				case 'SequenceExpression':
				case 'YieldExpression':
				case 'UpdateExpression':
				case 'LogicalExpression':
				case 'ConditionalExpression':
				case 'NewExpression':
				case 'CallExpression':
				case 'OptionalCallExpression':
				case 'TaggedTemplateExpression':
				case 'TemplateLiteral':
				case 'AwaitExpression':
				case 'ImportExpression':
				case 'ForStatement':
				case 'IfStatement':
				case 'WhileStatement':
				case 'ForInStatement':
				case 'ForOfStatement':
				case 'SwitchStatement':
				case 'ReturnStatement':
				case 'DoWhileStatement':
				case 'ExpressionStatement':
				case 'ForAwaitStatement':
				case 'ThrowStatement':
				case 'WithStatement':
				case 'TupleExpression':
					polyfillVar(path, dataNode);
					break;

				// Not reads
				case 'Super':
				case 'Identifier':
				case 'FunctionDeclaration':
				case 'FunctionExpression':
				case 'ThisExpression':
				case 'ObjectExpression':
				case 'MetaProperty':
				case 'ChainExpression':
				case 'PrivateName':
				case 'ParenthesizedExpression':
				case 'Import':
				case 'VariableDeclaration':
				case 'CatchClause':
				case 'BlockStatement':
				case 'TryStatement':
				case 'EmptyStatement':
				case 'LabeledStatement':
				case 'BreakStatement':
				case 'ContinueStatement':
				case 'DebuggerStatement':
				case 'ImportDeclaration':
				case 'ExportDeclaration':
				case 'ExportAllDeclaration':
				case 'ExportDefaultDeclaration':
				case 'Noop':
				case 'ClassMethod':
				case 'ClassPrivateMethod':
				case 'RestElement':
				case 'ArrayPattern':
				case 'ObjectPattern':
				case 'RecordExpression':
				case 'V8IntrinsicIdentifier':
				case 'TopicReference':
				case 'ClassProperty':
				case 'StaticBlock':
				case 'ClassBody':
				case 'ExportNamedDeclaration':
				case 'ClassPrivateProperty':
				case 'ClassAccessorProperty':
				case 'PropertyPattern':
					break;

				case 'SpreadElementPattern':
				case 'SpreadPropertyPattern':
				case 'ClassPropertyDefinition':
					break;

				// Flow types
				case 'DeclareClass':
				case 'DeclareModule':
				case 'DeclareVariable':
				case 'DeclareFunction':
				case 'DeclareInterface':
				case 'DeclareTypeAlias':
				case 'DeclareOpaqueType':
				case 'DeclareModuleExports':
				case 'DeclareExportDeclaration':
				case 'DeclareExportAllDeclaration':
				case 'InterfaceDeclaration':
				case 'TypeAlias':
				case 'OpaqueType':
				case 'EnumDeclaration':
				case 'TypeCastExpression':
					break;

				// TypeScript types
				case 'TSAsExpression':
				case 'TSTypeParameter':
				case 'TSTypeAssertion':
				case 'TSDeclareMethod':
				case 'TSIndexSignature':
				case 'TSDeclareFunction':
				case 'TSMethodSignature':
				case 'TSEnumDeclaration':
				case 'TSExportAssignment':
				case 'TSNonNullExpression':
				case 'TSPropertySignature':
				case 'TSModuleDeclaration':
				case 'TSParameterProperty':
				case 'TSTypeCastExpression':
				case 'TSSatisfiesExpression':
				case 'TSTypeAliasDeclaration':
				case 'TSInterfaceDeclaration':
				case 'TSImportEqualsDeclaration':
				case 'TSExternalModuleReference':
				case 'TSInstantiationExpression':
				case 'TSTypeParameterDeclaration':
				case 'TSCallSignatureDeclaration':
				case 'TSNamespaceExportDeclaration':
				case 'TSConstructSignatureDeclaration':
					break;

				// Literals that can't contain an identifier
				case 'DirectiveLiteral':
				case 'StringLiteral':
				case 'NumericLiteral':
				case 'BigIntLiteral':
				case 'NullLiteral':
				case 'Literal':
				case 'RegExpLiteral':
				case 'BooleanLiteral':
				case 'DecimalLiteral':
					break;

				// Proposals that are stage 0 or 1
				case 'DoExpression':
				case 'BindExpression':
					break;

				// JSX is not supported
				case 'JSXIdentifier':
				case 'JSXText':
				case 'JSXElement':
				case 'JSXFragment':
				case 'JSXMemberExpression':
				case 'JSXExpressionContainer':
					break;

				// Legacy generator/iterator proposals
				case 'ComprehensionExpression':
				case 'GeneratorExpression':
					polyfillVar(path, dataNode);
					break;

				default:
					assertNever(parent);
					polyfillVar(path, dataNode);
					break;
			}
		},
	});

	return ast.program.body;
}
