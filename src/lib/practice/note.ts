/** MIDI 音高 → 音名展示（如 60 → C4） */

const NOTE_NAMES = [
	'C',
	'C♯',
	'D',
	'D♯',
	'E',
	'F',
	'F♯',
	'G',
	'G♯',
	'A',
	'A♯',
	'B'
];

export const noteName = (midi: number) =>
	`${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
