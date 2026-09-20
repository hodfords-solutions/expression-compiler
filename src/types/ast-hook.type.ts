import type { namedTypes } from 'ast-types';
import type { types } from 'recast';

import type { DataNode } from './data-node.type.js';

export type ASTBeforeHook = (ast: types.namedTypes.File, dataNode: DataNode) => void;

export type ASTAfterHook = (statement: namedTypes.ExpressionStatement, dataNode: DataNode) => void;
