/**
 * 跟弹会话状态机（Svelte 5 runes）：idle → countIn → playing → done。
 *
 * - 倒计时一小节：点击声提前排到 AudioContext 时钟（无抖动），视觉用 rAF 对齐；
 * - 演奏模式：rAF + performance.now() 按时值推进游标，弹错不阻塞，窗口过了没弹记 missed；
 * - 练习模式：事件驱动，弹对当前音才前进，不考虑节奏，休止符直接跳过；
 * - 判定输入来自 Web MIDI 的 note-on（subscribeNotes）。
 */
import type { Exercise } from '../exercise/index.js';
import { subscribeNotes } from '../midi.svelte.js';
import { audioNow, ensureAudio, scheduleClick } from './click.js';
import { buildTimeline, type Timeline } from './timeline.js';

export type PlayMode = 'performance' | 'practice';
export type PlayPhase = 'idle' | 'countIn' | 'playing' | 'done';
/** 逐音判定：练习模式的 wrong 在弹对后会被覆盖为 correct */
export type NoteStatus = 'pending' | 'correct' | 'wrong' | 'missed';

export interface PlayStats {
	/** 最终判对的音符数 */
	correct: number;
	/** 弹错的按键次数（含练习模式下未弹对的尝试） */
	wrong: number;
	/** 演奏模式下时值走完仍未弹的音符数 */
	missed: number;
	/** 全曲音符总数（不含休止符） */
	total: number;
	/** correct / total，0–1 */
	accuracy: number;
}

/** 倒计时首个点击相对当下的提前量（秒），给音频排程留余地 */
const COUNT_IN_LEAD_S = 0.15;
/** 提前量上限：允许在音符开始前这么久按下，算到该音符头上（秒） */
const EARLY_LEAD_S = 0.15;
/** 提前量相对音符时值的比例上限 */
const EARLY_LEAD_RATIO = 0.4;

export class PlaySession {
	readonly timeline: Timeline;

	mode = $state<PlayMode>('performance');
	phase = $state<PlayPhase>('idle');
	/** 当前游标（timeline.notes 下标）：演奏模式由时钟推进，练习模式等弹对才前进 */
	cursor = $state(0);
	/** 倒计时剩余拍数 */
	countInBeat = $state(0);
	/** 逐音判定状态（含休止符位，休止符恒为 pending） */
	statuses = $state<NoteStatus[]>([]);
	/** 弹错按键总次数 */
	wrongPresses = $state(0);

	stats = $derived.by(() => {
		let correct = 0;
		let missed = 0;
		let total = 0;
		this.timeline.notes.forEach((note, i) => {
			if (note.midi === null) return;
			total++;
			const status = this.statuses[i];
			if (status === 'correct') correct++;
			else if (status === 'missed') missed++;
		});
		return {
			correct,
			wrong: this.wrongPresses,
			missed,
			total,
			accuracy: total > 0 ? correct / total : 0
		};
	});

	#raf = 0;
	#unsubscribe: (() => void) | null = null;
	/** 倒计时起始的 performance.now() 锚点 */
	#countInStart = 0;
	/** 演奏起始的 performance.now() 锚点 */
	#playStart = 0;

	constructor(exercise: Exercise) {
		this.timeline = buildTimeline(exercise);
		this.#reset();
	}

	/** 开始（或再来一次）：重置判定，倒计时一小节后进入演奏 */
	start(): void {
		if (this.phase === 'countIn' || this.phase === 'playing') return;
		this.#reset();
		ensureAudio();
		this.#unsubscribe = subscribeNotes((event) => {
			if (event.on) this.#onNoteOn(event.midi);
		});

		const beats = this.timeline.beatsPerMeasure;
		const beatSeconds = this.timeline.secondsPerBeat;
		const audioStart = audioNow() + COUNT_IN_LEAD_S;
		for (let i = 0; i < beats; i++) {
			scheduleClick(audioStart + i * beatSeconds, i === 0);
		}
		this.#countInStart = performance.now() + COUNT_IN_LEAD_S * 1000;
		this.countInBeat = beats;
		this.phase = 'countIn';
		this.#loop();
	}

	/** 停止：回到 idle，清空判定 */
	stop(): void {
		this.#teardown();
		this.#reset();
		this.phase = 'idle';
	}

	/** 组件卸载时释放 rAF 与 MIDI 订阅 */
	dispose(): void {
		this.#teardown();
	}

	#reset(): void {
		cancelAnimationFrame(this.#raf);
		this.#raf = 0;
		this.cursor = 0;
		this.wrongPresses = 0;
		this.statuses = this.timeline.notes.map(() => 'pending' as NoteStatus);
		if (this.mode === 'practice') this.#skipRests();
	}

	#teardown(): void {
		cancelAnimationFrame(this.#raf);
		this.#raf = 0;
		this.#unsubscribe?.();
		this.#unsubscribe = null;
	}

	/** 当前时钟位置（十六分单位，全曲累计） */
	#elapsedUnits(): number {
		return (
			(performance.now() - this.#playStart) /
			1000 /
			this.timeline.unitsToSeconds
		);
	}

	#loop = (): void => {
		this.#raf = requestAnimationFrame(this.#loop);
		const now = performance.now();

		if (this.phase === 'countIn') {
			const beatMs = this.timeline.secondsPerBeat * 1000;
			const beat = Math.floor((now - this.#countInStart) / beatMs);
			this.countInBeat = Math.max(0, this.timeline.beatsPerMeasure - beat);
			if (beat >= this.timeline.beatsPerMeasure) {
				this.#playStart =
					this.#countInStart + this.timeline.beatsPerMeasure * beatMs;
				this.phase = 'playing';
				if (this.mode === 'practice') {
					// 练习模式纯事件驱动，无需时钟循环
					this.#skipRests();
					cancelAnimationFrame(this.#raf);
					this.#raf = 0;
				}
			}
			return;
		}

		if (this.phase !== 'playing' || this.mode !== 'performance') return;
		// 时钟推进游标：窗口走完的 pending 音符记 missed
		const notes = this.timeline.notes;
		while (
			this.cursor < notes.length &&
			notes[this.cursor].startUnits + notes[this.cursor].costUnits <=
				this.#elapsedUnits()
		) {
			if (
				notes[this.cursor].midi !== null &&
				this.statuses[this.cursor] === 'pending'
			) {
				this.statuses[this.cursor] = 'missed';
			}
			this.cursor++;
		}
		if (this.cursor >= notes.length) this.#finish();
	};

	#finish(): void {
		this.#teardown();
		this.phase = 'done';
	}

	/** 练习模式：游标跳过休止符，落在下一个要弹的音上 */
	#skipRests(): void {
		const notes = this.timeline.notes;
		while (this.cursor < notes.length && notes[this.cursor].midi === null) {
			this.cursor++;
		}
		if (this.cursor >= notes.length) this.#finish();
	}

	/** 下一个非休止事件的下标（不含 from），无则 -1 */
	#nextNoteIndex(from: number): number {
		const notes = this.timeline.notes;
		for (let i = from; i < notes.length; i++) {
			if (notes[i].midi !== null) return i;
		}
		return -1;
	}

	#onNoteOn(midi: number): void {
		if (this.phase !== 'playing') return;
		if (this.mode === 'practice') this.#judgePractice(midi);
		else this.#judgePerformance(midi);
	}

	#judgePractice(midi: number): void {
		const target = this.timeline.notes[this.cursor];
		if (!target) return;
		if (target.midi === midi) {
			this.statuses[this.cursor] = 'correct';
			this.cursor++;
			this.#skipRests();
		} else {
			this.wrongPresses++;
			// 标红当前音；弹对后覆盖为 correct
			if (this.statuses[this.cursor] === 'pending') {
				this.statuses[this.cursor] = 'wrong';
			}
		}
	}

	#judgePerformance(midi: number): void {
		const notes = this.timeline.notes;
		const elapsed = this.#elapsedUnits();
		const current = notes[this.cursor];

		// 命中当前窗口的音符
		if (current && current.midi === midi) {
			this.statuses[this.cursor] = 'correct';
			return;
		}

		// 提前量内命中下一个音符（跳过休止符）
		const next = this.#nextNoteIndex(this.cursor + 1);
		if (next >= 0) {
			const note = notes[next];
			const leadUnits =
				Math.min(
					EARLY_LEAD_S,
					note.costUnits * this.timeline.unitsToSeconds * EARLY_LEAD_RATIO
				) / this.timeline.unitsToSeconds;
			if (note.midi === midi && elapsed >= note.startUnits - leadUnits) {
				// 跳到该音时，当前窗口还没弹的音符按 missed 记（其间只有休止符则无影响）
				const skipped = notes[this.cursor];
				if (
					skipped &&
					skipped.midi !== null &&
					this.statuses[this.cursor] === 'pending'
				) {
					this.statuses[this.cursor] = 'missed';
				}
				this.statuses[next] = 'correct';
				// 游标跳到该音（其间只有休止符，无 missed 可记）
				this.cursor = next;
				return;
			}
		}

		this.wrongPresses++;
		// 演奏模式弹错不阻塞：仅标红当前 pending 的音符
		if (
			current &&
			current.midi !== null &&
			this.statuses[this.cursor] === 'pending'
		) {
			this.statuses[this.cursor] = 'wrong';
		}
	}
}
