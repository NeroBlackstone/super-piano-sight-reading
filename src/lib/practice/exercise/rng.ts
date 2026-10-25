/** 可复现的随机源：注入生成器后结果可复现，便于测试。 */

/** mulberry32：可复现的轻量伪随机源 */
export function mulberry32(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

export function pick<T>(items: readonly T[], rng: () => number): T {
	return items[Math.floor(rng() * items.length)];
}
