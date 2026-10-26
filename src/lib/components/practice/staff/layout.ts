import type { TimeSignature } from '#lib/practice/config.js';
import type { NoteEvent } from '#lib/practice/exercise/index.js';

export const STAVE_MARGIN = 12;
/** 每行（谱表系统）占的像素高度 */
export const ROW_HEIGHT = 140;
/** 谱表上方的和弦代号（顺阶分解和弦模式）需要额外的垂直空间 */
export const SYMBOL_ROW_HEIGHT = 170;
/** 首行谱表上方预留的空白 */
export const TOP_MARGIN = 20;
/** 有和弦代号时首行上方预留的空白（代号在顶线上方最多约 30px） */
export const SYMBOL_TOP_MARGIN = 44;
/** 小节的最小宽度（px）：不超过基准事件数的小节就占这么宽 */
const MIN_MEASURE_WIDTH = 300;
/** 小节宽度的基准事件数：8 个音符（含休止符）的小节占最小宽度 */
const BASE_EVENTS = 8;
/** 超出基准的每个事件按此倍数计权：密集小节的拉伸比等比例更宽 */
const EXCESS_WEIGHT = 3;

/**
 * 小节宽度的计权：不超过 BASE_EVENTS 个事件的小节都算基准宽（最小宽度）；
 * 超出的部分每个事件按 EXCESS_WEIGHT 倍计，事件越多的小节拉伸越猛
 * （密集小节的十六分音符字形 / 符杠更占宽，仅按个数等比例分宽不够）。
 */
function measureWeight(eventCount: number): number {
	return eventCount <= BASE_EVENTS
		? BASE_EVENTS
		: BASE_EVENTS + EXCESS_WEIGHT * (eventCount - BASE_EVENTS);
}

/** 小节的期望宽度：计权除以基准事件数，再乘最小宽度 */
export function desiredWidth(eventCount: number): number {
	return (MIN_MEASURE_WIDTH * measureWeight(eventCount)) / BASE_EVENTS;
}

/**
 * 按期望宽度把小节贪心分行：一行尽量多装，装不下下一个小节就换行，
 * 不硬凑固定的小节数；每行至少一个小节（期望宽度超过行宽的密集小节独占一行）。
 */
export function layoutRows(
	measures: NoteEvent[][],
	available: number
): NoteEvent[][][] {
	const rows: NoteEvent[][][] = [];
	let row: NoteEvent[][] = [];
	let rowWidth = 0;
	for (const measure of measures) {
		const w = desiredWidth(measure.length);
		if (row.length > 0 && rowWidth + w > available) {
			rows.push(row);
			row = [];
			rowWidth = 0;
		}
		row.push(measure);
		rowWidth += w;
	}
	if (row.length > 0) rows.push(row);
	return rows;
}

/** 符杠分组的拍长：/4 拍按四分音符，6/8 按附点四分音符 */
export function beatUnitsFor(timeSignature: TimeSignature): number {
	return timeSignature === '6/8' ? 6 : 4;
}
