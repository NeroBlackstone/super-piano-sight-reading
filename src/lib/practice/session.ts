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

/** 读取上次保存的配置；不存在或结构不完整时返回 null */
export function loadPracticeConfig(): PracticeConfig | null {
	const raw = sessionStorage.getItem(STORAGE_KEY);
	if (!raw) return null;
	try {
		const parsed = JSON.parse(raw) as PracticeConfig;
		// 轻量校验：跳转必经保存流程，这里只需防手改坏数据
		if (!Array.isArray(parsed.keys) || parsed.keys.length === 0) return null;
		if (!Array.isArray(parsed.durations) || parsed.durations.length === 0)
			return null;
		if (!Array.isArray(parsed.range) || parsed.range.length !== 2) return null;
		return parsed;
	} catch {
		return null;
	}
}
