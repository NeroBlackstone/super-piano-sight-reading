/**
 * 两等级规则（拍点可见性）：纯记谱层变换，不改演奏内容。
 */
import type { Duration, TimeSignature } from '../config.js';
import { eventCost, type NoteEvent, UNITS } from './event.js';

/**
 * 小节的节奏精细度：内容隐含的最细二分网格（十六分单位）。
 * 附点说明要按本时值的一半读谱（附点四分 → 八分）；
 * 三连音把 2 个本时值分成 3 份，比本时值再细一级。
 */
function measurePrecision(measure: NoteEvent[]): number {
	let precision = UNITS.whole;
	for (const event of measure) {
		const base = UNITS[event.duration];
		if (event.triplet) precision = Math.min(precision, Math.max(base / 2, 1));
		else if (event.dots) precision = Math.min(precision, base / 2);
		else precision = Math.min(precision, base);
	}
	return precision;
}

/**
 * 必标拍点的间距（十六分单位）：比精细度粗两个等级。
 * /4 拍每级 ×2（八分精细度 → 二分音符拍点，即 4/4 的第 1、3 拍）；
 * 6/8 的等级阶梯是 十六分 → 八分 → 附点四分（拍）→ 小节，
 * 八分及更细时必标的是每个附点四分拍点。
 * 返回 Infinity 表示无必标拍点。
 */
function requiredSpacing(
	precision: number,
	timeSignature: TimeSignature
): number {
	if (timeSignature === '6/8') {
		return precision <= UNITS.eighth ? 6 : Number.POSITIVE_INFINITY;
	}
	return precision * 4;
}

/** 单个音符可表示的占时（十六分单位，含附点值），按长到短排列 */
const SINGLE_NOTE_UNITS: {
	units: number;
	duration: Duration;
	dotted: boolean;
}[] = [
	{ units: 16, duration: 'whole', dotted: false },
	{ units: 12, duration: 'half', dotted: true },
	{ units: 8, duration: 'half', dotted: false },
	{ units: 6, duration: 'quarter', dotted: true },
	{ units: 4, duration: 'quarter', dotted: false },
	{ units: 3, duration: 'eighth', dotted: true },
	{ units: 2, duration: 'eighth', dotted: false },
	{ units: 1, duration: 'sixteenth', dotted: false }
];

/** 把一段整数占时贪心拆成尽量少的单个音符（长时值优先，1–16 最多两段）；音符时值拆分规则也复用 */
export function splitNoteUnits(length: number): typeof SINGLE_NOTE_UNITS {
	const parts: typeof SINGLE_NOTE_UNITS = [];
	let left = length;
	for (const candidate of SINGLE_NOTE_UNITS) {
		if (candidate.units <= left) {
			parts.push(candidate);
			left -= candidate.units;
		}
	}
	return parts;
}

/** 事件区间内严格包含的必标拍点 */
function interiorBeats(
	position: number,
	cost: number,
	spacing: number
): number[] {
	const beats: number[] = [];
	for (let p = spacing; p < position + cost; p += spacing) {
		if (p > position) beats.push(p);
	}
	return beats;
}

/** 三连音的 2/3 占时累加会留下浮点残差，贴近整数时吸附回整数网格 */
export function snapToGrid(value: number): number {
	const rounded = Math.round(value);
	return Math.abs(value - rounded) < 1e-6 ? rounded : value;
}

/**
 * 两等级规则（纯记谱层变换，不改演奏内容）：
 * 凡严格跨越必标拍点的音符 / 休止符，在拍点处断成独立事件——
 * 音符各段依次连音线相连（tieToNext），休止符直接断开（休止符从不连线）。
 * 三连音组内部无法拆出拍点，不在此处理（生成层保证其不跨拍点）。
 */
export function applyTwoLevelRule(
	measure: NoteEvent[],
	timeSignature: TimeSignature
): NoteEvent[] {
	const spacing = requiredSpacing(measurePrecision(measure), timeSignature);
	if (!Number.isFinite(spacing)) return measure;

	const result: NoteEvent[] = [];
	let position = 0;
	for (const event of measure) {
		const cost = eventCost(event);
		// 三连音 / 非整数占时（防御历史数据）不在拍点网格上，原样直通
		if (
			event.triplet ||
			!Number.isInteger(position) ||
			!Number.isInteger(cost)
		) {
			result.push(event);
			position = snapToGrid(position + cost);
			continue;
		}

		const cuts = interiorBeats(position, cost, spacing);
		if (cuts.length === 0) {
			result.push(event);
			position += cost;
			continue;
		}

		const bounds = [position, ...cuts, position + cost];
		const parts: NoteEvent[] = [];
		for (let i = 0; i + 1 < bounds.length; i++) {
			for (const { duration, dotted } of splitNoteUnits(
				bounds[i + 1] - bounds[i]
			)) {
				parts.push({ ...event, duration, dots: dotted, triplet: false });
			}
		}
		// 同一音符拆出的各段首尾相连，末段不再连
		if (event.midi !== null) {
			for (let i = 0; i + 1 < parts.length; i++) parts[i].tieToNext = true;
		}
		result.push(...parts);
		position += cost;
	}
	return result;
}

/** 三连音组是否跨必标拍点（组内拆不出拍点音符，生成时必须避免） */
export function tripletCrossesBeat(
	measure: NoteEvent[],
	timeSignature: TimeSignature
): boolean {
	const spacing = requiredSpacing(measurePrecision(measure), timeSignature);
	if (!Number.isFinite(spacing)) return false;
	let position = 0;
	for (const event of measure) {
		const cost = eventCost(event);
		if (event.triplet && interiorBeats(position, cost, spacing).length > 0) {
			return true;
		}
		position = snapToGrid(position + cost);
	}
	return false;
}
