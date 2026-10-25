/**
 * 视奏题目生成的公共入口：实现按职责拆在本目录各模块，这里只 re-export 外部需要的 API。
 *
 * - event.ts              数据模型（NoteEvent / Exercise）与时值单位
 * - two-level-rule.ts     两等级规则（拍点可见性的记谱层变换）
 * - duration-split-rule.ts 音符时值拆分规则（大于等于一拍的音符必须落在拍点上）
 * - rest-grouping-rule.ts 连续休止符重组规则（休止符不跨越节拍）
 * - pitch.ts              音高拼写（MIDI → 按调号的音名）与调内音池
 * - rng.ts                可复现随机源
 * - generator.ts          按 PracticeConfig 生成题目
 */

export { applyDurationSplitRule } from './duration-split-rule.js';
export type { Exercise, NoteEvent } from './event.js';
export { eventCost, UNITS } from './event.js';
export { generateExercise } from './generator.js';
export {
	CHORD_STRUCTURES,
	chordFitsPool,
	diatonicChordOptions,
	diatonicPool,
	KEY_ALTERATIONS
} from './pitch.js';
export { applyRestGroupingRule } from './rest-grouping-rule.js';
export { mulberry32 } from './rng.js';
export { applyTwoLevelRule, snapToGrid } from './two-level-rule.js';
