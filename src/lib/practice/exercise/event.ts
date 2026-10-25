/**
 * 题目数据模型与时值单位：事件 / 题目结构、十六分音符单位换算。
 */
import type { Clef, Duration, KeyId, TimeSignature } from '../config.js';

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
	/**
	 * 仅记谱层使用：两等级规则 / 音符时值拆分规则把音符拆开后，该事件与下一事件用连音线相连。
	 * 生成器不产出该字段，播放语义仍是一个长音。
	 */
	tieToNext?: boolean;
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
export const MEASURE_CAPACITY: Record<TimeSignature, number> = {
	'4/4': 16,
	'3/4': 12,
	'2/4': 8,
	'6/8': 12
};

/** 事件的实际占时（十六分音符单位，含附点 / 三连音修正） */
export function eventCost(event: NoteEvent): number {
	const base = UNITS[event.duration];
	if (event.triplet) return (base * 2) / 3;
	if (event.dots) return base * 1.5;
	return base;
}
