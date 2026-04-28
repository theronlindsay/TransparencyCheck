import { AsyncLocalStorage } from 'node:async_hooks';
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import util from 'node:util';
import { fileURLToPath } from 'node:url';

const LOG_CAPTURE_STORAGE = new AsyncLocalStorage();
const GLOBAL_LOGGING_KEY = Symbol.for('transparencycheck.server.logging');
const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const SERVER_APP_ROOT = path.resolve(MODULE_DIR, '../../..');
const REPO_ROOT = path.resolve(SERVER_APP_ROOT, '../..');
const MAX_CAPTURED_LOG_LINES =
	Number.parseInt(process.env.ADMIN_CAPTURE_LOG_LIMIT ?? '1200', 10) || 1200;

function defaultLogFilePath() {
	const configuredPath = process.env.ADMIN_LOG_FILE?.trim();
	if (configuredPath) {
		return configuredPath;
	}

	const cwd = process.cwd();
	const isRunningFromServerApp =
		cwd === SERVER_APP_ROOT || cwd.startsWith(`${SERVER_APP_ROOT}${path.sep}`);
	const baseDir = isRunningFromServerApp ? REPO_ROOT : cwd;

	return path.join(baseDir, 'logs', 'server.log');
}

function ensureLogDirectory(filePath) {
	const dir = path.dirname(filePath);
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}
}

function formatArgs(args) {
	return util.formatWithOptions(
		{
			colors: false,
			depth: 6,
			maxArrayLength: 40,
			breakLength: 120
		},
		...args
	);
}

function createLoggerState() {
	const filePath = defaultLogFilePath();
	ensureLogDirectory(filePath);

	const originalConsole = {
		log: console.log.bind(console),
		info: console.info.bind(console),
		warn: console.warn.bind(console),
		error: console.error.bind(console),
		debug: console.debug.bind(console)
	};

	return {
		filePath,
		installed: false,
		originalConsole,
		runtimeLines: [],
		maxRuntimeLines: 2000
	};
}

function getLoggerState() {
	if (!globalThis[GLOBAL_LOGGING_KEY]) {
		globalThis[GLOBAL_LOGGING_KEY] = createLoggerState();
	}

	return globalThis[GLOBAL_LOGGING_KEY];
}

function writeStructuredLog(level, args) {
	const state = getLoggerState();
	const rendered = formatArgs(args);
	const line = `[${new Date().toISOString()}] [${level}] ${rendered}`;

	state.runtimeLines.push(line);
	if (state.runtimeLines.length > state.maxRuntimeLines) {
		state.runtimeLines.splice(0, state.runtimeLines.length - state.maxRuntimeLines);
	}

	try {
		ensureLogDirectory(state.filePath);
		appendFileSync(state.filePath, `${line}\n`, 'utf8');
	} catch (error) {
		state.originalConsole.error('[Logging] Failed to append to log file:', error);
	}

	const store = LOG_CAPTURE_STORAGE.getStore();
	if (store?.lines) {
		if (store.lines.length < store.maxLines) {
			store.lines.push(line);
		} else if (!store.truncated) {
			store.lines.push(
				`[${new Date().toISOString()}] [WARN] [Logging] Captured log limit reached; additional lines omitted from action response`
			);
			store.truncated = true;
		}
	}

	return { state, rendered };
}

export function installServerLogging() {
	const state = getLoggerState();
	if (state.installed) {
		return state;
	}

	const patchMethod = (level, methodName) => {
		console[methodName] = (...args) => {
			const { rendered } = writeStructuredLog(level, args);
			state.originalConsole[methodName](rendered);
		};
	};

	patchMethod('INFO', 'log');
	patchMethod('INFO', 'info');
	patchMethod('WARN', 'warn');
	patchMethod('ERROR', 'error');
	patchMethod('DEBUG', 'debug');

	state.installed = true;
	console.info('[Logging] Server log capture enabled', { filePath: state.filePath });

	return state;
}

export async function runWithLogCapture(task) {
	installServerLogging();

	const store = {
		lines: [],
		maxLines: MAX_CAPTURED_LOG_LINES,
		truncated: false
	};

	return await LOG_CAPTURE_STORAGE.run(store, async () => {
		const result = await task();
		return {
			result,
			logs: [...store.lines]
		};
	});
}

export function getLogFilePath() {
	return installServerLogging().filePath;
}

export function readServerLogs({ limit = 600 } = {}) {
	const state = installServerLogging();
	let fileLines = [];

	try {
		ensureLogDirectory(state.filePath);
		if (existsSync(state.filePath)) {
			fileLines = readFileSync(state.filePath, 'utf8').split('\n').filter(Boolean);
		}
	} catch (error) {
		state.originalConsole.error('[Logging] Failed to read log file:', error);
	}

	if (fileLines.length === 0) {
		fileLines = [...state.runtimeLines];
	}

	return {
		filePath: state.filePath,
		lines: Number.isFinite(limit) && limit > 0 ? fileLines.slice(-limit) : fileLines
	};
}
