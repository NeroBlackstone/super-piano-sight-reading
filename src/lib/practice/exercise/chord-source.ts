/**
 * 分解和弦模式的取音来源（公共类型见 pitch-source.ts）。
 */
import type { ChordTypeId, KeyId, PracticeConfig } from '../config.js';
import type { PitchSource, SpelledPitch } from './pitch-source.js';
import {
	ACC_SUFFIX,
	CHORD_STRUCTURES,
	chordSpan,
	diatonicChordOptions,
	diatonicChordType,
	diatonicPool,
	LETTERS,
	scaleDegrees,
	spell,
	spellWithLetter
} from './pitch.js';
import { pick } from './rng.js';

/** 顺阶和弦类型 → 和弦代号后缀（大调顺阶三和弦只有大 / 小 / 减，七和弦只有大七 / 属七 / 小七 / 半减七） */
const DIATONIC_CHORD_SUFFIX: Partial<Record<ChordTypeId, string>> = {
	major: '',
	minor: 'm',
	diminished: 'dim',
	maj7: 'maj7',
	dom7: '7',
	min7: 'm7',
	halfDim7: 'm7b5'
};

/**
 * 分解和弦模式：每次连续取音构成一个完整和弦（自低音起逐音输出，跨小节延续）。
 * 顺阶来源：用调内各级三和弦 / 七和弦（所选结构），类型由调号决定，音级 × 结构 × 转位在放得下的组合里随机；
 * 自定义来源：类型与转位在所选集合内随机，超出和弦音数的转位（如三和弦的第三转位）回退为原位。
 * 和弦整体必须落在音域内：找不到放得下的和弦时退回半音随机单音。休止符不消耗和弦音。
 */
export function makeChordSource(
	config: PracticeConfig,
	key: KeyId,
	rng: () => number
): PitchSource {
	const degrees = scaleDegrees(key);
	const pool = diatonicPool(config.range, key);
	const [low, high] = config.range;
	const settings = config.melody.chord;
	let queue: SpelledPitch[] = [];

	function randomChromaticNote(): SpelledPitch {
		const midi = low + Math.floor(rng() * (high - low + 1));
		const spelling = spell(midi, key);
		return {
			midi,
			vexKey: `${spelling.letter}${ACC_SUFFIX[spelling.accidental]}/${spelling.octave}`,
			accidental: null
		};
	}

	/** 按根音、根音字母、结构与转位拼出完整和弦（按输出顺序：上行自低音起，下行自高音起） */
	function buildChord(
		root: number,
		rootLetterIndex: number,
		structure: number[],
		inversion: number
	): SpelledPitch[] {
		// 转位 = 把第 inversion 个和弦音移作低音：其前的音升高一个八度排在后面
		const tones = structure.map((offset, i) => ({
			midi: root + (i < inversion ? offset + 12 : offset),
			order: i
		}));
		const sequence = [...tones.slice(inversion), ...tones.slice(0, inversion)];
		// 第 order 个和弦音的字母从根音字母按三度叠置（字母差 2）推进
		const pitches = sequence.map(({ midi, order }) => {
			const { letter, acc, octave } = spellWithLetter(
				midi,
				(rootLetterIndex + 2 * order) % 7
			);
			return {
				midi,
				vexKey: `${letter}${ACC_SUFFIX[acc]}/${octave}`,
				accidental: null
			};
		});
		return settings.direction === 'up' ? pitches : pitches.reverse();
	}

	/** 顺阶：第 degree 音级上按所选结构的和弦，根音取该音级在音域内放得下的八度位置 */
	function nextDiatonicChord(): SpelledPitch[] {
		const options = diatonicChordOptions(
			config.range,
			key,
			settings.inversions,
			settings.diatonicSizes
		);
		if (options.length === 0) {
			// 音域内放不下任何（音级 × 结构 × 转位）组合：退回半音随机单音
			return [randomChromaticNote()];
		}
		const { degree, size, inversion } = pick(options, rng);
		const type = diatonicChordType(key, degree, size);
		const structure = CHORD_STRUCTURES[type];
		const { bassOffset, topOffset } = chordSpan(structure, inversion);
		const roots = pool.filter(
			(midi) =>
				((midi % 12) + 12) % 12 === degrees[degree].pc &&
				midi + bassOffset >= low &&
				midi + topOffset <= high
		);
		const pitches = buildChord(
			pick(roots, rng),
			degrees[degree].letterIndex,
			structure,
			inversion
		);
		// 和弦代号标在第一个发音的音上（上行 = 和弦低音，下行 = 和弦高音）；
		// 根音拼写沿用调号音级（字母 + 升降），如 F 大调第 4 级 → 'Bb'
		const rootDegree = degrees[degree];
		pitches[0].chordSymbol = `${LETTERS[rootDegree.letterIndex].toUpperCase()}${ACC_SUFFIX[rootDegree.alteration]}${DIATONIC_CHORD_SUFFIX[type] ?? ''}`;
		return pitches;
	}

	/** 自定义：类型与转位在所选集合内随机，根音在调内音池中随机 */
	function nextCustomChord(): SpelledPitch[] {
		const type = pick(settings.types, rng);
		const structure = CHORD_STRUCTURES[type];
		const usable = settings.inversions.filter((i) => i < structure.length);
		const inversion = pick(usable.length > 0 ? usable : [0], rng);
		// 低音（转位音）与最高音相对根音的半音偏移，用于筛选放得下的根音
		const { bassOffset, topOffset } = chordSpan(structure, inversion);

		const validRoots = pool.filter(
			(midi) => midi + bassOffset >= low && midi + topOffset <= high
		);
		if (validRoots.length > 0) {
			// 根音取调内音：字母与升降沿用该调音级的拼写
			const root = pick(validRoots, rng);
			const pc = ((root % 12) + 12) % 12;
			const degree = degrees.find(
				(d) => d.pc === pc
			) as (typeof degrees)[number];
			return buildChord(root, degree.letterIndex, structure, inversion);
		}
		// 池内没有合适根音：半音窗口内随机取根音，字母按调号拼写
		const windowLow = low - bassOffset;
		const windowHigh = high - topOffset;
		if (windowLow > windowHigh) {
			// 音域比任何所选和弦都窄：退回半音随机单音
			return [randomChromaticNote()];
		}
		const root = windowLow + Math.floor(rng() * (windowHigh - windowLow + 1));
		const rootLetterIndex = LETTERS.indexOf(
			spell(root, key).letter as (typeof LETTERS)[number]
		);
		return buildChord(root, rootLetterIndex, structure, inversion);
	}

	return () => {
		if (queue.length === 0) {
			queue =
				settings.source === 'diatonic'
					? nextDiatonicChord()
					: nextCustomChord();
		}
		return queue.shift() as SpelledPitch;
	};
}
