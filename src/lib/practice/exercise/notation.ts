import type { KeyId } from '../config.js';
import { applyDurationSplitRule } from './duration-split-rule.js';
import type { Exercise, NoteEvent } from './event.js';
import { KEY_ALTERATIONS } from './pitch.js';
import { applyRestGroupingRule } from './rest-grouping-rule.js';
import { applyTwoLevelRule } from './two-level-rule.js';

/**
 * 一个小节的记谱层变换（不改演奏内容）：先按时值拆分规则把不在拍点上的一拍及以上音符拆开，
 * 再由两等级规则断开跨必标拍点的音符（其切点都落在拍点上，不会破坏前一步），
 * 最后把连续休止符按拍点重新编组，每个休止符都不跨节拍
 * （休止符从不连线，重组不改动任何音符，不会破坏前两步）。
 * 变换后的事件数即实际渲染的音符（含休止符）个数，小节宽度按它加权。
 */
export function notatedEvents(
	measure: NoteEvent[],
	exercise: Exercise
): NoteEvent[] {
	return applyRestGroupingRule(
		applyTwoLevelRule(
			applyDurationSplitRule(measure, exercise.timeSignature),
			exercise.timeSignature
		),
		exercise.timeSignature
	);
}

/** vexKey（如 'c#/4'）→ 字母 + 相对本位音级的升降数 + 八度 */
function parseVexKey(vexKey: string): {
	letter: string;
	alteration: number;
	octave: number;
} | null {
	const match = /^([a-g])(#{1,2}|b{1,2})?\/(\d)$/.exec(vexKey);
	if (!match) return null;
	const suffix = match[2] ?? '';
	const alteration =
		suffix === '' ? 0 : suffix.startsWith('#') ? suffix.length : -suffix.length;
	return { letter: match[1], alteration, octave: Number(match[3]) };
}

/** 升降数 → 记号类型（生成器只产出单升 / 单降 / 还原） */
const ACCIDENTAL_TYPES: Record<number, '#' | 'b' | 'n'> = {
	1: '#',
	'-1': 'b',
	0: 'n'
};

/**
 * 跨小节提醒记号：临时变音到小节线即失效，但读谱容易把它延续到下一小节；
 * 同一字母同一八度的音在下一小节首次出现且回到调号状态（变音被取消）时，
 * 强制显示调号状态的记号——字母未被调号升降时即还原记号，否则为回到调号的升 / 降号。
 * 返回逐小节的「事件下标 → 记号类型」，applyAccidentals 只看单个小节，跨小节的提醒在这里算。
 */
export function courtesyAccidentals(
	measures: NoteEvent[][],
	key: KeyId
): Map<number, '#' | 'b' | 'n'>[] {
	const courtesy = measures.map(() => new Map<number, '#' | 'b' | 'n'>());
	// 上一小节结束时各 letter+octave 的升降状态；本小节未出现的音不延续提醒
	let carried = new Map<string, number>();

	measures.forEach((measure, measureIndex) => {
		const endState = new Map<string, number>();
		measure.forEach((event, eventIndex) => {
			if (event.midi === null) return;
			const parsed = parseVexKey(event.vexKey);
			if (!parsed) return;
			const id = `${parsed.letter}/${parsed.octave}`;
			if (!endState.has(id)) {
				const keyAlt = KEY_ALTERATIONS[key][parsed.letter] ?? 0;
				const prevAlt = carried.get(id) ?? keyAlt;
				if (parsed.alteration === keyAlt && prevAlt !== keyAlt) {
					courtesy[measureIndex].set(eventIndex, ACCIDENTAL_TYPES[keyAlt]);
				}
			}
			endState.set(id, parsed.alteration);
		});
		carried = endState;
	});
	return courtesy;
}
