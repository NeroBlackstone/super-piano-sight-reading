<script lang="ts">
import {
	Layers,
	Music2,
	Piano,
	Play,
	RotateCcw,
	Shuffle,
	SlidersHorizontal,
	Timer
} from '@lucide/svelte';
import { Badge } from '#lib/components/ui/badge/index.js';
import { Button } from '#lib/components/ui/button/index.js';
import * as Card from '#lib/components/ui/card/index.js';
import { Separator } from '#lib/components/ui/separator/index.js';
import { Slider } from '#lib/components/ui/slider/index.js';
import { Switch } from '#lib/components/ui/switch/index.js';
import {
	ToggleGroup,
	ToggleGroupItem
} from '#lib/components/ui/toggle-group/index.js';

// —— 原型：仅用于展示交互状态，未接入任何练习逻辑 ——
let clef = $state('treble');
let keyType = $state('major');
let keys = $state<string[]>(['C', 'G', 'F']);
let range = $state<number[]>([48, 72]);
let durations = $state<string[]>(['quarter', 'eighth']);
let texture = $state('single');
let includeRests = $state(true);
let includeAccidentals = $state(false);
let includeDots = $state(false);
let notesPerExercise = $state(16);
let exerciseCount = $state('10');
let timed = $state(true);
let secondsPerExercise = $state(8);

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
const noteName = (midi: number) =>
	`${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;

const clefLabels: Record<string, string> = {
	treble: '高音谱号',
	bass: '低音谱号',
	grand: '大谱表'
};
const keyTypeLabels: Record<string, string> = {
	major: '大调',
	minor: '小调',
	both: '大小调'
};
const keyOptions = [
	{ id: 'C', label: 'C' },
	{ id: 'G', label: 'G' },
	{ id: 'D', label: 'D' },
	{ id: 'A', label: 'A' },
	{ id: 'E', label: 'E' },
	{ id: 'B', label: 'B' },
	{ id: 'F#', label: 'F♯' },
	{ id: 'F', label: 'F' },
	{ id: 'Bb', label: 'B♭' },
	{ id: 'Eb', label: 'E♭' },
	{ id: 'Ab', label: 'A♭' },
	{ id: 'Db', label: 'D♭' }
];
const keyLabels: Record<string, string> = Object.fromEntries(
	keyOptions.map((option) => [option.id, option.label])
);
const durationOptions = [
	{ id: 'whole', label: '全音符' },
	{ id: 'half', label: '二分' },
	{ id: 'quarter', label: '四分' },
	{ id: 'eighth', label: '八分' },
	{ id: 'sixteenth', label: '十六分' }
];
const durationLabels: Record<string, string> = Object.fromEntries(
	durationOptions.map((option) => [option.id, option.label])
);
const textureLabels: Record<string, string> = {
	single: '单音旋律',
	dyad: '双音（音程）',
	chord: '三和弦'
};

// 钢琴键盘示意：C2 – C6
const KB_MIN = 36;
const KB_MAX = 84;
const WHITE_PCS = [0, 2, 4, 5, 7, 9, 11];
const BLACK_AFTER_PCS = [0, 2, 5, 7, 9];
const whiteKeys = Array.from(
	{ length: KB_MAX - KB_MIN + 1 },
	(_, index) => KB_MIN + index
).filter((midi) => WHITE_PCS.includes(midi % 12));
const whiteWidth = 100 / whiteKeys.length;
const blackWidth = whiteWidth * 0.62;
const blackKeys = whiteKeys
	.map((midi, index) => ({ midi, index }))
	.filter(({ midi }) => BLACK_AFTER_PCS.includes(midi % 12))
	.map(({ midi, index }) => ({ midi: midi + 1, index }))
	.filter(({ midi }) => midi <= KB_MAX)
	.map(({ midi, index }) => ({
		midi,
		left: (index + 1) * whiteWidth - blackWidth / 2
	}));
const inRange = (midi: number) => midi >= range[0] && midi <= range[1];

const rangePresets = [
	{ id: 'near', label: '中央C附近', value: [60, 72] },
	{ id: 'basic', label: '常用音域', value: [48, 72] },
	{ id: 'wide', label: '宽音域', value: [36, 84] }
];
const applyPreset = (value: number[]) => {
	range = [...value];
};

const countLabels: Record<string, string> = {
	'10': '10 题',
	'20': '20 题',
	'30': '30 题',
	'0': '不限'
};

const difficulty = $derived.by(() => {
	let score = 0;
	const width = range[1] - range[0];
	if (width > 60) score += 2;
	else if (width > 36) score += 1;
	if (clef === 'grand') score += 1;
	if (durations.includes('eighth') || durations.includes('sixteenth'))
		score += 1;
	if (texture !== 'single') score += 1;
	if (keys.length >= 6) score += 1;
	if (score <= 1) return '入门';
	if (score <= 3) return '进阶';
	return '挑战';
});

const summaryKeyType = $derived(
	keys.length > 0
		? `${keyTypeLabels[keyType]} · ${keys.map((id) => keyLabels[id]).join('、')}`
		: '未选择调号'
);
const summaryDurations = $derived(
	durations.length > 0
		? durations.map((id) => durationLabels[id]).join('、')
		: '未选择'
);
</script>

<svelte:head>
	<title>视奏练习 · 配置</title>
</svelte:head>

{#snippet staffIcon(
	kind: 'treble' | 'bass' | 'grand'
)}
	{#if kind === 'grand'}
		<svg viewBox="0 0 72 44" class="size-16" aria-hidden="true">
			<title>大谱表示意</title>
			<g stroke="currentColor" stroke-width="1" opacity="0.55">
				{#each [5, 9, 13, 17, 21] as y (y)}
					<line x1="6" y1={y} x2="66" y2={y} />
				{/each}
				{#each [27, 31, 35, 39, 43] as y (y)}
					<line x1="6" y1={y} x2="66" y2={y} />
				{/each}
			</g>
			<path
				d="M13 4 C 7 12, 15 16, 10 22 C 15 28, 7 32, 13 44"
				fill="none"
				stroke="currentColor"
				stroke-width="1.6"
				stroke-linecap="round"
			/>
			<g fill="currentColor">
				<ellipse
					cx="40"
					cy="17"
					rx="5.4"
					ry="4"
					transform="rotate(-18 40 17)"
				/>
				<rect x="44.6" y="5" width="1.6" height="12" />
				<ellipse
					cx="28"
					cy="31"
					rx="5.4"
					ry="4"
					transform="rotate(-18 28 31)"
				/>
				<rect x="32.6" y="19" width="1.6" height="12" />
			</g>
		</svg>
	{:else}
		<svg viewBox="0 0 72 44" class="size-16" aria-hidden="true">
			<title>{kind === 'treble' ? '高音谱表示意' : '低音谱表示意'}</title>
			<g stroke="currentColor" stroke-width="1" opacity="0.55">
				{#each [8, 16, 24, 32, 40] as y (y)}
					<line x1="6" y1={y} x2="66" y2={y} />
				{/each}
			</g>
			<g fill="currentColor">
				<ellipse
					cx="42"
					cy={kind === 'treble' ? 20 : 34}
					rx="6"
					ry="4.4"
					transform={kind === 'treble'
						? 'rotate(-18 42 20)'
						: 'rotate(-18 42 34)'}
				/>
				{#if kind === 'treble'}
					<rect x="47" y="6" width="1.8" height="14" />
					<path
						d="M42 8 q6 3 4 8"
						fill="none"
						stroke="currentColor"
						stroke-width="1.4"
						stroke-linecap="round"
					/>
				{:else}
					<rect x="47" y="22" width="1.8" height="14" />
					<path
						d="M42 38 q6 3 4 8"
						fill="none"
						stroke="currentColor"
						stroke-width="1.4"
						stroke-linecap="round"
					/>
				{/if}
			</g>
		</svg>
	{/if}
{/snippet}

{#snippet summaryRow(
	label: string,
	value: string
)}
	<div class="flex items-start justify-between gap-3 py-1 text-sm">
		<span class="shrink-0 text-muted-foreground">{label}</span>
		<span class="text-right font-medium">{value}</span>
	</div>
{/snippet}

<header class="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
	<div
		class="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6"
	>
		<div class="flex min-w-0 items-center gap-2.5">
			<span
				class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground"
			>
				<Piano class="size-4.5" />
			</span>
			<span class="truncate text-sm font-semibold tracking-tight"
				>钢琴视奏练习器</span
			>
			<Badge variant="outline" class="hidden sm:inline-flex"
				>原型 · 配置页</Badge
			>
		</div>
		<Button variant="ghost" size="sm" type="button">
			<RotateCcw class="size-4" />
			恢复默认
		</Button>
	</div>
</header>

<main
	class="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:py-8"
>
	<div class="flex min-w-0 flex-col gap-6">
		<!-- 谱号 -->
		<Card.Root>
			<Card.Header>
				<Card.Title class="flex items-center gap-2">
					<Music2 class="size-4 text-muted-foreground" />
					谱号
				</Card.Title>
				<Card.Description
					>选择题目使用哪种谱表，决定视奏时的读谱方式。</Card.Description
				>
			</Card.Header>
			<Card.Content>
				<fieldset>
					<legend class="sr-only">谱号</legend>
					<ToggleGroup
						type="single"
						bind:value={clef}
						variant="outline"
						spacing={3}
						class="grid w-full grid-cols-1 gap-3 sm:grid-cols-3"
					>
						<ToggleGroupItem
							value="treble"
							class="h-auto flex-col items-start gap-2 px-4 py-4 text-left data-[state=on]:border-primary! data-[state=on]:bg-primary/5! data-[state=on]:shadow-sm"
						>
							{@render staffIcon('treble')}
							<span class="text-sm font-medium">高音谱号</span>
							<span class="text-xs font-normal text-muted-foreground"
								>右手 · 中高音区</span
							>
						</ToggleGroupItem>
						<ToggleGroupItem
							value="bass"
							class="h-auto flex-col items-start gap-2 px-4 py-4 text-left data-[state=on]:border-primary! data-[state=on]:bg-primary/5! data-[state=on]:shadow-sm"
						>
							{@render staffIcon('bass')}
							<span class="text-sm font-medium">低音谱号</span>
							<span class="text-xs font-normal text-muted-foreground"
								>左手 · 中低音区</span
							>
						</ToggleGroupItem>
						<ToggleGroupItem
							value="grand"
							class="h-auto flex-col items-start gap-2 px-4 py-4 text-left data-[state=on]:border-primary! data-[state=on]:bg-primary/5! data-[state=on]:shadow-sm"
						>
							{@render staffIcon('grand')}
							<span class="text-sm font-medium">大谱表</span>
							<span class="text-xs font-normal text-muted-foreground"
								>双手 · 两行谱表</span
							>
						</ToggleGroupItem>
					</ToggleGroup>
				</fieldset>
				<p class="mt-3 text-xs text-muted-foreground">
					提示：大谱表同时显示高音与低音两行谱表，适合进阶练习。
				</p>
			</Card.Content>
		</Card.Root>

		<!-- 调号 -->
		<Card.Root>
			<Card.Header>
				<Card.Title class="flex items-center gap-2">
					<Shuffle class="size-4 text-muted-foreground" />
					调号
				</Card.Title>
				<Card.Description
					>选择练习使用的调性，可多选，练习时随机抽取。</Card.Description
				>
			</Card.Header>
			<Card.Content class="flex flex-col gap-4">
				<fieldset>
					<legend class="mb-2 text-sm font-medium">调式</legend>
					<ToggleGroup
						type="single"
						bind:value={keyType}
						variant="outline"
						spacing={2}
					>
						<ToggleGroupItem value="major">大调</ToggleGroupItem>
						<ToggleGroupItem value="minor">小调</ToggleGroupItem>
						<ToggleGroupItem value="both">两者皆可</ToggleGroupItem>
					</ToggleGroup>
				</fieldset>

				<fieldset>
					<legend class="mb-2 text-sm font-medium">调号</legend>
					<ToggleGroup
						type="multiple"
						bind:value={keys}
						variant="outline"
						spacing={2}
						class="flex w-full flex-wrap gap-2"
					>
						{#each keyOptions as option (option.id)}
							<ToggleGroupItem
								value={option.id}
								size="sm"
								class="h-9 min-w-12 rounded-full px-3.5 data-[state=on]:border-primary! data-[state=on]:bg-primary! data-[state=on]:text-primary-foreground!"
							>
								{option.label}
							</ToggleGroupItem>
						{/each}
					</ToggleGroup>
					{#if keys.length === 0}
						<p class="mt-2 text-xs text-destructive">请至少选择一个调号。</p>
					{:else}
						<p class="mt-2 text-xs text-muted-foreground">
							已选 {keys.length} 个调，练习时随机抽取。
						</p>
					{/if}
				</fieldset>

				<div class="flex items-center justify-between gap-4">
					<div class="space-y-0.5">
						<label for="accidentals" class="text-sm font-medium"
							>包含临时变音记号</label
						>
						<p id="accidentals-desc" class="text-xs text-muted-foreground">
							谱面中会出现调号之外的升降、还原记号
						</p>
					</div>
					<Switch
						id="accidentals"
						aria-describedby="accidentals-desc"
						bind:checked={includeAccidentals}
					/>
				</div>
			</Card.Content>
		</Card.Root>

		<!-- 音域 -->
		<Card.Root>
			<Card.Header>
				<Card.Title class="flex items-center gap-2">
					<Piano class="size-4 text-muted-foreground" />
					音域
				</Card.Title>
				<Card.Description
					>设定题目中可能出现的最低音与最高音。</Card.Description
				>
			</Card.Header>
			<Card.Content>
				<div class="rounded-xl border bg-muted/40 p-3">
					<div class="mb-2 flex items-center justify-between">
						<span class="text-xs font-medium text-muted-foreground"
							>音域预览（C2 – C6）</span
						>
						<span
							class="flex items-center gap-1.5 text-xs text-muted-foreground"
						>
							<span class="inline-block size-2 rounded-full bg-primary"></span>
							练习范围内
						</span>
					</div>
					<div
						class="relative h-28 select-none"
						role="img"
						aria-label="钢琴键盘示意图，当前练习音域为 {noteName(
							range[0]
						)} 到 {noteName(range[1])}"
					>
						{#each whiteKeys as midi, index (midi)}
							<div
								class="absolute top-0 flex h-full items-end justify-center rounded-b-[4px] border border-input pb-1.5 text-[10px] transition-colors {inRange(
									midi
								)
									? 'bg-card shadow-[inset_0_-5px_0_0_var(--primary)]'
									: 'bg-muted/60'}"
								style="left: {(index * 100) /
									whiteKeys.length}%; width: {whiteWidth}%"
							>
								{#if midi % 12 === 0}
									<span
										class={midi === 60
											? 'font-semibold text-foreground'
											: 'text-muted-foreground'}
									>
										{noteName(midi)}
									</span>
								{/if}
							</div>
						{/each}
						{#each blackKeys as key (key.midi)}
							<div
								class="absolute top-0 z-10 h-[58%] rounded-b-[3px] border border-zinc-700 transition-colors {inRange(
									key.midi
								)
									? 'bg-zinc-950 shadow-[inset_0_-5px_0_0_var(--primary)]'
									: 'bg-zinc-700/70'}"
								style="left: {key.left}%; width: {blackWidth}%"
							></div>
						{/each}
					</div>
				</div>

				<div class="mt-4 flex items-center justify-between gap-4">
					<div class="text-sm">
						<span class="text-muted-foreground">最低音</span>
						<span class="ml-1.5 font-semibold tabular-nums"
							>{noteName(range[0])}</span
						>
					</div>
					<div class="text-sm">
						<span class="text-muted-foreground">最高音</span>
						<span class="ml-1.5 font-semibold tabular-nums"
							>{noteName(range[1])}</span
						>
					</div>
				</div>
				<Slider
					type="multiple"
					min={KB_MIN}
					max={KB_MAX}
					step={1}
					bind:value={range}
					aria-label="练习音域范围"
					class="mt-3"
				/>
				<div
					class="mt-1 flex justify-between text-[11px] tabular-nums text-muted-foreground"
				>
					<span>{noteName(KB_MIN)}</span>
					<span>{noteName(KB_MAX)}</span>
				</div>

				<div class="mt-3 flex flex-wrap items-center gap-2">
					<span class="text-xs font-medium text-muted-foreground"
						>快捷预设</span
					>
					{#each rangePresets as preset (preset.id)}
						<Button
							type="button"
							variant="outline"
							size="sm"
							onclick={() => applyPreset(preset.value)}
							class="rounded-full {range[0] === preset.value[0] &&
							range[1] === preset.value[1]
								? 'border-primary bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground'
								: ''}"
						>
							{preset.label}
						</Button>
					{/each}
				</div>
			</Card.Content>
		</Card.Root>

		<!-- 音符与节奏 -->
		<Card.Root>
			<Card.Header>
				<Card.Title class="flex items-center gap-2">
					<Layers class="size-4 text-muted-foreground" />
					音符与节奏
				</Card.Title>
				<Card.Description>控制题目的节奏密度与织体复杂度。</Card.Description>
			</Card.Header>
			<Card.Content class="flex flex-col gap-4">
				<fieldset>
					<legend class="mb-2 text-sm font-medium">
						出现的音符时值（可多选）
					</legend>
					<ToggleGroup
						type="multiple"
						bind:value={durations}
						variant="outline"
						spacing={2}
						class="flex w-full flex-wrap gap-2"
					>
						{#each durationOptions as option (option.id)}
							<ToggleGroupItem
								value={option.id}
								size="sm"
								class="h-9 rounded-full px-3.5 data-[state=on]:border-primary! data-[state=on]:bg-primary! data-[state=on]:text-primary-foreground!"
							>
								{option.label}
							</ToggleGroupItem>
						{/each}
					</ToggleGroup>
				</fieldset>

				<fieldset>
					<legend class="mb-2 text-sm font-medium">织体</legend>
					<ToggleGroup
						type="single"
						bind:value={texture}
						variant="outline"
						spacing={2}
					>
						<ToggleGroupItem value="single">单音旋律</ToggleGroupItem>
						<ToggleGroupItem value="dyad">双音（音程）</ToggleGroupItem>
						<ToggleGroupItem value="chord">三和弦</ToggleGroupItem>
					</ToggleGroup>
				</fieldset>

				<Separator />

				<div class="flex items-center justify-between gap-4">
					<div class="space-y-0.5">
						<label for="rests" class="text-sm font-medium">包含休止符</label>
						<p id="rests-desc" class="text-xs text-muted-foreground">
							题目中会出现休止，需要数准拍子
						</p>
					</div>
					<Switch
						id="rests"
						aria-describedby="rests-desc"
						bind:checked={includeRests}
					/>
				</div>

				<div class="flex items-center justify-between gap-4">
					<div class="space-y-0.5">
						<label for="dots" class="text-sm font-medium"
							>包含附点与连音线</label
						>
						<p id="dots-desc" class="text-xs text-muted-foreground">
							出现附点节奏与跨小节延音
						</p>
					</div>
					<Switch
						id="dots"
						aria-describedby="dots-desc"
						bind:checked={includeDots}
					/>
				</div>
			</Card.Content>
		</Card.Root>

		<!-- 练习设置 -->
		<Card.Root>
			<Card.Header>
				<Card.Title class="flex items-center gap-2">
					<SlidersHorizontal class="size-4 text-muted-foreground" />
					练习设置
				</Card.Title>
				<Card.Description>设置单题规模、题量与时间限制。</Card.Description>
			</Card.Header>
			<Card.Content class="flex flex-col gap-5">
				<div>
					<div class="mb-2 flex items-baseline justify-between">
						<span class="text-sm font-medium">每题音符数</span>
						<span class="text-sm font-semibold tabular-nums"
							>{notesPerExercise}
							个</span
						>
					</div>
					<Slider
						type="single"
						min={4}
						max={32}
						step={4}
						bind:value={notesPerExercise}
						aria-label="每题音符数"
					/>
					<div
						class="mt-1 flex justify-between text-[11px] tabular-nums text-muted-foreground"
					>
						<span>4</span><span>32</span>
					</div>
				</div>

				<fieldset>
					<legend class="mb-2 text-sm font-medium">每次练习题数</legend>
					<ToggleGroup
						type="single"
						bind:value={exerciseCount}
						variant="outline"
						spacing={2}
					>
						{#each ['10', '20', '30', '0'] as count (count)}
							<ToggleGroupItem value={count}
								>{countLabels[count]}</ToggleGroupItem
							>
						{/each}
					</ToggleGroup>
				</fieldset>

				<Separator />

				<div class="flex items-center justify-between gap-4">
					<div class="space-y-0.5">
						<label
							for="timed"
							class="flex items-center gap-1.5 text-sm font-medium"
						>
							<Timer class="size-3.5 text-muted-foreground" />
							每题限时
						</label>
						<p id="timed-desc" class="text-xs text-muted-foreground">
							倒计时结束自动进入下一题
						</p>
					</div>
					<Switch
						id="timed"
						aria-describedby="timed-desc"
						bind:checked={timed}
					/>
				</div>

				<div class={timed ? '' : 'pointer-events-none opacity-50'}>
					<div class="mb-2 flex items-baseline justify-between">
						<span class="text-sm font-medium">每题时间</span>
						<span class="text-sm font-semibold tabular-nums"
							>{secondsPerExercise}
							秒</span
						>
					</div>
					<Slider
						type="single"
						min={3}
						max={20}
						step={1}
						disabled={!timed}
						bind:value={secondsPerExercise}
						aria-label="每题时间（秒）"
					/>
					<div
						class="mt-1 flex justify-between text-[11px] tabular-nums text-muted-foreground"
					>
						<span>3 秒</span><span>20 秒</span>
					</div>
				</div>
			</Card.Content>
		</Card.Root>
	</div>

	<!-- 配置摘要 -->
	<aside class="lg:sticky lg:top-20 lg:self-start">
		<Card.Root>
			<Card.Header class="pb-3">
				<div class="flex items-center justify-between gap-2">
					<Card.Title>配置摘要</Card.Title>
					<Badge variant="secondary">{difficulty}</Badge>
				</div>
				<Card.Description>开始前确认当前设置</Card.Description>
			</Card.Header>
			<Card.Content>
				<div class="flex flex-col">
					{@render summaryRow('谱号', clefLabels[clef])}
					{@render summaryRow('调号', summaryKeyType)}
					{@render summaryRow(
						'音域',
						`${noteName(range[0])} – ${noteName(range[1])}`
					)}
					{@render summaryRow('时值', summaryDurations)}
					{@render summaryRow('织体', textureLabels[texture])}
					{@render summaryRow('每题', `${notesPerExercise} 个音符`)}
					{@render summaryRow('题数', countLabels[exerciseCount])}
					{@render summaryRow(
						'限时',
						timed ? `${secondsPerExercise} 秒 / 题` : '不限时'
					)}
				</div>

				<Separator class="my-4" />

				<Button type="button" size="lg" class="w-full">
					<Play class="size-4" />
					开始练习
				</Button>
				<Button type="button" variant="outline" size="sm" class="mt-2 w-full">
					<RotateCcw class="size-3.5" />
					恢复默认设置
				</Button>
				<p class="mt-3 text-center text-xs text-muted-foreground">
					原型阶段：按钮与开关暂未接入实际练习逻辑。
				</p>
			</Card.Content>
		</Card.Root>
	</aside>
</main>

<footer class="border-t">
	<div
		class="mx-auto max-w-6xl px-4 py-4 text-xs text-muted-foreground sm:px-6"
	>
		钢琴视奏练习器 · 前端原型 · 配置页
	</div>
</footer>
