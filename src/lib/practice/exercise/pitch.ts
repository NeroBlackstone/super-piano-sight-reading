/**
 * 音高拼写：MIDI → 音名（按调号选择等音拼写）。
 */
import type { ChordTypeId, KeyId } from '../config.js';

export const LETTERS = ['c', 'd', 'e', 'f', 'g', 'a', 'b'] as const;
/** 各音名的本位音级（半音数） */
export const NATURAL_PC = [0, 2, 4, 5, 7, 9, 11];

/** 大调调号中被升降的字母（相对本位音级） */
export const KEY_ALTERATIONS: Record<KeyId, Record<string, number>> = {
	C: {},
	G: { f: 1 },
	D: { f: 1, c: 1 },
	A: { f: 1, c: 1, g: 1 },
	E: { f: 1, c: 1, g: 1, d: 1 },
	B: { f: 1, c: 1, g: 1, d: 1, a: 1 },
	'F#': { f: 1, c: 1, g: 1, d: 1, a: 1, e: 1 },
	'C#': { f: 1, c: 1, g: 1, d: 1, a: 1, e: 1, b: 1 },
	F: { b: -1 },
	Bb: { b: -1, e: -1 },
	Eb: { b: -1, e: -1, a: -1 },
	Ab: { b: -1, e: -1, a: -1, d: -1 }
};

/** 以降号为主的调：等音拼写平票时偏好降拼写 */
const FLAT_KEYS: ReadonlySet<KeyId> = new Set(['F', 'Bb', 'Eb', 'Ab']);

/** 各调根音在 LETTERS 中的下标 */
const KEY_ROOT_INDEX: Record<KeyId, number> = {
	C: 0,
	G: 4,
	D: 2,
	A: 5,
	E: 3,
	B: 6,
	'F#': 3,
	'C#': 0,
	F: 3,
	Bb: 6,
	Eb: 3,
	Ab: 5
};

/** 调式 7 个音级（字母 + 相对本位音级的升降 + 半音数），顺序从根音起 */
export function scaleDegrees(key: KeyId): {
	letterIndex: number;
	alteration: number;
	pc: number;
}[] {
	const rootIndex = KEY_ROOT_INDEX[key];
	const degrees = [];
	for (let i = 0; i < 7; i++) {
		const letterIndex = (rootIndex + i) % 7;
		const letter = LETTERS[letterIndex];
		const alteration = KEY_ALTERATIONS[key][letter] ?? 0;
		const pc = (((NATURAL_PC[letterIndex] + alteration) % 12) + 12) % 12;
		degrees.push({ letterIndex, alteration, pc });
	}
	return degrees;
}

/** 音域内某调的调内音池（升序 MIDI）。音程模式按池内下标步进：下标差 1 = 二度，差 N = N+1 度 */
export function diatonicPool(range: number[], key: KeyId): number[] {
	const pcs = new Set(scaleDegrees(key).map((degree) => degree.pc));
	const pool: number[] = [];
	for (let midi = range[0]; midi <= range[1]; midi++) {
		if (pcs.has(((midi % 12) + 12) % 12)) pool.push(midi);
	}
	return pool;
}

/** 相对本位音级的升降 → VexFlow 音名后缀 */
export const ACC_SUFFIX: Record<number, string> = {
	'-2': 'bb',
	'-1': 'b',
	0: '',
	1: '#',
	2: '##'
};

/** 各和弦类型根音到各和弦音的半音数（按三度叠置顺序，三和弦 3 个音、七和弦 4 个音） */
export const CHORD_STRUCTURES: Record<ChordTypeId, number[]> = {
	major: [0, 4, 7],
	minor: [0, 3, 7],
	diminished: [0, 3, 6],
	augmented: [0, 4, 8],
	dom7: [0, 4, 7, 10],
	maj7: [0, 4, 7, 11],
	min7: [0, 3, 7, 10],
	halfDim7: [0, 3, 6, 10],
	dim7: [0, 3, 6, 9]
};

/** 转位后低音（转位音）与最高音相对根音的半音偏移 */
export function chordSpan(
	structure: number[],
	inversion: number
): { bassOffset: number; topOffset: number } {
	return {
		bassOffset: structure[inversion],
		topOffset:
			inversion === 0
				? structure[structure.length - 1]
				: structure[inversion - 1] + 12
	};
}

/** 该和弦（类型 + 转位）是否能在音域内以某调内音为根音完整放下 */
export function chordFitsPool(
	range: number[],
	key: KeyId,
	type: ChordTypeId,
	inversion: number
): boolean {
	const { bassOffset, topOffset } = chordSpan(
		CHORD_STRUCTURES[type],
		inversion
	);
	return diatonicPool(range, key).some(
		(midi) => midi + bassOffset >= range[0] && midi + topOffset <= range[1]
	);
}

interface Spelling {
	letter: string;
	/** 本位音级的半音数 */
	naturalPc: number;
	/** 相对本位音级的升降（-2..2） */
	accidental: number;
	octave: number;
}

/** 把 MIDI 音高按调号拼写成"音名 + 升降 + 八度"（取绝对值最小的常用拼写） */
export function spell(midi: number, key: KeyId): Spelling {
	const pc = ((midi % 12) + 12) % 12;
	const preferFlat = FLAT_KEYS.has(key);
	let best: Spelling | undefined;
	let bestScore = Number.POSITIVE_INFINITY;
	for (let i = 0; i < LETTERS.length; i++) {
		// 所需升降折算到 [-6, 5]，再取绝对值最小的拼写
		const diff = pc - NATURAL_PC[i];
		const acc = ((((diff + 18) % 12) + 12) % 12) - 6;
		// 平票时降号调偏好降拼写、升号调偏好升拼写
		const score =
			Math.abs(acc) * 2 +
			(acc < 0 ? (preferFlat ? 0 : 1) : acc > 0 ? (preferFlat ? 1 : 0) : 0);
		if (score < bestScore) {
			bestScore = score;
			best = {
				letter: LETTERS[i],
				naturalPc: NATURAL_PC[i],
				accidental: acc,
				octave: Math.floor((midi - NATURAL_PC[i] - acc) / 12) - 1
			};
		}
	}
	return best as Spelling;
}

/**
 * 按指定字母拼写 MIDI 音高：字母由调用方给出（分解和弦按三度叠置推字母，
 * 保证谱面上是正确的三度叠置写法），只算出该字母所需的升降与八度。
 */
export function spellWithLetter(
	midi: number,
	letterIndex: number
): { letter: string; acc: number; octave: number } {
	const naturalPc = NATURAL_PC[letterIndex];
	const diff = (((midi % 12) + 12) % 12) - naturalPc;
	const acc = ((((diff + 18) % 12) + 12) % 12) - 6;
	const octave = Math.floor((midi - naturalPc - acc) / 12) - 1;
	return { letter: LETTERS[letterIndex], acc, octave };
}
