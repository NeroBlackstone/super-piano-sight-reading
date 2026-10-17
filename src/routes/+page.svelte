<script lang="ts">
import {
	ClefBass,
	ClefTreble,
	Languages,
	Layers,
	Music2,
	Piano,
	Play,
	RotateCcw,
	Shuffle,
	SlidersHorizontal
} from '@lucide/svelte';
import { Badge } from '#lib/components/ui/badge/index.js';
import { Button } from '#lib/components/ui/button/index.js';
import * as Card from '#lib/components/ui/card/index.js';
import * as DropdownMenu from '#lib/components/ui/dropdown-menu/index.js';
import { Separator } from '#lib/components/ui/separator/index.js';
import { Slider } from '#lib/components/ui/slider/index.js';
import { Switch } from '#lib/components/ui/switch/index.js';
import {
	ToggleGroup,
	ToggleGroupItem
} from '#lib/components/ui/toggle-group/index.js';
import * as Tooltip from '#lib/components/ui/tooltip/index.js';
import { m } from '#lib/paraglide/messages.js';
import { getLocale, locales, setLocale } from '#lib/paraglide/runtime.js';

// —— 原型：仅用于展示交互状态，未接入任何练习逻辑 ——
let clef = $state('treble');
let keys = $state<string[]>(['C']);
let range = $state<number[]>([48, 72]);
let durations = $state<string[]>(['quarter']);
let timeSignature = $state('4/4');
let tempo = $state(72);
let includeRests = $state(true);
let restProbability = $state(0.15);
let includeAccidentals = $state(false);
let accidentalProbability = $state(0.1);
let includeDots = $state(false);
let dotsProbability = $state(0.15);
let includeTriplets = $state(false);
let tripletProbability = $state(0.1);
let measuresPerExercise = $state(16);

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

const LOCALE_NAMES: Record<string, string> = { en: 'English', zh: '中文' };

const clefLabels: Record<string, () => string> = {
	treble: () => m.clefTreble(),
	bass: () => m.clefBass()
};
const keyOptions = [
	{ id: 'C', label: 'C', hint: () => m.keysHintsC() },
	{ id: 'G', label: 'G', hint: () => m.keysHintsG() },
	{ id: 'D', label: 'D', hint: () => m.keysHintsD() },
	{ id: 'A', label: 'A', hint: () => m.keysHintsA() },
	{ id: 'E', label: 'E', hint: () => m.keysHintsE() },
	{ id: 'B', label: 'B', hint: () => m.keysHintsB() },
	{ id: 'F#', label: 'F♯', hint: () => m.keysHintsFSharp() },
	{ id: 'C#', label: 'C♯', hint: () => m.keysHintsCSharp() },
	{ id: 'F', label: 'F', hint: () => m.keysHintsF() },
	{ id: 'Bb', label: 'B♭', hint: () => m.keysHintsBb() },
	{ id: 'Eb', label: 'E♭', hint: () => m.keysHintsEb() },
	{ id: 'Ab', label: 'A♭', hint: () => m.keysHintsAb() }
];
const keyLabels: Record<string, string> = Object.fromEntries(
	keyOptions.map((option) => [option.id, option.label])
);
const durationOptions = [
	{ id: 'whole', label: () => m.durationsWhole() },
	{ id: 'half', label: () => m.durationsHalf() },
	{ id: 'quarter', label: () => m.durationsQuarter() },
	{ id: 'eighth', label: () => m.durationsEighth() },
	{ id: 'sixteenth', label: () => m.durationsSixteenth() }
];
const durationLabels: Record<string, () => string> = Object.fromEntries(
	durationOptions.map((option) => [option.id, option.label])
);
const timeSignatureOptions = [
	{ id: '4/4', label: '4/4', hint: () => m.timeSigHint44() },
	{ id: '3/4', label: '3/4', hint: () => m.timeSigHint34() },
	{ id: '2/4', label: '2/4', hint: () => m.timeSigHint24() },
	{ id: '6/8', label: '6/8', hint: () => m.timeSigHint68() }
];
const timeSignatureLabels: Record<string, string> = Object.fromEntries(
	timeSignatureOptions.map((option) => [option.id, option.label])
);
// 钢琴键盘示意：A0 – C8（88 键完整音域）
const KB_MIN = 21;
const KB_MAX = 108;
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
	{ id: 'near', label: () => m.rangePresetNear(), value: [60, 72] },
	{ id: 'basic', label: () => m.rangePresetBasic(), value: [48, 72] },
	{ id: 'wide', label: () => m.rangePresetWide(), value: [36, 84] },
	{ id: 'full', label: () => m.rangePresetFull(), value: [21, 108] }
];
const applyPreset = (value: number[]) => {
	range = [...value];
};

// 拍号的分母决定默认时值单位：/4 拍默认四分，/8 拍默认八分
const defaultUnitByDenominator: Record<string, string> = {
	'4': 'quarter',
	'8': 'eighth'
};

// BPM 的一拍单位跟随拍号分母：/4 拍以四分音符为一拍（♩），/8 拍以八分音符为一拍（♪）
const beatUnitMeta: Record<string, { glyph: string; name: () => string }> = {
	quarter: { glyph: '♩', name: () => m.beatUnitQuarter() },
	eighth: { glyph: '♪', name: () => m.beatUnitEighth() }
};
// 一拍单位对应的分母（与 timeSignature 初始值 4/4 的分母一致）
let beatDen = $state('4');
const beatUnit = $derived(
	beatUnitMeta[defaultUnitByDenominator[beatDen] ?? 'quarter'] ??
		beatUnitMeta.quarter
);

// BPM 对应的常见速度术语
const TEMPO_MARKS = [
	{ max: 60, label: () => m.tempoLargo() },
	{ max: 66, label: () => m.tempoAdagio() },
	{ max: 76, label: () => m.tempoAndante() },
	{ max: 108, label: () => m.tempoModerato() },
	{ max: 120, label: () => m.tempoAllegro() },
	{ max: 168, label: () => m.tempoPresto() }
];
const tempoLabel = (bpm: number) =>
	TEMPO_MARKS.find((mark) => bpm < mark.max)?.label() ?? m.tempoPrestissimo();

const difficulty = $derived.by(() => {
	let score = 0;
	const width = range[1] - range[0];
	if (width > 60) score += 2;
	else if (width > 36) score += 1;
	if (durations.includes('eighth') || durations.includes('sixteenth'))
		score += 1;
	if (keys.length >= 6) score += 1;
	if (score <= 1) return m.difficultyBeginner();
	if (score <= 3) return m.difficultyIntermediate();
	return m.difficultyChallenge();
});

const summaryKeys = $derived(
	keys.length > 0
		? keys.map((id) => keyLabels[id]).join(m.listJoiner())
		: m.keysNone()
);
const summaryDurations = $derived(
	durations.length > 0
		? durations.map((id) => durationLabels[id]?.() ?? id).join(m.listJoiner())
		: m.durationsNone()
);
const summaryAccidentals = $derived(
	includeAccidentals
		? m.summaryAccidentalsOn({
				percent: Math.round(accidentalProbability * 100)
			})
		: m.summaryAccidentalsOff()
);
</script>

<svelte:head>
	<title>{m.pageTitle()}</title>
</svelte:head>

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
				>{m.headerTitle()}</span
			>
			<Badge variant="outline" class="hidden sm:inline-flex"
				>{m.headerBadge()}</Badge
			>
		</div>
		<DropdownMenu.Root>
			<DropdownMenu.Trigger>
				{#snippet child({
					props
				})}
					<Button {...props} variant="ghost" size="sm" type="button">
						<Languages class="size-4" />
						{LOCALE_NAMES[getLocale()]}
					</Button>
				{/snippet}
			</DropdownMenu.Trigger>
			<DropdownMenu.Content align="end">
				{#each locales as locale (locale)}
					<DropdownMenu.Item onSelect={() => setLocale(locale)}>
						{LOCALE_NAMES[locale]}
					</DropdownMenu.Item>
				{/each}
			</DropdownMenu.Content>
		</DropdownMenu.Root>
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
					{m.clefTitle()}
				</Card.Title>
				<Card.Description>{m.clefDescription()}</Card.Description>
			</Card.Header>
			<Card.Content>
				<fieldset>
					<legend class="sr-only">{m.clefTitle()}</legend>
					<ToggleGroup
						type="single"
						bind:value={clef}
						variant="outline"
						spacing={3}
						class="grid w-full grid-cols-1 gap-3 sm:grid-cols-2"
					>
						<ToggleGroupItem
							value="treble"
							class="h-auto items-center gap-3 px-4 py-3 text-left data-[state=on]:border-primary! data-[state=on]:bg-primary/5! data-[state=on]:shadow-sm"
						>
							<ClefTreble class="size-8 shrink-0 text-primary" />
							<span class="flex flex-col gap-0.5">
								<span class="text-sm font-medium">{m.clefTreble()}</span>
								<span class="text-xs font-normal text-muted-foreground"
									>{m.clefTrebleHint()}</span
								>
							</span>
						</ToggleGroupItem>
						<ToggleGroupItem
							value="bass"
							class="h-auto items-center gap-3 px-4 py-3 text-left data-[state=on]:border-primary! data-[state=on]:bg-primary/5! data-[state=on]:shadow-sm"
						>
							<ClefBass class="size-8 shrink-0 text-primary" />
							<span class="flex flex-col gap-0.5">
								<span class="text-sm font-medium">{m.clefBass()}</span>
								<span class="text-xs font-normal text-muted-foreground"
									>{m.clefBassHint()}</span
								>
							</span>
						</ToggleGroupItem>
					</ToggleGroup>
				</fieldset>
			</Card.Content>
		</Card.Root>

		<!-- 调号 -->
		<Card.Root>
			<Card.Header>
				<Card.Title class="flex items-center gap-2">
					<Shuffle class="size-4 text-muted-foreground" />
					{m.keysTitle()}
				</Card.Title>
				<Card.Description>{m.keysDescription()}</Card.Description>
			</Card.Header>
			<Card.Content class="flex flex-col gap-4">
				<fieldset>
					<legend class="mb-2 text-sm font-medium">{m.keysTitle()}</legend>
					<ToggleGroup
						type="multiple"
						bind:value={keys}
						variant="outline"
						spacing={2}
						class="flex w-full flex-wrap gap-2"
					>
						{#each keyOptions as option (option.id)}
							<Tooltip.Root>
								<Tooltip.Trigger
									>{#snippet child({
										props
									})}
										<ToggleGroupItem
											{...props}
											value={option.id}
											size="sm"
											class="h-9 min-w-12 rounded-full px-3.5 data-[state=on]:border-primary! data-[state=on]:bg-primary! data-[state=on]:text-primary-foreground!"
										>
											{option.label}
										</ToggleGroupItem>
									{/snippet}</Tooltip.Trigger
								>
								<Tooltip.Content>
									{m.keysTooltip({ key: option.label, hint: option.hint() })}
								</Tooltip.Content>
							</Tooltip.Root>
						{/each}
					</ToggleGroup>
					{#if keys.length === 0}
						<p class="mt-2 text-xs text-destructive">{m.keysRequired()}</p>
					{:else}
						<p class="mt-2 text-xs text-muted-foreground">
							{m.keysSelected({ count: keys.length })}
						</p>
					{/if}
				</fieldset>

				<div class="flex items-center justify-between gap-4">
					<div class="space-y-0.5">
						<label for="accidentals" class="text-sm font-medium"
							>{m.accidentalsLabel()}</label
						>
						<p id="accidentals-desc" class="text-xs text-muted-foreground">
							{m.accidentalsDesc()}
						</p>
					</div>
					<Switch
						id="accidentals"
						aria-describedby="accidentals-desc"
						bind:checked={includeAccidentals}
					/>
				</div>
				{#if includeAccidentals}
					<div class="mt-4 space-y-2">
						<div class="flex items-center justify-between">
							<span class="text-sm font-medium"
								>{m.accidentalsProbability()}</span
							>
							<span class="text-sm tabular-nums text-muted-foreground"
								>{Math.round(accidentalProbability * 100)}%</span
							>
						</div>
						<Slider
							type="single"
							min={0}
							max={1}
							step={0.05}
							bind:value={accidentalProbability}
							aria-label={m.accidentalsAria()}
						/>
						<p class="text-xs text-muted-foreground">
							{m.accidentalsProbabilityDesc()}
						</p>
					</div>
				{/if}
			</Card.Content>
		</Card.Root>

		<!-- 音域 -->
		<Card.Root>
			<Card.Header>
				<Card.Title class="flex items-center gap-2">
					<Piano class="size-4 text-muted-foreground" />
					{m.rangeTitle()}
				</Card.Title>
				<Card.Description>{m.rangeDescription()}</Card.Description>
			</Card.Header>
			<Card.Content>
				<div class="rounded-xl border bg-muted/40 p-3">
					<div class="mb-2 flex items-center justify-between">
						<span class="text-xs font-medium text-muted-foreground"
							>{m.rangePreview({
								min: noteName(KB_MIN),
								max: noteName(KB_MAX)
							})}</span
						>
						<span
							class="flex items-center gap-1.5 text-xs text-muted-foreground"
						>
							<span class="inline-block size-2 rounded-full bg-primary"></span>
							{m.rangeInRange()}
						</span>
					</div>
					<div
						class="relative h-28 select-none"
						role="img"
						aria-label={m.rangeKeyboardAria({
							from: noteName(range[0]),
							to: noteName(range[1])
						})}
					>
						{#each whiteKeys as midi, index (midi)}
							<div
								class="absolute top-0 flex h-full items-end justify-center overflow-hidden rounded-b-lg border border-input pb-1.5 text-[9px] transition-colors {inRange(
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
						<span class="text-muted-foreground">{m.rangeLowest()}</span>
						<span class="ml-1.5 font-semibold tabular-nums"
							>{noteName(range[0])}</span
						>
					</div>
					<div class="text-sm">
						<span class="text-muted-foreground">{m.rangeHighest()}</span>
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
					aria-label={m.rangeAria()}
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
						>{m.rangePresets()}</span
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
							{preset.label()}
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
					{m.rhythmTitle()}
				</Card.Title>
				<Card.Description>{m.rhythmDescription()}</Card.Description>
			</Card.Header>
			<Card.Content class="flex flex-col gap-4">
				<fieldset>
					<legend class="mb-2 text-sm font-medium">{m.timeSigLegend()}</legend>
					<ToggleGroup
						type="single"
						bind:value={timeSignature}
						onValueChange={(next) => {
							if (!next) return;
							// 切换拍号时，按分母重置默认时值（/4 拍 → 四分，/8 拍 → 八分）
							const nextDen = next.split('/')[1];
							const unit = defaultUnitByDenominator[nextDen];
							if (unit) durations = [unit];
							// 一拍单位随分母变化时等比换算 BPM，保持绝对速度不变
							const factor = Number(beatDen) / Number(nextDen);
							if (factor !== 1) {
								tempo = Math.min(208, Math.max(40, Math.round(tempo * factor)));
							}
							beatDen = nextDen;
						}}
						variant="outline"
						spacing={2}
						class="flex w-full flex-wrap gap-2"
					>
						{#each timeSignatureOptions as option (option.id)}
							<Tooltip.Root>
								<Tooltip.Trigger
									>{#snippet child({
										props
									})}
										<ToggleGroupItem
											{...props}
											value={option.id}
											size="sm"
											class="h-9 min-w-12 rounded-full px-3.5 tabular-nums data-[state=on]:border-primary! data-[state=on]:bg-primary! data-[state=on]:text-primary-foreground!"
										>
											{option.label}
										</ToggleGroupItem>
									{/snippet}</Tooltip.Trigger
								>
								<Tooltip.Content>{option.hint()}</Tooltip.Content>
							</Tooltip.Root>
						{/each}
					</ToggleGroup>
				</fieldset>

				<fieldset>
					<div class="mb-2 flex items-baseline justify-between">
						<legend class="text-sm font-medium">{m.tempoLegend()}</legend>
						<span class="text-sm text-muted-foreground"
							>{tempoLabel(tempo)}
							·
							<span class="font-semibold tabular-nums text-foreground"
								>{beatUnit.glyph}
								= {tempo} BPM</span
							></span
						>
					</div>
					<Slider
						type="single"
						min={40}
						max={208}
						step={1}
						bind:value={tempo}
						aria-label={m.tempoAria({ glyph: beatUnit.glyph })}
					/>
					<div
						class="mt-1 flex justify-between text-[11px] tabular-nums text-muted-foreground"
					>
						<span>40</span
						><span>{m.tempoBeatUnit({ name: beatUnit.name() })}</span
						><span>208</span>
					</div>
				</fieldset>

				<fieldset>
					<legend class="mb-2 text-sm font-medium">
						{m.durationsLegend()}
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
								{option.label()}
							</ToggleGroupItem>
						{/each}
					</ToggleGroup>
					{#if durations.length === 0}
						<p class="mt-2 text-xs text-destructive">{m.durationsRequired()}</p>
					{:else}
						<p class="mt-2 text-xs text-muted-foreground">
							{m.durationsSelected({ count: durations.length })}
						</p>
					{/if}
				</fieldset>

				<Separator />

				<div class="space-y-3">
					<div class="flex items-center justify-between gap-4">
						<div class="space-y-0.5">
							<label for="rests" class="text-sm font-medium"
								>{m.rhythmRestsLabel()}</label
							>
							<p id="rests-desc" class="text-xs text-muted-foreground">
								{m.rhythmRestsDesc()}
							</p>
						</div>
						<Switch
							id="rests"
							aria-describedby="rests-desc"
							bind:checked={includeRests}
						/>
					</div>
					{#if includeRests}
						<div class="space-y-2">
							<div class="flex items-center justify-between">
								<span class="text-sm font-medium"
									>{m.rhythmRestsProbability()}</span
								>
								<span class="text-sm tabular-nums text-muted-foreground"
									>{Math.round(restProbability * 100)}%</span
								>
							</div>
							<Slider
								type="single"
								min={0}
								max={1}
								step={0.05}
								bind:value={restProbability}
								aria-label={m.rhythmRestsAria()}
							/>
							<p class="text-xs text-muted-foreground">
								{m.rhythmRestsProbabilityDesc()}
							</p>
						</div>
					{/if}
				</div>

				<div class="space-y-3">
					<div class="flex items-center justify-between gap-4">
						<div class="space-y-0.5">
							<label for="dots" class="text-sm font-medium"
								>{m.rhythmDotsLabel()}</label
							>
							<p id="dots-desc" class="text-xs text-muted-foreground">
								{m.rhythmDotsDesc()}
							</p>
						</div>
						<Switch
							id="dots"
							aria-describedby="dots-desc"
							bind:checked={includeDots}
						/>
					</div>
					{#if includeDots}
						<div class="space-y-2">
							<div class="flex items-center justify-between">
								<span class="text-sm font-medium"
									>{m.rhythmDotsProbability()}</span
								>
								<span class="text-sm tabular-nums text-muted-foreground"
									>{Math.round(dotsProbability * 100)}%</span
								>
							</div>
							<Slider
								type="single"
								min={0}
								max={1}
								step={0.05}
								bind:value={dotsProbability}
								aria-label={m.rhythmDotsAria()}
							/>
							<p class="text-xs text-muted-foreground">
								{m.rhythmDotsProbabilityDesc()}
							</p>
						</div>
					{/if}
				</div>

				<div class="space-y-3">
					<div class="flex items-center justify-between gap-4">
						<div class="space-y-0.5">
							<label for="triplets" class="text-sm font-medium"
								>{m.rhythmTripletsLabel()}</label
							>
							<p id="triplets-desc" class="text-xs text-muted-foreground">
								{m.rhythmTripletsDesc()}
							</p>
						</div>
						<Switch
							id="triplets"
							aria-describedby="triplets-desc"
							bind:checked={includeTriplets}
						/>
					</div>
					{#if includeTriplets}
						<div class="space-y-2">
							<div class="flex items-center justify-between">
								<span class="text-sm font-medium"
									>{m.rhythmTripletsProbability()}</span
								>
								<span class="text-sm tabular-nums text-muted-foreground"
									>{Math.round(tripletProbability * 100)}%</span
								>
							</div>
							<Slider
								type="single"
								min={0}
								max={1}
								step={0.05}
								bind:value={tripletProbability}
								aria-label={m.rhythmTripletsAria()}
							/>
							<p class="text-xs text-muted-foreground">
								{m.rhythmTripletsProbabilityDesc()}
							</p>
						</div>
					{/if}
				</div>
			</Card.Content>
		</Card.Root>

		<!-- 练习设置 -->
		<Card.Root>
			<Card.Header>
				<Card.Title class="flex items-center gap-2">
					<SlidersHorizontal class="size-4 text-muted-foreground" />
					{m.practiceTitle()}
				</Card.Title>
				<Card.Description>{m.practiceDescription()}</Card.Description>
			</Card.Header>
			<Card.Content class="flex flex-col gap-5">
				<div>
					<div class="mb-2 flex items-baseline justify-between">
						<span class="text-sm font-medium">{m.practiceMeasuresLabel()}</span>
						<span class="text-sm font-semibold tabular-nums"
							>{m.practiceMeasures({ count: measuresPerExercise })}</span
						>
					</div>
					<Slider
						type="single"
						min={4}
						max={32}
						step={4}
						bind:value={measuresPerExercise}
						aria-label={m.practiceMeasuresLabel()}
					/>
					<div
						class="mt-1 flex justify-between text-[11px] tabular-nums text-muted-foreground"
					>
						<span>4</span><span>32</span>
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
					<Card.Title>{m.summaryTitle()}</Card.Title>
					<Badge variant="secondary">{difficulty}</Badge>
				</div>
				<Card.Description>{m.summaryCheckBeforeStart()}</Card.Description>
			</Card.Header>
			<Card.Content>
				<div class="flex flex-col">
					{@render summaryRow(m.summaryClef(), clefLabels[clef]?.() ?? '')}
					{@render summaryRow(m.summaryKeys(), summaryKeys)}
					{@render summaryRow(
						m.summaryRange(),
						`${noteName(range[0])} – ${noteName(range[1])}`
					)}
					{@render summaryRow(
						m.summaryTimeSig(),
						timeSignatureLabels[timeSignature]
					)}
					{@render summaryRow(
						m.summaryTempo(),
						`${tempoLabel(tempo)} · ${beatUnit.glyph} = ${tempo} BPM`
					)}
					{@render summaryRow(m.summaryDurations(), summaryDurations)}
					{@render summaryRow(m.summaryAccidentals(), summaryAccidentals)}
					{@render summaryRow(
						m.summaryPerExercise(),
						m.practiceMeasures({ count: measuresPerExercise })
					)}
				</div>

				<Separator class="my-4" />

				<Button
					type="button"
					size="lg"
					class="w-full"
					disabled={keys.length === 0 || durations.length === 0}
				>
					<Play class="size-4" />
					{m.summaryStart()}
				</Button>
				<Button type="button" variant="outline" size="sm" class="mt-2 w-full">
					<RotateCcw class="size-3.5" />
					{m.summaryReset()}
				</Button>
				<p class="mt-3 text-center text-xs text-muted-foreground">
					{m.summaryFootnote()}
				</p>
			</Card.Content>
		</Card.Root>
	</aside>
</main>

<footer class="border-t">
	<div
		class="mx-auto max-w-6xl px-4 py-4 text-xs text-muted-foreground sm:px-6"
	>
		{m.footerText()}
	</div>
</footer>
