<script lang="ts">
import {
	ArrowLeft,
	Maximize2,
	Minimize2,
	Pause,
	Play,
	RefreshCcw,
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

// shadcn 默认选中态 bg-muted 偏淡，选中时改为 primary 实底反色文字（与配置页一致）
const activeItemClass =
	'data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:hover:bg-primary/90 data-[state=on]:hover:text-primary-foreground';

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

// 完成后用同一配置重新出题：换随机种子生成新题，回到待开始状态
function regenerate() {
	if (!config) return;
	session?.dispose();
	exercise = generateExercise(config, mulberry32(Date.now()));
	session = new PlaySession(exercise);
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

<!-- 整页高度固定为视口高度：header 与底部按钮常驻，只有乐谱区域弹性伸缩并内部滚动 -->
<div class="flex h-dvh flex-col overflow-hidden">
	<SiteHeader />

	<main
		class="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col px-4 py-6 sm:px-6 lg:py-8"
	>
		<!-- bind:this 到全屏容器：工具栏随内容一起进入全屏，退出按钮始终可用 -->
		<div bind:this={stage} class="stage flex min-h-0 flex-1 flex-col gap-4">
			<div class="flex shrink-0 items-center justify-between gap-2">
				<Button
					type="button"
					variant="outline"
					size="sm"
					onclick={() => goto(resolve('/'))}
				>
					<ArrowLeft class="size-4" />
					{m.practiceBack()}
				</Button>
				<!-- 倒计时放在顶栏：不遮挡谱面，用户可边数拍边看谱 -->
				<span
					class="flex min-w-0 items-center gap-2 text-sm tabular-nums text-muted-foreground"
				>
					{#if session?.phase === 'countIn'}
						<span
							class="flex shrink-0 items-center gap-1.5 font-semibold text-primary"
						>
							<span class="text-lg leading-none">{session.countInBeat}</span>
							<span class="flex gap-1">
								{#each Array(session.timeline.beatsPerMeasure) as _, i (i)}
									<span
										class="size-1.5 rounded-full {i <
										session.timeline.beatsPerMeasure - session.countInBeat
											? 'bg-primary'
											: 'bg-muted'}"
									></span>
								{/each}
							</span>
							<span class="font-normal text-muted-foreground"
								>{m.practiceCountIn()}</span
							>
						</span>
					{/if}
					<span class="truncate">{info}</span>
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
				class="staff-card relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border bg-card"
			>
				<!-- 唯一可伸缩 / 可滚动的区域：auto 外边距居中，内容超高时不会像 justify-center 那样裁掉顶部 -->
				<div class="flex min-h-0 flex-1 overflow-y-auto p-4">
					<div class="m-auto flex w-full items-center justify-center">
						{#if exercise}
							<Staff
								{exercise}
								play={session && session.phase !== 'idle'
									? { cursor: session.cursor, statuses: session.statuses }
									: null}
							/>
						{:else}
							<span class="text-sm text-muted-foreground"
								>{m.practiceLoading()}</span
							>
						{/if}
					</div>
				</div>

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
							<span class="text-muted-foreground"
								>{m.practiceStatsWrong()}</span
							>
							<span class="text-right font-medium tabular-nums"
								>{session.stats.wrong}</span
							>
							<span class="text-muted-foreground"
								>{m.practiceStatsMissed()}</span
							>
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
						<div class="flex gap-2">
							<Button type="button" size="sm" onclick={regenerate}>
								<RefreshCcw class="size-4" />
								{m.practiceRegenerate()}
							</Button>
							<Button
								type="button"
								size="sm"
								variant="outline"
								onclick={togglePlay}
							>
								<RotateCcw class="size-4" />
								{m.practiceAgain()}
							</Button>
						</div>
					</div>
				{/if}
			</div>

			<div class="flex shrink-0 items-center justify-center gap-2">
				<ToggleGroup
					type="single"
					size="sm"
					variant="outline"
					bind:value={mode}
					disabled={running}
				>
					<ToggleGroupItem
						value="performance"
						disabled={running}
						class={activeItemClass}
					>
						{m.practiceModePerformance()}
					</ToggleGroupItem>
					<ToggleGroupItem
						value="practice"
						disabled={running}
						class={activeItemClass}
					>
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
</div>

<style>
/* 全屏时铺满屏幕、去掉谱面卡片的圆角边框；布局仍靠 flex，乐谱区继续弹性伸缩 */
.stage:fullscreen {
	background: var(--background);
	padding: 2rem;
	height: 100%;
}

.stage:fullscreen > .staff-card {
	border: none;
	border-radius: 0;
}
</style>
