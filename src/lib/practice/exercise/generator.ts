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
	CHORD_STRUCTURES,
	chordSpan,
	diatonicChordOptions,
	diatonicPool,
	diatonicTriadType,
	KEY_ALTERATIONS,
	LETTERS,
	NATURAL_PC,
	scaleDegrees,
	spell,
	spellWithLetter
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

/** 已拼写音高（不含节奏信息，时值等由调用方附加） */
interface SpelledPitch {
	midi: number;
	vexKey: string;
	accidental: NoteEvent['accidental'];
}

/** 单个音符的取音来源：随机模式与音程模式各有一个实现 */
type PitchSource = () => SpelledPitch;

/** 调内音池内 MIDI 的拼写部件（池内音级的 pc 一定能在 degrees 中找到） */
function scaleToneParts(
	midi: number,
	degrees: ReturnType<typeof scaleDegrees>
) {
	const pc = ((midi % 12) + 12) % 12;
	const degree = degrees.find((d) => d.pc === pc) as (typeof degrees)[number];
	const letter = LETTERS[degree.letterIndex];
	const naturalPc = NATURAL_PC[degree.letterIndex];
	/** 该音级自带的调号升降 */
	const acc = degree.alteration;
	const octave = Math.floor((midi - naturalPc - acc) / 12) - 1;
	return { letter, naturalPc, acc, keyAlt: acc, octave };
}

/** 随机模式：每个音独立随机取调内音（音高池只含调内音级，临时变音记号特性照常叠加） */
function makeRandomSource(
	config: PracticeConfig,
	key: KeyId,
	rng: () => number
): PitchSource {
	const degrees = scaleDegrees(key);
	const pool = diatonicPool(config.range, key);
	const [low, high] = config.range;

	return () => {
		let midi: number;
		let letter: string;
		let naturalPc: number;
		let acc: number;
		let keyAlt: number;
		let octave: number;

		if (pool.length > 0) {
			midi = pick(pool, rng);
			({ letter, naturalPc, acc, keyAlt, octave } = scaleToneParts(
				midi,
				degrees
			));
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

		return { midi, vexKey, accidental };
	};
}

/**
 * 音程模式：每个音从上一个音出发，按所选度数在调内音池上步进，方向随机。
 * 度数按调内音级计（池内下标差 = 度数 - 1），大/小/纯由调号自然决定，
 * 临时变音记号不生效。目标出音域时该方向不可用（相当于在边界处反向）；
 * 完全放不下时保持同音。首音随机起步；休止符不动锚点，链跨休止延续。
 */
function makeIntervalSource(
	config: PracticeConfig,
	key: KeyId,
	rng: () => number
): PitchSource {
	const degrees = scaleDegrees(key);
	const pool = diatonicPool(config.range, key);
	const intervals = config.melody.intervals;
	/** 上一个音在池内的下标；-1 = 本题尚未起步 */
	let anchor = -1;

	return () => {
		if (pool.length === 0) {
			// 防御：音域内没有调内音时退回半音随机（与随机模式一致）
			const midi =
				config.range[0] +
				Math.floor(rng() * (config.range[1] - config.range[0] + 1));
			const spelling = spell(midi, key);
			return {
				midi,
				vexKey: `${spelling.letter}${ACC_SUFFIX[spelling.accidental]}/${spelling.octave}`,
				accidental: null
			};
		}
		if (anchor < 0) {
			anchor = Math.floor(rng() * pool.length);
		} else {
			// 所选度数上下两个方向的目标去重后，只留仍在音域内的，等概率抽取
			const targets = new Set<number>();
			for (const interval of intervals) {
				const steps = interval - 1;
				targets.add(anchor + steps);
				targets.add(anchor - steps);
			}
			const valid = [...targets].filter((t) => t >= 0 && t < pool.length);
			// 任何所选音程都放不下时保持同音（配置页会提示音域过窄）
			if (valid.length > 0) anchor = pick(valid, rng);
		}
		const { letter, acc, octave } = scaleToneParts(pool[anchor], degrees);
		return {
			midi: pool[anchor],
			vexKey: `${letter}${ACC_SUFFIX[acc]}/${octave}`,
			accidental: null
		};
	};
}

/**
 * 分解和弦模式：每次连续取音构成一个完整和弦（自低音起逐音输出，跨小节延续）。
 * 顺阶来源：用调内各级三和弦，类型由调号决定，音级 × 转位在放得下的组合里随机；
 * 自定义来源：类型与转位在所选集合内随机，超出和弦音数的转位（如三和弦的第三转位）回退为原位。
 * 和弦整体必须落在音域内：找不到放得下的和弦时退回半音随机单音。休止符不消耗和弦音。
 */
function makeChordSource(
	config: PracticeConfig,
	key: KeyId,
	rng: () => number
): PitchSource {
	const degrees = scaleDegrees(key);
	const pool = diatonicPool(config.range, key);
	const [low, high] = config.range;
	const settings = config.melody.chord;
	let queue: SpelledPitch[] = [];

	function randomChromaticNote(): SpelledPitch {
		const midi = low + Math.floor(rng() * (high - low + 1));
		const spelling = spell(midi, key);
		return {
			midi,
			vexKey: `${spelling.letter}${ACC_SUFFIX[spelling.accidental]}/${spelling.octave}`,
			accidental: null
		};
	}

	/** 按根音、根音字母、结构与转位拼出完整和弦（按输出顺序：上行自低音起，下行自高音起） */
	function buildChord(
		root: number,
		rootLetterIndex: number,
		structure: number[],
		inversion: number
	): SpelledPitch[] {
		// 转位 = 把第 inversion 个和弦音移作低音：其前的音升高一个八度排在后面
		const tones = structure.map((offset, i) => ({
			midi: root + (i < inversion ? offset + 12 : offset),
			order: i
		}));
		const sequence = [...tones.slice(inversion), ...tones.slice(0, inversion)];
		// 第 order 个和弦音的字母从根音字母按三度叠置（字母差 2）推进
		const pitches = sequence.map(({ midi, order }) => {
			const { letter, acc, octave } = spellWithLetter(
				midi,
				(rootLetterIndex + 2 * order) % 7
			);
			return {
				midi,
				vexKey: `${letter}${ACC_SUFFIX[acc]}/${octave}`,
				accidental: null
			};
		});
		return settings.direction === 'up' ? pitches : pitches.reverse();
	}

	/** 顺阶：第 degree 音级上的三和弦，根音取该音级在音域内放得下的八度位置 */
	function nextDiatonicChord(): SpelledPitch[] {
		const options = diatonicChordOptions(
			config.range,
			key,
			settings.inversions
		);
		if (options.length === 0) {
			// 音域内放不下任何（音级 × 转位）组合：退回半音随机单音
			return [randomChromaticNote()];
		}
		const { degree, inversion } = pick(options, rng);
		const structure = CHORD_STRUCTURES[diatonicTriadType(key, degree)];
		const { bassOffset, topOffset } = chordSpan(structure, inversion);
		const roots = pool.filter(
			(midi) =>
				((midi % 12) + 12) % 12 === degrees[degree].pc &&
				midi + bassOffset >= low &&
				midi + topOffset <= high
		);
		return buildChord(
			pick(roots, rng),
			degrees[degree].letterIndex,
			structure,
			inversion
		);
	}

	/** 自定义：类型与转位在所选集合内随机，根音在调内音池中随机 */
	function nextCustomChord(): SpelledPitch[] {
		const type = pick(settings.types, rng);
		const structure = CHORD_STRUCTURES[type];
		const usable = settings.inversions.filter((i) => i < structure.length);
		const inversion = pick(usable.length > 0 ? usable : [0], rng);
		// 低音（转位音）与最高音相对根音的半音偏移，用于筛选放得下的根音
		const { bassOffset, topOffset } = chordSpan(structure, inversion);

		const validRoots = pool.filter(
			(midi) => midi + bassOffset >= low && midi + topOffset <= high
		);
		if (validRoots.length > 0) {
			// 根音取调内音：字母与升降沿用该调音级的拼写
			const root = pick(validRoots, rng);
			const pc = ((root % 12) + 12) % 12;
			const degree = degrees.find(
				(d) => d.pc === pc
			) as (typeof degrees)[number];
			return buildChord(root, degree.letterIndex, structure, inversion);
		}
		// 池内没有合适根音：半音窗口内随机取根音，字母按调号拼写
		const windowLow = low - bassOffset;
		const windowHigh = high - topOffset;
		if (windowLow > windowHigh) {
			// 音域比任何所选和弦都窄：退回半音随机单音
			return [randomChromaticNote()];
		}
		const root = windowLow + Math.floor(rng() * (windowHigh - windowLow + 1));
		const rootLetterIndex = LETTERS.indexOf(
			spell(root, key).letter as (typeof LETTERS)[number]
		);
		return buildChord(root, rootLetterIndex, structure, inversion);
	}

	return () => {
		if (queue.length === 0) {
			queue =
				settings.source === 'diatonic'
					? nextDiatonicChord()
					: nextCustomChord();
		}
		return queue.shift() as SpelledPitch;
	};
}

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

function makeEvent(
	config: PracticeConfig,
	duration: Duration,
	dots: boolean,
	triplet: boolean,
	isRest: boolean,
	nextPitch: PitchSource
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
	const { midi, vexKey, accidental } = nextPitch();
	return { midi, vexKey, accidental, duration, dots, triplet };
}

/** 剩余时值放不下任何可选时值时，用休止符按二进制拆分补齐 */
function fillWithRests(
	config: PracticeConfig,
	nextPitch: PitchSource,
	units: number
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
		events.push(makeEvent(config, duration, false, false, true, nextPitch));
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
	timeSignature: TimeSignature,
	nextPitch: PitchSource,
	rng: () => number
): NoteEvent[] {
	const capacity = MEASURE_CAPACITY[timeSignature];
	for (let attempt = 0; attempt < 20; attempt++) {
		const measure = fillMeasure(config, capacity, nextPitch, rng);
		if (!tripletCrossesBeat(measure, timeSignature)) return measure;
	}
	return fillMeasure(
		{ ...config, triplets: { ...config.triplets, enabled: false } },
		capacity,
		nextPitch,
		rng
	);
}

/** 生成一个小节内容：按容量贪心填充音符 / 休止符 / 附点 / 三连音 */
function fillMeasure(
	config: PracticeConfig,
	capacity: number,
	nextPitch: PitchSource,
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
			events.push(...fillWithRests(config, nextPitch, left));
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
				events.push(
					makeEvent(config, duration, false, true, isRest, nextPitch)
				);
			}
		} else {
			const isRest = config.rests.enabled && rng() < config.rests.probability;
			events.push(makeEvent(config, duration, dots, false, isRest, nextPitch));
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
