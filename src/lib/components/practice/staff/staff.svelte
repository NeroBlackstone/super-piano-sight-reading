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

let container: HTMLDivElement | undefined = $state();
let vexflow: VexFlowModule | null = $state(null);
let width = $state(0);
/** 跟弹高亮框：每个渲染音符一个，key 为生成层事件的全曲下标（与 timeline 对齐） */
let highlightBoxes = $state<HighlightBox[]>([]);

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
<div class="relative w-full min-h-0">
	<div bind:this={container} class="w-full min-w-0"></div>
	{#if play}
		<div class="pointer-events-none absolute inset-0">
			{#each highlightBoxes as box (box.index)}
				{@const status = play.statuses[box.index] ?? 'pending'}
				{#if status !== 'pending' || play.cursor === box.index}
					<div
						class="absolute rounded-[3px] transition-colors duration-100 {statusColor(
							status
						)} {play.cursor === box.index ? 'ring-1 ring-primary/60' : ''}"
						style="left: {box.x}px; top: {box.y}px; width: {box.w}px; height: {box.h}px;"
					></div>
				{/if}
			{/each}
		</div>
	{/if}
</div>
