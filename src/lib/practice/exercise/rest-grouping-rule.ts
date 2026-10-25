/**
 * 连续休止符重组规则（拍点对齐）：纯记谱层变换，不改演奏内容。
 */
import type { TimeSignature } from '../config.js';
import { BEAT_UNITS, eventCost, type NoteEvent } from './event.js';
import { snapToGrid, splitNoteUnits } from './two-level-rule.js';

/**
 * 连续休止符重组规则（纯记谱层变换，不改演奏内容）：
 * 连续两个及以上的休止符视为整段静音，按拍点边界重新分组，
 * 每个休止符都不跨越节拍，段内取尽量少的休止符——
 * 如 4/4 拍下 八分休止符 + 四分休止符 重组为 四分休止符 + 八分休止符。
 * 单个休止符不受影响；三连音不在十六分网格上，含三连音的段原样直通。
 */
export function applyRestGroupingRule(
	measure: NoteEvent[],
	timeSignature: TimeSignature
): NoteEvent[] {
	const beat = BEAT_UNITS[timeSignature];
	const result: NoteEvent[] = [];
	let position = 0;
	let i = 0;
	while (i < measure.length) {
		if (measure[i].midi !== null) {
			result.push(measure[i]);
			position = snapToGrid(position + eventCost(measure[i]));
			i++;
			continue;
		}

		// 极长的连续休止符段 [i, j)
		let j = i;
		let end = position;
		while (j < measure.length && measure[j].midi === null) {
			end = snapToGrid(end + eventCost(measure[j]));
			j++;
		}

		// 三连音 / 非整数占时（防御历史数据）不在拍点网格上，原样直通
		const regroupable =
			j - i >= 2 &&
			Number.isInteger(position) &&
			Number.isInteger(end) &&
			!measure.slice(i, j).some((event) => event.triplet);

		if (regroupable) {
			// 段内严格包含的拍点作为切分边界，首段补齐到拍点、末段从拍点起算
			const bounds = [position];
			for (
				let p = Math.floor(position / beat) * beat + beat;
				p < end;
				p += beat
			) {
				bounds.push(p);
			}
			bounds.push(end);
			for (let k = 0; k + 1 < bounds.length; k++) {
				for (const { duration, dotted } of splitNoteUnits(
					bounds[k + 1] - bounds[k]
				)) {
					result.push({
						...measure[i],
						duration,
						dots: dotted,
						triplet: false
					});
				}
			}
		} else {
			result.push(...measure.slice(i, j));
		}
		position = end;
		i = j;
	}
	return result;
}
