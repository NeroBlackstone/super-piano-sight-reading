/**
 * 练习配置的数据结构与默认值。
 *
 * `src/routes/+page.svelte` 只持有这一份 `PracticeConfig` 作为唯一真源；
 * 派生展示（难度、配置摘要、一拍单位/速度术语）不入配置，留在组件层 $derived。
 */

/** 谱号 */
export type Clef = 'treble' | 'bass';

/** 调号 id（12 个调，与配置页 keyOptions 一一对应） */
export type KeyId =
	| 'C'
	| 'G'
	| 'D'
	| 'A'
	| 'E'
	| 'B'
	| 'F#'
	| 'C#'
	| 'F'
	| 'Bb'
	| 'Eb'
	| 'Ab';

/** 可选时值 */
export type Duration = 'whole' | 'half' | 'quarter' | 'eighth' | 'sixteenth';

/** 拍号 */
export type TimeSignature = '4/4' | '3/4' | '2/4' | '6/8';

/** 开关型特性：开关关闭时保留上次概率，便于再次开启 */
export interface OptionalFeature {
	enabled: boolean;
	/** 触发概率 0–1，仅 enabled 时生效 */
	probability: number;
}

/** 旋律生成方式：随机取音、按所选音程从上一个音步进，或连续分解和弦 */
export type MelodyMode = 'random' | 'interval' | 'chord';

/** 和弦类型：三和弦 4 种 + 七和弦 5 种，半音结构见 exercise/pitch.ts */
export type ChordTypeId =
	| 'major'
	| 'minor'
	| 'diminished'
	| 'augmented'
	| 'dom7'
	| 'maj7'
	| 'min7'
	| 'halfDim7'
	| 'dim7';

/** 和弦转位：0=原位，1=第一转位，2=第二转位，3=第三转位（仅七和弦） */
export type ChordInversion = 0 | 1 | 2 | 3;

/** 分解和弦方向 */
export type ChordDirection = 'up' | 'down';

/** 分解和弦的和弦来源：顺阶（调内各级三和弦/七和弦）或自定义（手动选择类型） */
export type ChordSource = 'diatonic' | 'custom';

/** 顺阶来源的和弦结构：三和弦（3 个音）或七和弦（4 个音） */
export type DiatonicChordSize = 'triad' | 'seventh';

/** 分解和弦模式设置 */
export interface ChordSettings {
	/** 和弦来源：顺阶模式下类型由调号决定，不能单独指定 */
	source: ChordSource;
	/** 顺阶来源下的和弦结构（至少 1 个；自定义模式下不生效） */
	diatonicSizes: DiatonicChordSize[];
	/** 允许的和弦类型（自定义模式下至少 1 个；顺阶模式下不生效） */
	types: ChordTypeId[];
	/** 允许的转位（至少 1 个；和弦音数不够的转位不生效） */
	inversions: ChordInversion[];
	/** 上行或下行 */
	direction: ChordDirection;
}

/** 旋律进行：随机模式下每个音独立取；音程模式下相邻音按度数移动；分解和弦模式逐音输出完整和弦。后两种模式临时变音记号均不生效 */
export interface MelodySettings {
	mode: MelodyMode;
	/** 音程模式允许的度数：1=同度，2–8（音程模式下至少 1 个） */
	intervals: number[];
	/** 分解和弦模式设置 */
	chord: ChordSettings;
}

/** 附点：只在勾选的时值上生效，未勾选的时值不出现附点版本 */
export interface DotSettings {
	/** 允许附点的时值（应为 durations 的子集） */
	durations: Duration[];
	/** 触发概率 0–1，仅 durations 非空时生效 */
	probability: number;
}

export interface PracticeConfig {
	clef: Clef;
	/** 调号 */
	key: KeyId;
	/** 音域 [低音, 高音]，MIDI 音高（长度 2，low < high） */
	range: number[];
	/** 旋律进行方式 */
	melody: MelodySettings;
	timeSignature: TimeSignature;
	/** BPM，一拍 = timeSignature 的分母（/4 拍为四分音符，/8 拍为八分音符） */
	tempo: number;
	/** 时值多选，至少 1 个 */
	durations: Duration[];
	/** 生成频率自然化：按固定权重抽取已选时值，而非等比例 */
	naturalizeDurations: boolean;
	/** 休止符 */
	rests: OptionalFeature;
	/** 临时变音记号 */
	accidentals: OptionalFeature;
	/** 附点（按勾选的时值生效） */
	dots: DotSettings;
	/** 三连音 */
	triplets: OptionalFeature;
	/** 每题小节数 */
	measuresPerExercise: number;
}

/** 钢琴键盘边界（88 键：A0 – C8），音域滑块的取值范围 */
export const KEYBOARD_MIN = 21;
export const KEYBOARD_MAX = 108;

/** BPM 上下限 */
export const TEMPO_MIN = 40;
export const TEMPO_MAX = 208;

/** 每题小节数的范围与步长 */
export const MEASURES_MIN = 4;
export const MEASURES_MAX = 32;
export const MEASURES_STEP = 4;

/** 每次调用返回全新对象（数组/概率对象不共享引用），可直接用作重置 */
export function createDefaultConfig(): PracticeConfig {
	return {
		clef: 'treble',
		key: 'C',
		range: [48, 72],
		melody: {
			mode: 'random',
			intervals: [],
			chord: {
				source: 'diatonic',
				diatonicSizes: ['triad'],
				types: ['major', 'minor'],
				inversions: [0],
				direction: 'up'
			}
		},
		timeSignature: '4/4',
		tempo: 72,
		durations: ['quarter'],
		naturalizeDurations: false,
		rests: { enabled: true, probability: 0.05 },
		accidentals: { enabled: false, probability: 0.05 },
		dots: { durations: [], probability: 0.15 },
		triplets: { enabled: false, probability: 0.1 },
		measuresPerExercise: 16
	};
}
