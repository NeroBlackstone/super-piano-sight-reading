/**
 * 配置页各控件的选项元数据与展示辅助。
 *
 * 只放与 PracticeConfig 无关的静态选项（调号、时值、拍号、速度术语、拍号单位、
 * 音域预设）；可变状态一律由组件层持有，这里不存任何运行时状态。
 */
import { m } from '#lib/paraglide/messages.js';
import type {
	ChordDirection,
	ChordInversion,
	ChordSource,
	ChordTypeId,
	Duration,
	KeyId,
	TimeSignature
} from '#lib/practice/config.js';

export const LOCALE_NAMES: Record<string, string> = {
	en: 'English',
	zh: '中文'
};

export const clefLabels: Record<string, () => string> = {
	treble: () => m.clefTreble(),
	bass: () => m.clefBass()
};

export const keyOptions: { id: KeyId; label: string; hint: () => string }[] = [
	{ id: 'C', label: 'C', hint: () => m.keysHintsC() },
	{ id: 'G', label: 'G', hint: () => m.keysHintsG() },
	{ id: 'D', label: 'D', hint: () => m.keysHintsD() },
	{ id: 'A', label: 'A', hint: () => m.keysHintsA() },
	{ id: 'E', label: 'E', hint: () => m.keysHintsE() },
	{ id: 'B', label: 'B', hint: () => m.keysHintsB() },
	{ id: 'F#', label: 'F♯', hint: () => m.keysHintsFSharp() },
	{ id: 'C#', label: 'C♯', hint: () => m.keysHintsCSharp() },
	{ id: 'F', label: 'F', hint: () => m.keysHintsF() },
	{ id: 'Bb', label: 'B♭', hint: () => m.keysHintsBb() },
	{ id: 'Eb', label: 'E♭', hint: () => m.keysHintsEb() },
	{ id: 'Ab', label: 'A♭', hint: () => m.keysHintsAb() }
];

export const keyLabels: Record<string, string> = Object.fromEntries(
	keyOptions.map((option) => [option.id, option.label])
);

export const durationOptions: { id: Duration; label: () => string }[] = [
	{ id: 'whole', label: () => m.durationsWhole() },
	{ id: 'half', label: () => m.durationsHalf() },
	{ id: 'quarter', label: () => m.durationsQuarter() },
	{ id: 'eighth', label: () => m.durationsEighth() },
	{ id: 'sixteenth', label: () => m.durationsSixteenth() }
];

export const durationLabels: Record<string, () => string> = Object.fromEntries(
	durationOptions.map((option) => [option.id, option.label])
);

/** 音程选项：度数（1=同度，2–8），音程模式下多选，步进方向随机 */
export const intervalOptions: { id: number; label: () => string }[] = [
	{ id: 1, label: () => m.intervalUnison() },
	{ id: 2, label: () => m.intervalSecond() },
	{ id: 3, label: () => m.intervalThird() },
	{ id: 4, label: () => m.intervalFourth() },
	{ id: 5, label: () => m.intervalFifth() },
	{ id: 6, label: () => m.intervalSixth() },
	{ id: 7, label: () => m.intervalSeventh() },
	{ id: 8, label: () => m.intervalOctave() }
];

export const intervalLabels: Record<number, () => string> = Object.fromEntries(
	intervalOptions.map((option) => [option.id, option.label])
);

/** 和弦类型选项：三和弦 4 种（3 个音）+ 七和弦 5 种（4 个音），分解和弦模式下多选 */
export const triadTypeOptions: { id: ChordTypeId; label: () => string }[] = [
	{ id: 'major', label: () => m.chordTypeMajor() },
	{ id: 'minor', label: () => m.chordTypeMinor() },
	{ id: 'diminished', label: () => m.chordTypeDiminished() },
	{ id: 'augmented', label: () => m.chordTypeAugmented() }
];

export const seventhTypeOptions: { id: ChordTypeId; label: () => string }[] = [
	{ id: 'dom7', label: () => m.chordTypeDom7() },
	{ id: 'maj7', label: () => m.chordTypeMaj7() },
	{ id: 'min7', label: () => m.chordTypeMin7() },
	{ id: 'halfDim7', label: () => m.chordTypeHalfDim7() },
	{ id: 'dim7', label: () => m.chordTypeDim7() }
];

export const chordTypeOptions = [...triadTypeOptions, ...seventhTypeOptions];

export const chordTypeLabels: Record<string, () => string> = Object.fromEntries(
	chordTypeOptions.map((option) => [option.id, option.label] as const)
);

/** 七和弦类型集合：第三转位只对七和弦有意义 */
export const SEVENTH_CHORD_TYPES: ReadonlySet<ChordTypeId> = new Set(
	seventhTypeOptions.map((option) => option.id)
);

/** 转位选项：seventhOnly 标记仅七和弦可用的第三转位 */
export const chordInversionOptions: {
	id: ChordInversion;
	label: () => string;
	seventhOnly: boolean;
}[] = [
	{ id: 0, label: () => m.chordInversionRoot(), seventhOnly: false },
	{ id: 1, label: () => m.chordInversionFirst(), seventhOnly: false },
	{ id: 2, label: () => m.chordInversionSecond(), seventhOnly: false },
	{ id: 3, label: () => m.chordInversionThird(), seventhOnly: true }
];

export const chordInversionLabels: Record<number, () => string> =
	Object.fromEntries(
		chordInversionOptions.map((option) => [option.id, option.label] as const)
	);

/** 分解和弦方向：上行自低音起，下行自高音起 */
export const chordDirectionOptions: {
	id: ChordDirection;
	label: () => string;
}[] = [
	{ id: 'up', label: () => m.chordDirectionUp() },
	{ id: 'down', label: () => m.chordDirectionDown() }
];

export const chordDirectionLabels: Record<string, () => string> =
	Object.fromEntries(
		chordDirectionOptions.map((option) => [option.id, option.label])
	);

/** 分解和弦来源：顺阶用调内各级三和弦（类型由调号决定），自定义手动选类型 */
export const chordSourceOptions: {
	id: ChordSource;
	label: () => string;
}[] = [
	{ id: 'diatonic', label: () => m.chordSourceDiatonic() },
	{ id: 'custom', label: () => m.chordSourceCustom() }
];

export const chordSourceLabels: Record<string, () => string> =
	Object.fromEntries(
		chordSourceOptions.map((option) => [option.id, option.label])
	);

export const timeSignatureOptions: {
	id: TimeSignature;
	label: string;
	hint: () => string;
}[] = [
	{ id: '4/4', label: '4/4', hint: () => m.timeSigHint44() },
	{ id: '3/4', label: '3/4', hint: () => m.timeSigHint34() },
	{ id: '2/4', label: '2/4', hint: () => m.timeSigHint24() },
	{ id: '6/8', label: '6/8', hint: () => m.timeSigHint68() }
];

export const timeSignatureLabels: Record<string, string> = Object.fromEntries(
	timeSignatureOptions.map((option) => [option.id, option.label])
);

/** 音域八度预设：按 C 分组的八度区间，可叠加选择，合并为连续音域 */
export const rangeOctavePresets: {
	id: string;
	label: () => string;
	value: number[];
}[] = [
	{ id: 'C1-C2', label: () => 'C1–C2', value: [24, 36] },
	{ id: 'C2-C3', label: () => 'C2–C3', value: [36, 48] },
	{ id: 'C3-C4', label: () => 'C3–C4', value: [48, 60] },
	{ id: 'C4-C5', label: () => 'C4–C5', value: [60, 72] },
	{ id: 'C5-C6', label: () => 'C5–C6', value: [72, 84] },
	{ id: 'C6-C7', label: () => 'C6–C7', value: [84, 96] },
	{ id: 'C7-C8', label: () => 'C7–C8', value: [96, 108] }
];

/** 快捷预设：谱表范围，点击直接应用并清空八度选择。
 *  常规为下加一线–上加一线；扩展为下加四线–上加四线（含第四线本身）。 */
export const rangeQuickPresets: {
	id: string;
	label: () => string;
	value: number[];
}[] = [
	{ id: 'treble', label: () => m.clefTreble(), value: [60, 81] },
	{
		id: 'treble-extended',
		label: () => m.rangePresetTrebleExtended(),
		value: [50, 91]
	},
	{ id: 'bass', label: () => m.clefBass(), value: [40, 60] },
	{
		id: 'bass-extended',
		label: () => m.rangePresetBassExtended(),
		value: [29, 71]
	}
];

/** 拍号的分母决定默认时值单位：/4 拍默认四分，/8 拍默认八分 */
export const defaultUnitByDenominator: Record<string, Duration> = {
	'4': 'quarter',
	'8': 'eighth'
};

/** BPM 的一拍单位：/4 拍以四分音符为一拍（♩），/8 拍以八分音符为一拍（♪） */
export const beatUnitMeta: Record<
	string,
	{ glyph: string; name: () => string }
> = {
	quarter: { glyph: '♩', name: () => m.beatUnitQuarter() },
	eighth: { glyph: '♪', name: () => m.beatUnitEighth() }
};

/** 由拍号推出一拍单位（分母 → 时值单位 → 记号/名称） */
export function beatUnitFor(timeSignature: TimeSignature) {
	const denominator = timeSignature.split('/')[1];
	return (
		beatUnitMeta[defaultUnitByDenominator[denominator] ?? 'quarter'] ??
		beatUnitMeta.quarter
	);
}

/** BPM 对应的常见速度术语 */
const TEMPO_MARKS = [
	{ max: 60, label: () => m.tempoLargo() },
	{ max: 66, label: () => m.tempoAdagio() },
	{ max: 76, label: () => m.tempoAndante() },
	{ max: 108, label: () => m.tempoModerato() },
	{ max: 120, label: () => m.tempoAllegro() },
	{ max: 168, label: () => m.tempoPresto() }
];

export const tempoLabel = (bpm: number) =>
	TEMPO_MARKS.find((mark) => bpm < mark.max)?.label() ?? m.tempoPrestissimo();
