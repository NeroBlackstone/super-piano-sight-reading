/**
 * 按 PracticeConfig 生成一道视奏题（纯函数，随机源可注入，便于测试与复现）。
 *
 * 生成结果只描述"要演奏什么"（音高、时值、记号），不含任何渲染信息；
 * 谱面渲染由 #lib/components/practice/staff.svelte（VexFlow）完成。
 * 取音来源见 pitch-source.ts / chord-source.ts，节奏与小节填充见 rhythm.ts。
 */
import type { KeyId, PracticeConfig } from '../config.js';
import { makeChordSource } from './chord-source.js';
import type { Exercise, NoteEvent } from './event.js';
import {
	makeIntervalSource,
	makeRandomSource,
	type PitchSource
} from './pitch-source.js';
import { generateMeasure } from './rhythm.js';

/** 按配置的旋律模式创建取音来源 */
function makePitchSource(
	config: PracticeConfig,
	key: KeyId,
	rng: () => number
): PitchSource {
	if (config.melody.mode === 'interval') {
		return makeIntervalSource(config, key, rng);
	}
	if (config.melody.mode === 'chord') {
		return makeChordSource(config, key, rng);
	}
	return makeRandomSource(config, key, rng);
}

/** 按配置生成一道完整题目 */
export function generateExercise(
	config: PracticeConfig,
	rng: () => number
): Exercise {
	const key = config.key;
	// 取音来源跨小节持有：音程模式的"上一个音"锚点贯穿整题
	const nextPitch = makePitchSource(config, key, rng);
	const measures: NoteEvent[][] = [];
	for (let i = 0; i < config.measuresPerExercise; i++) {
		measures.push(
			generateMeasure(config, config.timeSignature, nextPitch, rng)
		);
	}
	return {
		key,
		clef: config.clef,
		timeSignature: config.timeSignature,
		tempo: config.tempo,
		measures
	};
}
