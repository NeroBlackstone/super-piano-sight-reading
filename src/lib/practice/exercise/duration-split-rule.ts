/**
 * 音符时值拆分规则（拍点对齐）：纯记谱层变换，不改演奏内容。
 */
import type { TimeSignature } from '../config.js';
import { BEAT_UNITS, eventCost, type NoteEvent } from './event.js';
import { snapToGrid, splitNoteUnits } from './two-level-rule.js';

/**
 * 音符时值拆分规则（纯记谱层变换，不改演奏内容）：
 * 时值大于等于一拍的音符必须从拍点开始，否则在下一个拍点处拆开——
 * 音符各段依次连音线相连（tieToNext），休止符直接断开（休止符从不连线）。
 * 拆出的首段短于一拍、末段从拍点开始，均自然满足本规则。
 * 三连音不在十六分网格上，不在此处理（与两等级规则一致）。
 */
export function applyDurationSplitRule(
	measure: NoteEvent[],
	timeSignature: TimeSignature
): NoteEvent[] {
	const beat = BEAT_UNITS[timeSignature];
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

		// 大于等于一拍且不从拍点开始：下一个拍点必在区间内（到拍点的距离短于一拍）
		if (cost >= beat && position % beat !== 0) {
			const cut = Math.ceil(position / beat) * beat;
			const bounds = [position, cut, position + cost];
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
		} else {
			result.push(event);
		}
		position += cost;
	}
	return result;
}
