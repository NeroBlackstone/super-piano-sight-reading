<script lang="ts">
import {
	ArrowLeft,
	Maximize2,
	Minimize2,
	Pause,
	Play,
	RotateCcw
} from '@lucide/svelte';
import { onMount } from 'svelte';
import SiteHeader from '#lib/components/practice/site-header.svelte';
import Staff from '#lib/components/practice/staff/staff.svelte';
import { Button } from '#lib/components/ui/button/index.js';
import {
	ToggleGroup,
	ToggleGroupItem
} from '#lib/components/ui/toggle-group/index.js';
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
import { type PlayMode, PlaySession } from '#lib/practice/play/index.js';
import { loadPracticeConfig } from '#lib/practice/session.js';
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';

let config = $state<PracticeConfig | null>(null);
let exercise = $state<Exercise | null>(null);
let fullscreen = $state(false);
let session = $state<PlaySession | null>(null);
let mode = $state<PlayMode>('performance');

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
	session = new PlaySession(exercise);

	const onFullscreenChange = () => {
		fullscreen = document.fullscreenElement != null;
	};
	document.addEventListener('fullscreenchange', onFullscreenChange);
	return () => {
		document.removeEventListener('fullscreenchange', onFullscreenChange);
		session?.dispose();
	};
});

// 模式只在非演奏中可切换，切换后同步进会话（done 阶段改完再开始也生效）
$effect(() => {
	if (session && !running) session.mode = mode;
});

async function toggleFullscreen() {
	if (document.fullscreenElement) {
		await document.exitFullscreen();
	} else {
		await stage?.requestFullscreen();
	}
}

function togglePlay() {
	if (!session) return;
	if (session.phase === 'idle' || session.phase === 'done') session.start();
	else session.stop();
}

const running = $derived(
	session?.phase === 'countIn' || session?.phase === 'playing'
);

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

const percent = $derived(
	session ? Math.round(session.stats.accuracy * 100) : 0
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
			class="staff-card relative flex min-h-48 items-center justify-center rounded-lg border bg-card p-4"
		>
			{#if exercise}
				<Staff
					{exercise}
					play={session && session.phase !== 'idle'
						? { cursor: session.cursor, statuses: session.statuses }
						: null}
				/>
			{:else}
				<span class="text-sm text-muted-foreground">{m.practiceLoading()}</span>
			{/if}

			<!-- 倒计时覆盖层：大数字 + 拍点 -->
			{#if session?.phase === 'countIn'}
				<div
					class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-lg bg-card/85 backdrop-blur-sm"
				>
					<span class="text-7xl font-bold tabular-nums text-primary"
						>{session.countInBeat}</span
					>
					<div class="flex gap-1.5">
						{#each Array(session.timeline.beatsPerMeasure) as _, i (i)}
							<span
								class="size-2 rounded-full transition-colors {i <
								session.timeline.beatsPerMeasure - session.countInBeat
									? 'bg-primary'
									: 'bg-muted'}"
							></span>
						{/each}
					</div>
					<span class="text-sm text-muted-foreground"
						>{m.practiceCountIn()}</span
					>
				</div>
			{/if}

			<!-- 完成统计覆盖层 -->
			{#if session?.phase === 'done'}
				<div
					class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 rounded-lg bg-card/90 p-6 backdrop-blur-sm"
				>
					<span class="text-lg font-semibold">{m.practiceDone()}</span>
					<div class="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
						<span class="text-muted-foreground"
							>{m.practiceStatsCorrect()}</span
						>
						<span class="text-right font-medium tabular-nums"
							>{session.stats.correct}
							/ {session.stats.total}</span
						>
						<span class="text-muted-foreground">{m.practiceStatsWrong()}</span>
						<span class="text-right font-medium tabular-nums"
							>{session.stats.wrong}</span
						>
						<span class="text-muted-foreground">{m.practiceStatsMissed()}</span>
						<span class="text-right font-medium tabular-nums"
							>{session.stats.missed}</span
						>
						<span class="text-muted-foreground"
							>{m.practiceStatsAccuracy()}</span
						>
						<span class="text-right font-semibold tabular-nums"
							>{percent}%</span
						>
					</div>
					<Button type="button" size="sm" onclick={togglePlay}>
						<RotateCcw class="size-4" />
						{m.practiceAgain()}
					</Button>
				</div>
			{/if}
		</div>

		<div class="flex items-center justify-center gap-2">
			<ToggleGroup
				type="single"
				size="sm"
				variant="outline"
				bind:value={mode}
				disabled={running}
			>
				<ToggleGroupItem value="performance" disabled={running}>
					{m.practiceModePerformance()}
				</ToggleGroupItem>
				<ToggleGroupItem value="practice" disabled={running}>
					{m.practiceModePractice()}
				</ToggleGroupItem>
			</ToggleGroup>
			<Button type="button" size="sm" onclick={togglePlay}>
				{#if running}
					<Pause class="size-4" />
					{m.practiceStop()}
				{:else}
					<Play class="size-4" />
					{session?.phase === 'done' ? m.practiceAgain() : m.practiceStart()}
				{/if}
			</Button>
		</div>
	</div>
</main>

<style>
/* 全屏时铺满屏幕、去掉谱面卡片的圆角边框 */
.stage:fullscreen {
	background: var(--background);
	padding: 2rem;
}

.stage:fullscreen > .staff-card {
	border: none;
	border-radius: 0;
	height: 100%;
}
</style>
