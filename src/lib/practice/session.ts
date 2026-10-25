/**
 * 练习配置在配置页与练习页之间的交接（sessionStorage）。
 *
 * 站点是纯静态的（adapter-static + prerender），无法依赖服务端传参；
 * 配置页点"开始练习"时保存，练习页挂载时读取。
 */
import type { PracticeConfig } from './config.js';

const STORAGE_KEY = 'spsr:practice-config';

export function savePracticeConfig(config: PracticeConfig): void {
	sessionStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

/**
 * 读取上次保存的配置；返回 null 表示无可用数据，调用方回退到默认配置。
 *
 * 存在但解析/结构校验失败时：不兼容任何旧结构，直接清空存储并返回 null。
 */
export function loadPracticeConfig(): PracticeConfig | null {
	const raw = sessionStorage.getItem(STORAGE_KEY);
	if (!raw) return null;
	try {
		const parsed = JSON.parse(raw) as PracticeConfig;
		if (isValidShape(parsed)) return parsed;
	} catch {
		// JSON 损坏，落入下方清空逻辑
	}
	sessionStorage.removeItem(STORAGE_KEY);
	return null;
}

/** 轻量结构校验：字段缺失或形状不符（含旧版结构，如附点曾是 enabled 开关）即无效 */
function isValidShape(parsed: PracticeConfig): boolean {
	return (
		Array.isArray(parsed.keys) &&
		parsed.keys.length > 0 &&
		Array.isArray(parsed.durations) &&
		parsed.durations.length > 0 &&
		Array.isArray(parsed.range) &&
		parsed.range.length === 2 &&
		['random', 'interval', 'chord'].includes(parsed.melody?.mode) &&
		Array.isArray(parsed.melody?.intervals) &&
		['diatonic', 'custom'].includes(parsed.melody?.chord?.source) &&
		Array.isArray(parsed.melody?.chord?.types) &&
		Array.isArray(parsed.melody?.chord?.inversions) &&
		(parsed.melody?.chord?.direction === 'up' ||
			parsed.melody?.chord?.direction === 'down') &&
		Array.isArray(parsed.dots?.durations)
	);
}
