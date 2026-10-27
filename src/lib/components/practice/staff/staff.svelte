<script lang="ts">
import { onMount } from 'svelte';
import type { Exercise } from '#lib/practice/exercise/index.js';
import type { HighlightBox, PlayHighlight } from './highlight.js';
import { statusColor } from './highlight.js';
import { draw, type VexFlowModule } from './render.js';

let {
	exercise,
	play = null
}: { exercise: Exercise; play?: PlayHighlight | null } = $props();

let root: HTMLDivElement | undefined = $state();
let container: HTMLDivElement | undefined = $state();
let vexflow: VexFlowModule | null = $state(null);
let width = $state(0);
/** 跟弹高亮框：每个渲染音符一个，key 为生成层事件的全曲下标（与 timeline 对齐） */
let highlightBoxes = $state<HighlightBox[]>([]);

/** 待弹游标条高度（px），画在五线谱下方 */
const MARKER_H = 6;
/** 当前游标对应的高亮框（游标可能落在无框的事件上，顺延到其后的第一个框） */
const cursorBox = $derived(
	play
		? (highlightBoxes.find((b) => b.index === play.cursor) ??
				highlightBoxes.find((b) => b.index > play.cursor))
		: undefined
);

// 向上找到最近的可滚动祖先（练习页乐谱区的 overflow-y-auto 容器）
function scrollParentOf(el: HTMLElement): HTMLElement | null {
	for (let p = el.parentElement; p; p = p.parentElement) {
		const overflowY = getComputedStyle(p).overflowY;
		if (
			(overflowY === 'auto' || overflowY === 'scroll') &&
			p.scrollHeight > p.clientHeight
		) {
			return p;
		}
	}
	return null;
}

// 弹奏游标越出乐谱可视区时按行整页翻：越界判断用五线谱下方的游标条
// （符头高低不参与判断，避免翻下去又翻回来）；越过下沿就把游标所在行的
// 行顶对齐到视口上沿，行上方自带留白，一次跳约一页，不逐音符小步滚动
$effect(() => {
	const box = cursorBox;
	if (!box || !root) return;
	const scroller = scrollParentOf(root);
	const page = scroller?.clientHeight ?? 0;
	if (!scroller || page <= 0) return;

	const view = scroller.getBoundingClientRect();
	const rootTop =
		root.getBoundingClientRect().top - view.top + scroller.scrollTop;
	const markerTop = rootTop + box.markY;
	const margin = 12;
	const below = markerTop + MARKER_H > scroller.scrollTop + page - margin;
	const above = markerTop < scroller.scrollTop + margin;
	if (!below && !above) return;

	// 行顶对齐视口上沿，首尾夹回滚动范围
	let target = rootTop + box.rowTop;
	target = Math.max(0, Math.min(target, scroller.scrollHeight - page));
	if (target !== scroller.scrollTop) scroller.scrollTop = target;
});

onMount(() => {
	const observer = new ResizeObserver((entries) => {
		width = entries[0]?.contentRect.width ?? 0;
	});
	if (container) observer.observe(container);
	import('vexflow').then(async (module) => {
		// VexFlow 5 的符头是文字字形，符干的 X 坐标来自 canvas measureText 量出的字形宽度。
		// 字体尚未就绪时量到的是回退字体的宽度，符干就会脱离符头；模块加载完并不等于字体加载完。
		await document.fonts.ready;
		vexflow = module;
	});
	return () => observer.disconnect();
});

// 模块加载完成、容器有宽度后才开始绘制；exercise / 宽度变化时重绘
$effect(() => {
	if (!vexflow || !container || width <= 0) return;
	highlightBoxes = draw(vexflow, container, exercise, width);
});
</script>

<!-- 容器必须占满宽度：空 div 作为 flex 居中项会收缩为 0，导致 ResizeObserver 永远测不到宽度 -->
<div bind:this={root} class="relative w-full min-h-0">
	<div bind:this={container} class="w-full min-w-0"></div>
	{#if play}
		<div class="pointer-events-none absolute inset-0">
			{#each highlightBoxes as box (box.index)}
				{@const status = play.statuses[box.index] ?? 'pending'}
				{#if status !== 'pending'}
					<div
						class="absolute rounded-[3px] transition-colors duration-100 {statusColor(
							status
						)}"
						style="left: {box.x}px; top: {box.y}px; width: {box.w}px; height: {box.h}px;"
					></div>
				{/if}
			{/each}
			<!-- 待弹游标：画在五线谱下方的短条，不框住音符，避免干扰视谱 -->
			{#if cursorBox}
				<div
					data-cursor
					class="absolute rounded-full bg-primary"
					style="left: {cursorBox.x}px; top: {cursorBox.markY}px; width: {cursorBox.w}px; height: {MARKER_H}px;"
				></div>
			{/if}
		</div>
	{/if}
</div>
