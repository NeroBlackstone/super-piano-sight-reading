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
} from './config.js';

/** 一个音符 / 休止符事件 */
export interface NoteEvent {
	/** MIDI 音高；休止符为 null */
	midi: number | null;
	/** VexFlow 音名键，如 'c#/4'；休止符为该谱号的默认休止位置 */
	vexKey: string;
	/** 需要显示的临时记号；null 表示调号已覆盖（或休止符） */
	accidental: '#' | 'b' | 'n' | null;
	duration: Duration;
	/** 是否附点 */
	dots: boolean;
	/** 是否三连音中的一个音（生成器保证连续 3 个同质事件） */
	triplet: boolean;
}

/** 一道题：调号 / 谱号 / 拍号 / 速度 + 逐小节的事件序列 */
export interface Exercise {
	key: KeyId;
	clef: Clef;
	timeSignature: TimeSignature;
	tempo: number;
	measures: NoteEvent[][];
}

/** 十六分音符 = 1 个时值单位 */
export const UNITS: Record<Duration, number> = {
	whole: 16,
	half: 8,
	quarter: 4,
	eighth: 2,
	sixteenth: 1
};

/** 各拍号一小节的总容量（十六分音符单位） */
const MEASURE_CAPACITY: Record<TimeSignature, number> = {
	'4/4': 16,
	'3/4': 12,
	'2/4': 8,
	'6/8': 12
};

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

// —— 音高拼写：MIDI → 音名（按调号选择等音拼写） ——

const LETTERS = ['c', 'd', 'e', 'f', 'g', 'a', 'b'] as const;
/** 各音名的本位音级（半音数） */
const NATURAL_PC = [0, 2, 4, 5, 7, 9, 11];

/** 大调调号中被升降的字母（相对本位音级） */
const KEY_ALTERATIONS: Record<KeyId, Record<string, number>> = {
	C: {},
	G: { f: 1 },
	D: { f: 1, c: 1 },
	A: { f: 1, c: 1, g: 1 },
	E: { f: 1, c: 1, g: 1, d: 1 },
	B: { f: 1, c: 1, g: 1, d: 1, a: 1 },
	'F#': { f: 1, c: 1, g: 1, d: 1, a: 1, e: 1 },
	'C#': { f: 1, c: 1, g: 1, d: 1, a: 1, e: 1, b: 1 },
	F: { b: -1 },
	Bb: { b: -1, e: -1 },
	Eb: { b: -1, e: -1, a: -1 },
	Ab: { b: -1, e: -1, a: -1, d: -1 }
};

/** 以降号为主的调：等音拼写平票时偏好降拼写 */
const FLAT_KEYS: ReadonlySet<KeyId> = new Set(['F', 'Bb', 'Eb', 'Ab']);

/** 各调根音在 LETTERS 中的下标 */
const KEY_ROOT_INDEX: Record<KeyId, number> = {
	C: 0,
	G: 4,
	D: 2,
	A: 5,
	E: 3,
	B: 6,
	'F#': 3,
	'C#': 0,
	F: 3,
	Bb: 6,
	Eb: 3,
	Ab: 5
};

/** 调式 7 个音级（字母 + 相对本位音级的升降 + 半音数），顺序从根音起 */
function scaleDegrees(key: KeyId): {
	letterIndex: number;
	alteration: number;
	pc: number;
}[] {
	const rootIndex = KEY_ROOT_INDEX[key];
	const degrees = [];
	for (let i = 0; i < 7; i++) {
		const letterIndex = (rootIndex + i) % 7;
		const letter = LETTERS[letterIndex];
		const alteration = KEY_ALTERATIONS[key][letter] ?? 0;
		const pc = (((NATURAL_PC[letterIndex] + alteration) % 12) + 12) % 12;
		degrees.push({ letterIndex, alteration, pc });
	}
	return degrees;
}

/** 相对本位音级的升降 → VexFlow 音名后缀 */
const ACC_SUFFIX: Record<number, string> = {
	'-2': 'bb',
	'-1': 'b',
	0: '',
	1: '#',
	2: '##'
};

interface Spelling {
	letter: string;
	/** 本位音级的半音数 */
	naturalPc: number;
	/** 相对本位音级的升降（-2..2） */
	accidental: number;
	octave: number;
}

/** 把 MIDI 音高按调号拼写成"音名 + 升降 + 八度"（取绝对值最小的常用拼写） */
function spell(midi: number, key: KeyId): Spelling {
	const pc = ((midi % 12) + 12) % 12;
	const preferFlat = FLAT_KEYS.has(key);
	let best: Spelling | undefined;
	let bestScore = Number.POSITIVE_INFINITY;
	for (let i = 0; i < LETTERS.length; i++) {
		// 所需升降折算到 [-6, 5]，再取绝对值最小的拼写
		const diff = pc - NATURAL_PC[i];
		const acc = ((((diff + 18) % 12) + 12) % 12) - 6;
		// 平票时降号调偏好降拼写、升号调偏好升拼写
		const score =
			Math.abs(acc) * 2 +
			(acc < 0 ? (preferFlat ? 0 : 1) : acc > 0 ? (preferFlat ? 1 : 0) : 0);
		if (score < bestScore) {
			bestScore = score;
			best = {
				letter: LETTERS[i],
				naturalPc: NATURAL_PC[i],
				accidental: acc,
				octave: Math.floor((midi - NATURAL_PC[i] - acc) / 12) - 1
			};
		}
	}
	return best as Spelling;
}

function pick<T>(items: readonly T[], rng: () => number): T {
	return items[Math.floor(rng() * items.length)];
}

/** 休止符在谱表上的默认位置 */
const REST_KEYS: Record<Clef, string> = {
	treble: 'b/4',
	bass: 'd/3'
};

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

/** 生成一个小节：按容量贪心填充音符 / 休止符 / 附点 / 三连音 */
function generateMeasure(
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
		const duration = pick(candidates, rng);
		let dots = false;
		let triplet = false;
		let cost = UNITS[duration];

		// 附点：要求占时仍为整数单位且放得下（原型阶段不实现跨小节连音线）
		if (config.dots.enabled && rng() < config.dots.probability) {
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
	const capacity = MEASURE_CAPACITY[config.timeSignature];
	const measures: NoteEvent[][] = [];
	for (let i = 0; i < config.measuresPerExercise; i++) {
		measures.push(generateMeasure(config, key, capacity, rng));
	}
	return {
		key,
		clef: config.clef,
		timeSignature: config.timeSignature,
		tempo: config.tempo,
		measures
	};
}
