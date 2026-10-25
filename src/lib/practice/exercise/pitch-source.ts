/**
 * 取音来源：按旋律模式决定"下一个音是什么"（只管音高，不管时值）。
 * 本文件放公共类型与随机 / 音程两种单音模式，分解和弦模式见 chord-source.ts。
 */
import type { KeyId, PracticeConfig } from '../config.js';
import type { NoteEvent } from './event.js';
import {
	ACC_SUFFIX,
	diatonicPool,
	KEY_ALTERATIONS,
	LETTERS,
	NATURAL_PC,
	scaleDegrees,
	spell
} from './pitch.js';
import { pick } from './rng.js';

/** 已拼写音高（不含节奏信息，时值等由调用方附加） */
export interface SpelledPitch {
	midi: number;
	vexKey: string;
	accidental: NoteEvent['accidental'];
	/** 仅顺阶分解和弦的和弦首音携带（渲染层据此在谱表上方标注和弦代号） */
	chordSymbol?: string;
}

/** 单个音符的取音来源：随机 / 音程 / 分解和弦模式各有一个实现 */
export type PitchSource = () => SpelledPitch;

/** 调内音池内 MIDI 的拼写部件（池内音级的 pc 一定能在 degrees 中找到） */
function scaleToneParts(
	midi: number,
	degrees: ReturnType<typeof scaleDegrees>
) {
	const pc = ((midi % 12) + 12) % 12;
	const degree = degrees.find((d) => d.pc === pc) as (typeof degrees)[number];
	const letter = LETTERS[degree.letterIndex];
	const naturalPc = NATURAL_PC[degree.letterIndex];
	/** 该音级自带的调号升降 */
	const acc = degree.alteration;
	const octave = Math.floor((midi - naturalPc - acc) / 12) - 1;
	return { letter, naturalPc, acc, keyAlt: acc, octave };
}

/** 随机模式：每个音独立随机取调内音（音高池只含调内音级，临时变音记号特性照常叠加） */
export function makeRandomSource(
	config: PracticeConfig,
	key: KeyId,
	rng: () => number
): PitchSource {
	const degrees = scaleDegrees(key);
	const pool = diatonicPool(config.range, key);
	const [low, high] = config.range;

	return () => {
		let midi: number;
		let letter: string;
		let naturalPc: number;
		let acc: number;
		let keyAlt: number;
		let octave: number;

		if (pool.length > 0) {
			midi = pick(pool, rng);
			({ letter, naturalPc, acc, keyAlt, octave } = scaleToneParts(
				midi,
				degrees
			));
		} else {
			// 防御：音域退化（如 [63,63] 全是调外音）时退回半音随机
			midi = low + Math.floor(rng() * (high - low + 1));
			const spelling = spell(midi, key);
			letter = spelling.letter;
			naturalPc = spelling.naturalPc;
			acc = spelling.accidental;
			keyAlt = KEY_ALTERATIONS[key][letter] ?? 0;
			octave = spelling.octave;
		}

		let vexKey = `${letter}${ACC_SUFFIX[acc]}/${octave}`;
		let accidental: NoteEvent['accidental'] = null;

		if (config.accidentals.enabled && rng() < config.accidentals.probability) {
			// 调号内升降的字母：还原或反向变化；本位字母：升或降。
			// 避免重升/重降这类生僻写法。
			const target =
				keyAlt !== 0 ? (rng() < 0.6 ? 0 : -keyAlt) : rng() < 0.5 ? 1 : -1;
			const candidate = 12 * (octave + 1) + naturalPc + target;
			if (candidate >= low && candidate <= high) {
				midi = candidate;
				accidental = target === 0 ? 'n' : target > 0 ? '#' : 'b';
				vexKey = `${letter}${target === 0 ? '' : target > 0 ? '#' : 'b'}/${octave}`;
			}
		}

		return { midi, vexKey, accidental };
	};
}

/**
 * 音程模式：每个音从上一个音出发，按所选度数在调内音池上步进，方向随机。
 * 度数按调内音级计（池内下标差 = 度数 - 1），大/小/纯由调号自然决定，
 * 临时变音记号不生效。目标出音域时该方向不可用（相当于在边界处反向）；
 * 完全放不下时保持同音。首音随机起步；休止符不动锚点，链跨休止延续。
 */
export function makeIntervalSource(
	config: PracticeConfig,
	key: KeyId,
	rng: () => number
): PitchSource {
	const degrees = scaleDegrees(key);
	const pool = diatonicPool(config.range, key);
	const intervals = config.melody.intervals;
	/** 上一个音在池内的下标；-1 = 本题尚未起步 */
	let anchor = -1;

	return () => {
		if (pool.length === 0) {
			// 防御：音域内没有调内音时退回半音随机（与随机模式一致）
			const midi =
				config.range[0] +
				Math.floor(rng() * (config.range[1] - config.range[0] + 1));
			const spelling = spell(midi, key);
			return {
				midi,
				vexKey: `${spelling.letter}${ACC_SUFFIX[spelling.accidental]}/${spelling.octave}`,
				accidental: null
			};
		}
		if (anchor < 0) {
			anchor = Math.floor(rng() * pool.length);
		} else {
			// 所选度数上下两个方向的目标去重后，只留仍在音域内的，等概率抽取
			const targets = new Set<number>();
			for (const interval of intervals) {
				const steps = interval - 1;
				targets.add(anchor + steps);
				targets.add(anchor - steps);
			}
			const valid = [...targets].filter((t) => t >= 0 && t < pool.length);
			// 任何所选音程都放不下时保持同音（配置页会提示音域过窄）
			if (valid.length > 0) anchor = pick(valid, rng);
		}
		const { letter, acc, octave } = scaleToneParts(pool[anchor], degrees);
		return {
			midi: pool[anchor],
			vexKey: `${letter}${ACC_SUFFIX[acc]}/${octave}`,
			accidental: null
		};
	};
}
