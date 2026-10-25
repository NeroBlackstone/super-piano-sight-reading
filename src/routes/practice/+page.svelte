<script lang="ts">
import { ArrowLeft, Maximize2, Minimize2 } from '@lucide/svelte';
import { onMount } from 'svelte';
import SiteHeader from '#lib/components/practice/site-header.svelte';
import Staff from '#lib/components/practice/staff.svelte';
import { Button } from '#lib/components/ui/button/index.js';
import { m } from '#lib/paraglide/messages.js';
import type { PracticeConfig } from '#lib/practice/config.js';
import {
	type Exercise,
	generateExercise,
	mulberry32
} from '#lib/practice/exercise/index.js';
import {
	beatUnitFor,
	keyLabels,
	timeSignatureLabels
} from '#lib/practice/options.js';
import { loadPracticeConfig } from '#lib/practice/session.js';
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';

let config = $state<PracticeConfig | null>(null);
let exercise = $state<Exercise | null>(null);
let fullscreen = $state(false);

let stage: HTMLDivElement | undefined = $state();

onMount(() => {
	const saved = loadPracticeConfig();
	if (!saved) {
		// 直接访问或会话过期：回到配置页
		goto(resolve('/'));
		return;
	}
	config = saved;
	exercise = generateExercise(saved, mulberry32(Date.now()));

	const onFullscreenChange = () => {
		fullscreen = document.fullscreenElement != null;
	};
	document.addEventListener('fullscreenchange', onFullscreenChange);
	return () =>
		document.removeEventListener('fullscreenchange', onFullscreenChange);
});

async function toggleFullscreen() {
	if (document.fullscreenElement) {
		await document.exitFullscreen();
	} else {
		await stage?.requestFullscreen();
	}
}

const info = $derived(
	exercise
		? [
				keyLabels[exercise.key],
				timeSignatureLabels[exercise.timeSignature],
				`${beatUnitFor(exercise.timeSignature).glyph} = ${exercise.tempo}`,
				m.practiceMeasures({ count: exercise.measures.length })
			].join(m.listJoiner())
		: ''
);
</script>

<svelte:head>
	<title>{m.practicePageTitle()}</title>
</svelte:head>

<SiteHeader />

<main class="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-8">
	<!-- bind:this 到全屏容器：工具栏随内容一起进入全屏，退出按钮始终可用 -->
	<div bind:this={stage} class="stage flex flex-col justify-center gap-4">
		<div class="flex items-center justify-between gap-2">
			<Button
				type="button"
				variant="outline"
				size="sm"
				onclick={() => goto(resolve('/'))}
			>
				<ArrowLeft class="size-4" />
				{m.practiceBack()}
			</Button>
			<span class="text-sm tabular-nums text-muted-foreground">
				{info}
			</span>
			<Button
				type="button"
				variant="outline"
				size="sm"
				onclick={toggleFullscreen}
			>
				{#if fullscreen}
					<Minimize2 class="size-4" />
					{m.practiceExitFullscreen()}
				{:else}
					<Maximize2 class="size-4" />
					{m.practiceFullscreen()}
				{/if}
			</Button>
		</div>

		<div
			class="flex min-h-48 items-center justify-center rounded-lg border bg-card p-4"
		>
			{#if exercise}
				<Staff {exercise} />
			{:else}
				<span class="text-sm text-muted-foreground">{m.practiceLoading()}</span>
			{/if}
		</div>
	</div>
</main>

<style>
/* 全屏时铺满屏幕、去掉谱面卡片的圆角边框 */
.stage:fullscreen {
	background: var(--background);
	padding: 2rem;
}

.stage:fullscreen > div:last-child {
	border: none;
	border-radius: 0;
	height: 100%;
}
</style>
