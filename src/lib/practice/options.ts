/**
 * 配置页各控件的选项元数据与展示辅助。
 *
 * 只放与 PracticeConfig 无关的静态选项（调号、时值、拍号、速度术语、拍号单位、
 * 音域预设）；可变状态一律由组件层持有，这里不存任何运行时状态。
 */
import { m } from '#lib/paraglide/messages.js';
import type { Duration, KeyId, TimeSignature } from '#lib/practice/config.js';

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

export const rangePresets: {
	id: string;
	label: () => string;
	value: number[];
}[] = [
	{ id: 'near', label: () => m.rangePresetNear(), value: [60, 72] },
	{ id: 'basic', label: () => m.rangePresetBasic(), value: [48, 72] },
	{ id: 'wide', label: () => m.rangePresetWide(), value: [36, 84] },
	{ id: 'full', label: () => m.rangePresetFull(), value: [21, 108] }
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
