/**
 * 跟弹（MIDI 判定）的公共入口：
 *
 * - timeline.ts        题目事件流 → 带绝对时值位置的演奏时间轴
 * - click.ts           Web Audio 节拍器点击声（倒计时用）
 * - session.svelte.ts  会话状态机：倒计时 / 演奏模式 / 练习模式 / 统计
 */

export { ensureAudio } from './click.js';
export {
	type NoteStatus,
	type PlayMode,
	type PlayPhase,
	PlaySession,
	type PlayStats
} from './session.svelte.js';
export { buildTimeline, type Timeline, type TimelineNote } from './timeline.js';
