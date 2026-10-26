import type { StaveNote } from 'vexflow';
import {
	type Exercise,
	eventCost,
	type NoteEvent,
	snapToGrid
} from '#lib/practice/exercise/index.js';
import type { NoteStatus } from '#lib/practice/play/index.js';

/** 跟弹高亮信息：游标（timeline 全局下标）与逐音判定 */
export interface PlayHighlight {
	cursor: number;
	statuses: NoteStatus[];
}

/** 跟弹高亮框：一个渲染音符（记谱层事件）一个，index 为生成层全曲下标 */
export interface HighlightBox {
	index: number;
	x: number;
	y: number;
	w: number;
	h: number;
}

/** 判定状态 → 高亮底色（尾逗号让 Tailwind 扫描到这些类名） */
export function statusColor(status: NoteStatus): string {
	switch (status) {
		case 'correct':
			return 'bg-emerald-500/25';
		case 'wrong':
			return 'bg-red-500/25';
		case 'missed':
			return 'bg-amber-500/25';
		default:
			return 'bg-primary/10';
	}
}

/**
 * 记谱层 → 生成层的高亮映射：两层事件依次铺满同一小节区间，
 * 按「记谱事件起点落在哪个生成事件内」做区间包含（连音链的各段同归一个生成事件）。
 * 坐标取符头包围盒（不含符干），拼成符头周围的圆角矩形。
 */
export function computeHighlightBoxes(
	exercise: Exercise,
	notatedMeasures: NoteEvent[][],
	tickablesByMeasure: StaveNote[][]
): HighlightBox[] {
	const boxes: HighlightBox[] = [];
	let globalIndex = 0;
	exercise.measures.forEach((measure, m) => {
		const genStarts: number[] = [];
		let position = 0;
		for (const event of measure) {
			genStarts.push(position);
			position = snapToGrid(position + eventCost(event));
		}
		let notatedPosition = 0;
		notatedMeasures[m].forEach((event, k) => {
			const start = notatedPosition;
			notatedPosition = snapToGrid(notatedPosition + eventCost(event));
			const note = tickablesByMeasure[m]?.[k];
			if (!note) return;
			let g = 0;
			for (let i = genStarts.length - 1; i >= 0; i--) {
				if (genStarts[i] <= start + 1e-6) {
					g = i;
					break;
				}
			}
			const { yTop, yBottom } = note.getNoteHeadBounds();
			const x = note.getNoteHeadBeginX();
			boxes.push({
				index: globalIndex + g,
				x: x - 5,
				y: Math.min(yTop, yBottom) - 7,
				w: note.getNoteHeadEndX() - x + 10,
				h: Math.abs(yBottom - yTop) + 14
			});
		});
		globalIndex += measure.length;
	});
	return boxes;
}
