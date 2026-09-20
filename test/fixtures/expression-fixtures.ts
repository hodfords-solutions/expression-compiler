export interface ExpressionCase {
	data: Record<string, unknown>;
	output: unknown;
}

export interface ExpressionFixture {
	expression: string;
	// Empty means the expression only has to compile.
	cases: ExpressionCase[];
}

const customer = { firstName: 'Mia', lastName: 'Carter', email: 'mia@shop.example', tier: 'gold' };
const order = {
	id: 'ORD-2048',
	status: 'shipped',
	subtotal: 249.5,
	discountRate: 10,
	tags: ['fragile', 'priority'],
	items: [
		{ sku: 'MUG-01', name: 'Ceramic Mug', quantity: 2, price: 12.5 },
		{ sku: 'TEE-XL', name: 'Logo T-Shirt', quantity: 1, price: 24.5 },
	],
	shipping: { carrier: 'DHL', trackingCode: 'DHL7781234', eta: '2026-09-25T09:00:00.000Z' },
	placedAt: '2026-09-20T08:15:30.250Z',
	paidAt: '2026-09-20T08:25:30.250Z',
};

export const expressionFixtures: ExpressionFixture[] = [
	{
		expression: '{{customer["firstName"]}}',
		cases: [
			{ data: { customer }, output: 'Mia' },
			{ data: { customer: null }, output: undefined },
		],
	},
	{
		expression: '{{ order["status"] }}',
		cases: [
			{ data: { order }, output: 'shipped' },
			{ data: { order: { status: 3 } }, output: 3 },
			{ data: { order: { status: null } }, output: null },
			{ data: { order: {} }, output: undefined },
		],
	},
	{
		expression: '{{order["shipping"]["trackingCode"]}}',
		cases: [{ data: { order }, output: 'DHL7781234' }],
	},
	{
		expression: '{{settings[settings["activeCurrencyKey"]]}}',
		cases: [
			{
				data: { settings: { activeCurrencyKey: 'eur', eur: '€', usd: '$' } },
				output: '€',
			},
		],
	},
	{
		expression: '{{order["items"][0]["name"]}}',
		cases: [{ data: { order }, output: 'Ceramic Mug' }],
	},
	{
		expression: 'https://shop.example/api/v2/customers/{{customer["id"]}}/orders/{{order["id"]}}',
		cases: [
			{
				data: { customer: { id: 'CUS-77' }, order },
				output: 'https://shop.example/api/v2/customers/CUS-77/orders/ORD-2048',
			},
		],
	},
	{
		expression: ' {{order["shipping"]["carrier"]}}',
		cases: [{ data: { order }, output: ' DHL' }],
	},
	{
		expression: '{{lookup(0).customer["firstName"]}}{{order["id"]}}',
		cases: [
			{
				data: { lookup: (index: number) => [{ customer }][index], order },
				output: 'MiaORD-2048',
			},
		],
	},
	{
		expression: '{{pageIndex}}',
		cases: [{ data: { pageIndex: 0 }, output: 0 }],
	},
	{
		expression: '{{ new String().toString() }}',
		cases: [{ data: {}, output: '' }],
	},
	{
		expression: '{{(Date.parse(order["paidAt"])-Date.parse(order["placedAt"]))/(60*1000)}}',
		cases: [{ data: { order }, output: 10 }],
	},
	{
		expression: '{{order["items"].length}}',
		cases: [{ data: { order }, output: 2 }],
	},
	{
		expression: '{{ order.toString() }}',
		cases: [{ data: { order }, output: '[object Object]' }],
	},
	{
		expression: '{{Math.floor(Math.min(order.discountRate, 25) * 10);}}',
		cases: [{ data: { order }, output: 100 }],
	},
	{
		expression: '{{catalog["商品カタログ"].banners["hero"][0]}}',
		cases: [
			{
				data: { catalog: { 商品カタログ: { banners: { hero: ['autumn.jpg'] } } } },
				output: 'autumn.jpg',
			},
		],
	},
	{
		expression: '{{ customer["phone"] ?? "N/A"}}',
		cases: [
			{ data: { customer: { phone: '+1 415 555 0111' } }, output: '+1 415 555 0111' },
			{ data: { customer: { phone: null } }, output: 'N/A' },
			{ data: { customer: {} }, output: 'N/A' },
			{ data: {}, output: undefined },
		],
	},
	{
		expression: "{{request['headers'][\"x-shop-id\"] +'-'+ new String('web').toString()}}",
		cases: [{ data: { request: { headers: { 'x-shop-id': 'shop42' } } }, output: 'shop42-web' }],
	},
	{
		expression: "{{request['headers'][\"x-shop-id\"] +'-'+ parseInt(request.page)}}",
		cases: [
			{ data: { request: { headers: { 'x-shop-id': 'shop42' }, page: '3' } }, output: 'shop42-3' },
		],
	},
	{
		expression: '{{ [].concat(order["tags"]) }}',
		cases: [{ data: { order }, output: ['fragile', 'priority'] }],
	},
	{
		expression: 'https://track.example/?code={{order["shipping"]["trackingCode"].substr(0,6)}}',
		cases: [{ data: { order }, output: 'https://track.example/?code=DHL778' }],
	},
	{
		expression: '{{ ticket["subject"].match(/\\[(\\d+)]/)[1] }}',
		cases: [{ data: { ticket: { subject: 'Refund request [5521]' } }, output: '5521' }],
	},
	{
		expression:
			'{{(new Date(order["shipping"]["eta"]).getTime() - new Date(order["placedAt"]).getTime()) / (1000 * 3600 * 24) > 4}}',
		cases: [{ data: { order }, output: true }],
	},
	{
		expression:
			'{{ campaign["name"] == "" ? "Campaign #" + (campaign["count"] + 1) : campaign["name"] }}',
		cases: [
			{ data: { campaign: { name: '', count: 3 } }, output: 'Campaign #4' },
			{ data: { campaign: { name: 'Autumn Sale', count: 3 } }, output: 'Autumn Sale' },
		],
	},
	{
		expression: '{{new Date(order["placedAt"]).toISOString()}}',
		cases: [{ data: { order }, output: '2026-09-20T08:15:30.250Z' }],
	},
	{
		expression: '{{order["items"][0]["quantity"]+1}}',
		cases: [{ data: { order }, output: 3 }],
	},
	{
		expression:
			'{{ (parseFloat(quote["unitPrice"].replace(\',\', \'.\')) * parseFloat(quote["quantity"])).toFixed(2) }}',
		cases: [{ data: { quote: { unitPrice: '3,80', quantity: '10' } }, output: '38.00' }],
	},
	{
		expression:
			'{\n\t"notification": {\n\t\t"title": "{{order["id"]}}",\n\t\t"read": false,\n\t\t"body": "{{message["body"]}}",\n\t\t"tags":["{{order["status"]}}"]\n\t}\n}',
		cases: [
			{
				data: { order, message: { body: 'Your parcel is on the way' } },
				output: `{
	"notification": {
		"title": "ORD-2048",
		"read": false,
		"body": "Your parcel is on the way",
		"tags":["shipped"]
	}
}`,
			},
		],
	},
	{
		expression: '{{coupon["code"] != "" && coupon["code"] != null && coupon["code"] != undefined}}',
		cases: [
			{ data: { coupon: { code: 'WELCOME10' } }, output: true },
			{ data: { coupon: { code: '' } }, output: false },
			{ data: { coupon: { code: null } }, output: false },
			{ data: { coupon: {} }, output: false },
		],
	},
	{
		expression: '{{response["nextCursor"] ? true : false}}',
		cases: [
			{ data: { response: { nextCursor: 'abc' } }, output: true },
			{ data: { response: {} }, output: false },
		],
	},
	{
		expression: '{{Math.min(order.subtotal, 100);}}',
		cases: [{ data: { order }, output: 100 }],
	},
	{
		expression: '{{new String().toString();}}',
		cases: [{ data: {}, output: '' }],
	},
	{
		expression: '{{ !!contact["email"] || !!contact["phone"] }}',
		cases: [
			{ data: { contact: { email: 'a@b.c' } }, output: true },
			{ data: { contact: { phone: '0900' } }, output: true },
			{ data: { contact: {} }, output: false },
			{ data: { contact: { phone: '0900', email: 'a@b.c' } }, output: true },
		],
	},
	{
		expression: '{{200}}',
		cases: [{ data: {}, output: 200 }],
	},
	{
		expression: '{{order.subtotal * order.discountRate / 100}}',
		cases: [{ data: { order }, output: 24.95 }],
	},
	{
		expression: '{{/^\\d+$/.test(search["query"])}}',
		cases: [
			{ data: { search: { query: '2048' } }, output: true },
			{ data: { search: { query: 'mug' } }, output: false },
		],
	},
	{
		expression: '{{ `Order\nshipped\nvia\nDHL` }}',
		cases: [{ data: {}, output: 'Order\nshipped\nvia\nDHL' }],
	},
	{
		expression: '{{ { "items": order.items.length } }}',
		cases: [{ data: { order }, output: { items: 2 } }],
	},
	{
		expression: '{{ validation["errors"] && validation["errors"].length > 0 }}',
		cases: [
			{ data: { validation: { errors: ['sku', 'qty'] } }, output: true },
			{ data: { validation: { errors: [] } }, output: false },
			{ data: { validation: {} }, output: undefined },
		],
	},
	{
		expression: '{{unknownField}}',
		cases: [
			{ data: {}, output: undefined },
			{ data: { somethingElse: 1 }, output: undefined },
		],
	},
	{
		expression: '{{!!validation["errors"]}}',
		cases: [
			{ data: { validation: { errors: [] } }, output: true },
			{ data: { validation: {} }, output: false },
		],
	},
	{
		expression: 'ACTIVE',
		cases: [{ data: {}, output: 'ACTIVE' }],
	},
	{
		expression: '{{ !response?.data?.orders?.pageInfo?.hasNextPage }}',
		cases: [
			{
				data: { response: { data: { orders: { pageInfo: { hasNextPage: true } } } } },
				output: false,
			},
			{
				data: { response: { data: { orders: { pageInfo: { hasNextPage: false } } } } },
				output: true,
			},
			{ data: { response: { data: { orders: { pageInfo: {} } } } }, output: true },
			{ data: { response: { data: { orders: {} } } }, output: true },
			{ data: { response: { data: {} } }, output: true },
			{ data: { response: {} }, output: true },
			{ data: {}, output: true },
		],
	},
	{
		expression: "{{ [{'warehouse': 'NYC-01', 'capacity':5000, 'zones':['A']}] }}",
		cases: [{ data: {}, output: [{ warehouse: 'NYC-01', capacity: 5000, zones: ['A'] }] }],
	},
	{
		expression: '{{typeof customer["lastName"] != "undefined"}}',
		cases: [
			{ data: { customer }, output: true },
			{ data: { customer: {} }, output: false },
		],
	},
	{
		expression: "{{ response?.total == undefined ? '' : response.total }}",
		cases: [
			{ data: { response: { total: 12 } }, output: 12 },
			{ data: {}, output: '' },
		],
	},
	{
		expression: "{{ 'referrer' in visit && visit.referrer != null}}",
		cases: [
			{ data: { visit: { referrer: 'google' } }, output: true },
			{ data: { visit: { referrer: null } }, output: false },
			{ data: { visit: {} }, output: false },
		],
	},
	{
		expression: '{{ String("shipped").length }}',
		cases: [{ data: {}, output: 7 }],
	},
	{
		expression:
			'{{ order.items.map((item) => item.quantity * item.price).reduce((a, b) => a + b, 0) }}',
		cases: [{ data: { order }, output: 49.5 }],
	},
	{
		expression: '{{ `${customer.firstName} ${customer.lastName} <${customer.email}>` }}',
		cases: [{ data: { customer }, output: 'Mia Carter <mia@shop.example>' }],
	},
	{
		expression: 'Hi {{ customer.firstName }}, order {{ order.id }} is {{ order.status }}.',
		cases: [{ data: { customer, order }, output: 'Hi Mia, order ORD-2048 is shipped.' }],
	},

	// Compile-only
	{ expression: '{{ warehouse?.find(stock.sku)?.quantity }}', cases: [] },
	{ expression: '{{orders("pending", 1)[position].shipping.trackingCode}}', cases: [] },
	{ expression: '', cases: [] },
	{ expression: 'Ref {{ Math.random(42) }} generated', cases: [] },
	{ expression: `{{ note.body.split('\\n') }} and {{ note.title.split("-") }}`, cases: [] },
	{ expression: '{{ `\nline\nline\n` }}', cases: [] },
	{ expression: '{{ new Date }}', cases: [] },
	{ expression: '{{ new Date() }}', cases: [] },
	{ expression: '{{ new Date.toISOString() }}', cases: [] },
	{ expression: '{{ new Date().toISOString() }}', cases: [] },
	{ expression: '{{ global.counter = 3 }}', cases: [] },
	{ expression: '{{ window.counter = 3 }}', cases: [] },
	{ expression: '{{ this.counter = 3 }}', cases: [] },
	{
		expression: `Summary
		line
{{ "static" }}
{{ dynamic }}
`,
		cases: [],
	},
	{ expression: '{{window}}', cases: [] },
	{ expression: '{{global}}', cases: [] },
	{ expression: '{{counter = 3}}', cases: [] },
];
