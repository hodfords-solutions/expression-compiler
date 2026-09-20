# @hodfords/expression-compiler

Compile and evaluate template expressions (`{{ ... }}`) against a data context.

## Installation

```sh
npm install @hodfords/expression-compiler
```

## Features

- ES6+ syntax support: arrow functions, template literals, spread, destructuring, classes
- Free identifiers are resolved through the data context, never the host scope
- Pluggable evaluator and AST hooks for expression manipulation
- ESM-only, written in TypeScript with full type definitions

## Usage

```ts
import { ExpressionCompiler } from '@hodfords/expression-compiler';

const compiler = new ExpressionCompiler();

const data = {
	customer: { firstName: 'Mia', lastName: 'Carter', tier: 'gold' },
	order: {
		id: 'ORD-2048',
		status: 'shipped',
		items: [
			{ name: 'Ceramic Mug', quantity: 2, price: 12.5 },
			{ name: 'Logo T-Shirt', quantity: 1, price: 24.5 },
		],
	},
};

// A lone expression returns the raw value
compiler.execute('{{ order.items.length }}', data); // 2

// Text mixed with expressions is joined into a string
compiler.execute('Hi {{ customer.firstName }}, order {{ order.id }} is {{ order.status }}.', data);
// 'Hi Mia, order ORD-2048 is shipped.'

// Template literals
compiler.execute('{{ `${customer.firstName} ${customer.lastName}` }}', data); // 'Mia Carter'

// Arrow functions and array methods
compiler.execute(
	'{{ order.items.map((i) => i.quantity * i.price).reduce((a, b) => a + b, 0) }}',
	data,
);
// 49.5

// Ternaries, nullish coalescing and optional chaining
compiler.execute('{{ customer.tier === "gold" ? 0.1 : 0 }}', data); // 0.1
compiler.execute('{{ customer.phone ?? "N/A" }}', data); // 'N/A'
compiler.execute('{{ order.shipping?.trackingCode }}', data); // undefined

// A backslash before `{{` keeps the braces literal (the backslash is preserved)
compiler.execute('Use \\{{ order.id }} as a placeholder', data); // 'Use \\{{ order.id }} as a placeholder'
```

### Error handling

Runtime errors inside an expression are routed to the error handler passed to the constructor instead of being thrown:

```ts
const compiler = new ExpressionCompiler((error) => {
	console.error('Expression error:', error.message);
});

compiler.execute('{{ order.shipping.carrier }}', { order: {} }); // undefined — handler receives the TypeError
compiler.execute('Via {{ order.shipping.carrier }}', { order: {} }); // 'Via ' — a mixed template still yields a string
```

### Inspecting the compiled code

```ts
const [code, analysis] = compiler.getExpressionCode('{{ order.items.map((i) => i.name) }}');

analysis.has.function; // true
analysis.has.templateString; // false
```

### AST hooks

Hooks run on the parsed expression before and after free identifiers are rewritten to read from the data context. Use them to rewrite, validate, or reject expressions:

```ts
import {
	astVisit,
	ExpressionCompiler,
	type ASTAfterHook,
	type ASTBeforeHook,
} from '@hodfords/expression-compiler';

const rejectAwait: ASTBeforeHook = (ast) => {
	astVisit(ast, {
		visitAwaitExpression() {
			throw new Error('await is not allowed in expressions');
		},
	});
};

const logRewritten: ASTAfterHook = (statement) => {
	console.log(statement.expression.type);
};

const compiler = new ExpressionCompiler(undefined, undefined, undefined, {
	before: [rejectAwait],
	after: [logRewritten],
});
```

### Custom evaluator

The default `FunctionEvaluator` compiles each expression into a cached `Function`. Provide your own by implementing `ExpressionEvaluator`:

```ts
import {
	ExpressionCompiler,
	type ExpressionEvaluator,
	type ReturnValue,
} from '@hodfords/expression-compiler';

class LoggingEvaluator implements ExpressionEvaluator {
	constructor(private instance: ExpressionCompiler) {}

	evaluate(expr: string, data: unknown): ReturnValue {
		const [code] = this.instance.getExpressionCode(expr);
		console.log(code);
		return new Function('E', `${code};`).call(data, this.instance.errorHandler);
	}
}

const compiler = new ExpressionCompiler(undefined, undefined, LoggingEvaluator);
```

### Data node name

The compiled function stores the data context in a lexically-bound variable (default `___expression_data`). Pass a different name as the second constructor argument if it conflicts with a key in your data.

## Development

```sh
pnpm install
pnpm test        # vitest
pnpm typecheck   # tsc --noEmit
pnpm lint        # oxlint
pnpm format      # oxfmt
pnpm build       # emit dist/
```

## License

MIT
