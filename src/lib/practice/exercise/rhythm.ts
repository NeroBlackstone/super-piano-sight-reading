/**
 * 节奏与小节生成：按小节容量贪心填充时值、附点、三连音与休止符。
 */
import type {
	Clef,
	Duration,
	PracticeConfig,
	TimeSignature
} from '../config.js';
import { MEASURE_CAPACITY, type NoteEvent, UNITS } from './event.js';
import type { PitchSource } from './pitch-source.js';
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
	const { midi, vexKey, accidental, chordSymbol } = nextPitch();
	return { midi, vexKey, accidental, duration, dots, triplet, chordSymbol };
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
export function generateMeasure(
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
