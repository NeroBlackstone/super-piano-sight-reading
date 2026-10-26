/**
 * 演奏时间轴：把题目事件流拍平成带绝对时值位置的序列，供跟弹判定使用。
 *
 * 只消费生成层的原始事件（记谱层拆分 / 重组不改演奏内容，勿用记谱后的事件）；
 * 单位沿用十六分音符 = 1，位置为全曲累计值。
 */
import type { TimeSignature } from '../config.js';
import { type Exercise, eventCost, type NoteEvent } from '../exercise/index.js';

/** 时间轴上的一个音符 / 休止符事件 */
export interface TimelineNote {
	/** MIDI 音高；休止符为 null */
	midi: number | null;
	/** 起始位置（十六分单位，全曲累计） */
	startUnits: number;
	/** 占时（十六分单位） */
	costUnits: number;
	/** 所在小节（0 起） */
	measure: number;
	/** 生成层内该小节的事件下标 */
	index: number;
}

export interface Timeline {
	notes: TimelineNote[];
	/** 全曲总占时（十六分单位） */
	totalUnits: number;
	/** 十六分单位 → 秒 */
	unitsToSeconds: number;
	/** 一小节的拍数（倒计时点击次数）：按拍号分子，6/8 为 6 个八分点击 */
	beatsPerMeasure: number;
	/** 一拍的秒数（BPM 的一拍即拍号分母单位） */
	secondsPerBeat: number;
}

/** 一拍占几个十六分单位：/4 拍为四分音符 4，/8 拍为八分音符 2 */
function unitsPerBeat(timeSignature: TimeSignature): number {
	return timeSignature.endsWith('/8') ? 2 : 4;
}

/** 按题目生成演奏时间轴 */
export function buildTimeline(exercise: Exercise): Timeline {
	const notes: TimelineNote[] = [];
	let position = 0;
	exercise.measures.forEach((measure: NoteEvent[], measureIndex) => {
		measure.forEach((event, index) => {
			const costUnits = eventCost(event);
			notes.push({
				midi: event.midi,
				startUnits: position,
				costUnits,
				measure: measureIndex,
				index
			});
			position += costUnits;
		});
		// 三连音的 2/3 占时累加有浮点残差，对齐回小节网格再续下一小节
		position = snap(position);
	});

	const beatUnits = unitsPerBeat(exercise.timeSignature);
	const secondsPerBeat = 60 / exercise.tempo;
	return {
		notes,
		totalUnits: position,
		unitsToSeconds: secondsPerBeat / beatUnits,
		beatsPerMeasure: Number(exercise.timeSignature.split('/')[0]),
		secondsPerBeat
	};
}

/** 贴近整数时吸附回整数网格（与 exercise 层的 snapToGrid 同语义） */
function snap(value: number): number {
	const rounded = Math.round(value);
	return Math.abs(value - rounded) < 1e-6 ? rounded : value;
}
