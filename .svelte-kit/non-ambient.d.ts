
// this file is generated — do not edit it


declare module "svelte/elements" {
	export interface HTMLAttributes<T> {
		'data-sveltekit-keepfocus'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-noscroll'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-preload-code'?:
			| true
			| ''
			| 'eager'
			| 'viewport'
			| 'hover'
			| 'tap'
			| 'off'
			| undefined
			| null;
		'data-sveltekit-preload-data'?: true | '' | 'hover' | 'tap' | 'off' | undefined | null;
		'data-sveltekit-reload'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-replacestate'?: true | '' | 'off' | undefined | null;
	}
}

export {};


declare module "$app/types" {
	export interface AppTypes {
		RouteId(): "/" | "/api" | "/api/fetch-bill-text" | "/api/openAI" | "/api/pdf" | "/bill" | "/bill/[id]" | "/table";
		RouteParams(): {
			"/bill/[id]": { id: string }
		};
		LayoutParams(): {
			"/": { id?: string };
			"/api": Record<string, never>;
			"/api/fetch-bill-text": Record<string, never>;
			"/api/openAI": Record<string, never>;
			"/api/pdf": Record<string, never>;
			"/bill": { id?: string };
			"/bill/[id]": { id: string };
			"/table": Record<string, never>
		};
		Pathname(): "/" | "/api" | "/api/" | "/api/fetch-bill-text" | "/api/fetch-bill-text/" | "/api/openAI" | "/api/openAI/" | "/api/pdf" | "/api/pdf/" | "/bill" | "/bill/" | `/bill/${string}` & {} | `/bill/${string}/` & {} | "/table" | "/table/";
		ResolvedPathname(): `${"" | `/${string}`}${ReturnType<AppTypes['Pathname']>}`;
		Asset(): "/logo.af" | "/logo.afphoto" | "/logo.af~lock~" | "/Logo.png" | "/Logo.svg" | "/robots.txt" | string & {};
	}
}