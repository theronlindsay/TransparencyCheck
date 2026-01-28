const manifest = (() => {
function __memo(fn) {
	let value;
	return () => value ??= (value = fn());
}

return {
	appDir: "_app",
	appPath: "_app",
	assets: new Set([]),
	mimeTypes: {},
	_: {
		client: {start:"_app/immutable/entry/start.DWN4PNxM.js",app:"_app/immutable/entry/app.DmuWjhdC.js",imports:["_app/immutable/entry/start.DWN4PNxM.js","_app/immutable/chunks/CrpFs2Bk.js","_app/immutable/chunks/D65Aohti.js","_app/immutable/chunks/Cj7GYydn.js","_app/immutable/entry/app.DmuWjhdC.js","_app/immutable/chunks/D65Aohti.js","_app/immutable/chunks/D-fxd4uE.js","_app/immutable/chunks/CyQ1XSHI.js","_app/immutable/chunks/Cj7GYydn.js","_app/immutable/chunks/CyQNoRgJ.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
		nodes: [
			__memo(() => import('./chunks/0-jVX3gWJA.js')),
			__memo(() => import('./chunks/1-dPUa4C_L.js'))
		],
		remotes: {
			
		},
		routes: [
			{
				id: "/api/bills",
				pattern: /^\/api\/bills\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server-CVyfvNpQ.js'))
			},
			{
				id: "/api/bills/[id]",
				pattern: /^\/api\/bills\/([^/]+?)\/?$/,
				params: [{"name":"id","optional":false,"rest":false,"chained":false}],
				page: null,
				endpoint: __memo(() => import('./chunks/_server-BsGCUzKA.js'))
			},
			{
				id: "/api/fetch-bill-text",
				pattern: /^\/api\/fetch-bill-text\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server-UP7zuWAC.js'))
			},
			{
				id: "/api/openAI",
				pattern: /^\/api\/openAI\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server-BJwKgBNs.js'))
			},
			{
				id: "/api/pdf",
				pattern: /^\/api\/pdf\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server-B8yXEAbK.js'))
			},
			{
				id: "/api/search-bills",
				pattern: /^\/api\/search-bills\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server-aUTsoZQC.js'))
			}
		],
		prerendered_routes: new Set([]),
		matchers: async () => {
			
			return {  };
		},
		server_assets: {}
	}
}
})();

const prerendered = new Set([]);

const base = "";

export { base, manifest, prerendered };
//# sourceMappingURL=manifest.js.map
