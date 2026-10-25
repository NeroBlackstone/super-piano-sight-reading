/**
 * 按 PracticeConfig 生成一道视奏题（纯函数，随机源可注入，便于测试与复现）。
 *
 * 生成结果只描述"要演奏什么"（音高、时值、记号），不含任何渲染信息；
 * 谱面渲染由 #lib/components/practice/staff.svelte（VexFlow）完成。
 */
import type {
	Clef,
	Duration,
	KeyId,
	PracticeConfig,
	TimeSignature
} from '../config.js';
import {
	type Exercise,
	MEASURE_CAPACITY,
	type NoteEvent,
	UNITS
} from './event.js';
import {
	ACC_SUFFIX,
	KEY_ALTERATIONS,
	LETTERS,
	NATURAL_PC,
	scaleDegrees,
	spell
} from './pitch.js';
import { pick, weightedPick } from './rng.js';
import { tripletCrossesBeat } from './two-level-rule.js';

/** 休止符在谱表上的默认位置 */
const REST_KEYS: Record<Clef, string> = {
	treble: 'b/4',
	bass: 'd/3'
};

/** 生成频率自然化的权重（%）：八分 37、十六分 26、四分 20 */
const NATURAL_DURATION_WEIGHTS: Record<Duration, number> = {
	eighth: 37,
	sixteenth: 26,
	quarter: 20,
	whole: 0,
	half: 0
};

/** 权重表之外的时值（全音符、二分音符）合计分享的份额 */
const OTHER_DURATION_WEIGHT = 17;

/**
 * 自然化权重：命名时值取自身权重，其余时值均分"其他"份额；
 * 只对当前放得下的候选计算，剩余空间不足时比例在候选内重新分配。
 */
function naturalWeights(candidates: Duration[]): number[] {
	const others = candidates.filter((d) => NATURAL_DURATION_WEIGHTS[d] === 0);
	const shared = others.length > 0 ? OTHER_DURATION_WEIGHT / others.length : 0;
	return candidates.map((d) => NATURAL_DURATION_WEIGHTS[d] || shared);
}

/** 随机取一个调内音（临时变音记号特性照常叠加在调内音上） */
function randomNoteEvent(
	config: PracticeConfig,
	key: KeyId,
	duration: Duration,
	dots: boolean,
	triplet: boolean,
	rng: () => number
): NoteEvent {
	const low = config.range[0];
	const high = config.range[1];
	const degrees = scaleDegrees(key);

	// 音高池只含调内音级：随机抽到的音一定在调号内，关闭临时记号时谱面无意外升降号
	const pcs = new Set(degrees.map((d) => d.pc));
	const pool: number[] = [];
	for (let m = low; m <= high; m++) {
		if (pcs.has(((m % 12) + 12) % 12)) pool.push(m);
	}

	let midi: number;
	/** 音名字母 */
	let letter: string;
	/** 写进 vexKey 的升降（音级自带的调号升降） */
	let acc: number;
	/** 该字母在调号里的升降（临时记号玩法用） */
	let keyAlt: number;
	let naturalPc: number;
	let octave: number;

	if (pool.length > 0) {
		midi = pick(pool, rng);
		const pc = ((midi % 12) + 12) % 12;
		const degree = degrees.find((d) => d.pc === pc) as (typeof degrees)[number];
		letter = LETTERS[degree.letterIndex];
		naturalPc = NATURAL_PC[degree.letterIndex];
		acc = keyAlt = degree.alteration;
		octave = Math.floor((midi - naturalPc - acc) / 12) - 1;
	} else {
		// 防御：音域退化（如 [63,63] 全是调外音）时退回半音随机
		midi = low + Math.floor(rng() * (high - low + 1));
		const spelling = spell(midi, key);
		letter = spelling.letter;
		naturalPc = spelling.naturalPc;
		acc = spelling.accidental;
		keyAlt = KEY_ALTERATIONS[key][letter] ?? 0;
		octave = spelling.octave;
	}

	let vexKey = `${letter}${ACC_SUFFIX[acc]}/${octave}`;
	let accidental: NoteEvent['accidental'] = null;

	if (config.accidentals.enabled && rng() < config.accidentals.probability) {
		// 调号内升降的字母：还原或反向变化；本位字母：升或降。
		// 避免重升/重降这类生僻写法。
		const target =
			keyAlt !== 0 ? (rng() < 0.6 ? 0 : -keyAlt) : rng() < 0.5 ? 1 : -1;
		const candidate = 12 * (octave + 1) + naturalPc + target;
		if (candidate >= low && candidate <= high) {
			midi = candidate;
			accidental = target === 0 ? 'n' : target > 0 ? '#' : 'b';
			vexKey = `${letter}${target === 0 ? '' : target > 0 ? '#' : 'b'}/${octave}`;
		}
	}

	return { midi, vexKey, accidental, duration, dots, triplet };
}

function makeEvent(
	config: PracticeConfig,
	key: KeyId,
	duration: Duration,
	dots: boolean,
	triplet: boolean,
	isRest: boolean,
	rng: () => number
): NoteEvent {
	if (isRest) {
		return {
			midi: null,
			vexKey: REST_KEYS[config.clef],
			accidental: null,
			duration,
			dots,
			triplet
		};
	}
	return randomNoteEvent(config, key, duration, dots, triplet, rng);
}

/** 剩余时值放不下任何可选时值时，用休止符按二进制拆分补齐 */
function fillWithRests(
	config: PracticeConfig,
	key: KeyId,
	units: number,
	rng: () => number
): NoteEvent[] {
	const fallback: Duration[] = [
		...new Set<Duration>([
			...config.durations,
			'quarter',
			'eighth',
			'sixteenth'
		])
	].sort((a, b) => UNITS[b] - UNITS[a]);
	const events: NoteEvent[] = [];
	let left = units;
	while (left > 0) {
		const duration = fallback.find((d) => UNITS[d] <= left) ?? 'sixteenth';
		events.push(makeEvent(config, key, duration, false, false, true, rng));
		left -= UNITS[duration];
	}
	return events;
}

/**
 * 生成一个小节：按容量贪心填充音符 / 休止符 / 附点 / 三连音。
 * 三连音组无法在必标拍点处拆分，跨拍点的小节重新生成；
 * 极端配置下反复冲突时放弃三连音重试（其余内容总能拆分，必能满足两等级规则）。
 */
function generateMeasure(
	config: PracticeConfig,
	key: KeyId,
	timeSignature: TimeSignature,
	rng: () => number
): NoteEvent[] {
	const capacity = MEASURE_CAPACITY[timeSignature];
	for (let attempt = 0; attempt < 20; attempt++) {
		const measure = fillMeasure(config, key, capacity, rng);
		if (!tripletCrossesBeat(measure, timeSignature)) return measure;
	}
	return fillMeasure(
		{ ...config, triplets: { ...config.triplets, enabled: false } },
		key,
		capacity,
		rng
	);
}

/** 生成一个小节内容：按容量贪心填充音符 / 休止符 / 附点 / 三连音 */
function fillMeasure(
	config: PracticeConfig,
	key: KeyId,
	capacity: number,
	rng: () => number
): NoteEvent[] {
	const events: NoteEvent[] = [];
	// 长时值优先，节奏更接近真实乐谱的密度分布
	const durations = [...config.durations].sort((a, b) => UNITS[b] - UNITS[a]);
	let left = capacity;

	while (left > 0) {
		const candidates = durations.filter((d) => UNITS[d] <= left);
		if (candidates.length === 0) {
			// 如 6/8 拍选了全音符：任何时值都放不下，整段用休止符补齐
			events.push(...fillWithRests(config, key, left, rng));
			break;
		}
		const duration = config.naturalizeDurations
			? weightedPick(candidates, naturalWeights(candidates), rng)
			: pick(candidates, rng);
		let dots = false;
		let triplet = false;
		let cost = UNITS[duration];

		// 附点：仅勾选的时值生效；要求占时仍为整数单位且放得下（原型阶段不实现跨小节连音线）。
		// 十六分附点会引入半十六分（三十二分）网格，两等级规则无法在其上拆出拍点，不生成
		if (
			duration !== 'sixteenth' &&
			config.dots.durations.includes(duration) &&
			rng() < config.dots.probability
		) {
			const half = UNITS[duration] / 2;
			if (Number.isInteger(half) && cost + half <= left) {
				dots = true;
				cost += half;
			}
		}
		// 三连音：3 个同质音占 2 个本时值的时间（原型阶段不与附点叠加）
		if (
			!dots &&
			config.triplets.enabled &&
			rng() < config.triplets.probability &&
			UNITS[duration] * 2 <= left
		) {
			triplet = true;
			cost = UNITS[duration] * 2;
		}

		if (triplet) {
			for (let i = 0; i < 3; i++) {
				const isRest = config.rests.enabled && rng() < config.rests.probability;
				events.push(makeEvent(config, key, duration, false, true, isRest, rng));
			}
		} else {
			const isRest = config.rests.enabled && rng() < config.rests.probability;
			events.push(makeEvent(config, key, duration, dots, false, isRest, rng));
		}
		left -= cost;
	}
	return events;
}

/** 按配置生成一道完整题目（调号在多选中随机抽一个） */
export function generateExercise(
	config: PracticeConfig,
	rng: () => number
): Exercise {
	const key = pick(config.keys, rng);
	const measures: NoteEvent[][] = [];
	for (let i = 0; i < config.measuresPerExercise; i++) {
		measures.push(generateMeasure(config, key, config.timeSignature, rng));
	}
	return {
		key,
		clef: config.clef,
		timeSignature: config.timeSignature,
		tempo: config.tempo,
		measures
	};
}
