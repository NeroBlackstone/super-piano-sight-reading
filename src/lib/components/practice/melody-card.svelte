<script lang="ts">
import { AudioWaveform } from '@lucide/svelte';
import * as Card from '#lib/components/ui/card/index.js';
import { Checkbox } from '#lib/components/ui/checkbox/index.js';
import {
	ToggleGroup,
	ToggleGroupItem
} from '#lib/components/ui/toggle-group/index.js';
import { m } from '#lib/paraglide/messages.js';
import type {
	ChordDirection,
	ChordInversion,
	ChordSource,
	ChordTypeId,
	DiatonicChordSize,
	MelodyMode,
	PracticeConfig
} from '#lib/practice/config.js';
import {
	CHORD_STRUCTURES,
	chordFitsPool,
	diatonicChordOptions,
	diatonicPool
} from '#lib/practice/exercise/index.js';
import {
	chordDirectionOptions,
	chordInversionOptions,
	chordSourceOptions,
	diatonicSizeOptions,
	intervalOptions,
	SEVENTH_CHORD_TYPES,
	seventhTypeOptions,
	triadTypeOptions
} from '#lib/practice/options.js';

let { config }: { config: PracticeConfig } = $props();

// shadcn 默认选中态 bg-muted 偏淡，选中时改为 primary 实底反色文字
const activeItemClass =
	'data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:hover:bg-primary/90 data-[state=on]:hover:text-primary-foreground';

// bits-ui 单选组再次点击会把值清空成 ''，这里直接驳回，模式必选
function changeMode(value: string) {
	if (value === 'random' || value === 'interval' || value === 'chord') {
		config.melody.mode = value as MelodyMode;
	}
}

function toggleInterval(interval: number, checked: boolean) {
	config.melody.intervals = checked
		? [...config.melody.intervals, interval]
		: config.melody.intervals.filter((i) => i !== interval);
}

function changeChordSource(value: string) {
	if (value === 'diatonic' || value === 'custom') {
		config.melody.chord.source = value as ChordSource;
		pruneThirdInversion();
	}
}

// 顺阶结构勾选框：增删 diatonicSizes 中的结构
function toggleDiatonicSize(size: DiatonicChordSize, checked: boolean) {
	config.melody.chord.diatonicSizes = checked
		? [...config.melody.chord.diatonicSizes, size]
		: config.melody.chord.diatonicSizes.filter((id) => id !== size);
	pruneThirdInversion();
}

// 三和弦 / 七和弦两组勾选框共用 types 数组：单个勾选框增删对应类型
function toggleChordType(type: ChordTypeId, checked: boolean) {
	config.melody.chord.types = checked
		? [...config.melody.chord.types, type]
		: config.melody.chord.types.filter((id) => id !== type);
	pruneThirdInversion();
}

function toggleInversion(inversion: ChordInversion, checked: boolean) {
	config.melody.chord.inversions = checked
		? [...config.melody.chord.inversions, inversion]
		: config.melody.chord.inversions.filter((i) => i !== inversion);
}

function changeDirection(value: string) {
	if (value === 'up' || value === 'down') {
		config.melody.chord.direction = value as ChordDirection;
	}
}

// 所选最大音程在所选调里放不下时提示（生成端此时保持同音）
const rangeTooNarrow = $derived.by(() => {
	if (
		config.melody.mode !== 'interval' ||
		config.melody.intervals.length === 0
	) {
		return false;
	}
	const steps = Math.max(...config.melody.intervals) - 1;
	// 池内下标差 steps 仍留在池内：至少要有 steps + 1 个调内音
	return diatonicPool(config.range, config.key).length <= steps;
});

// 当前来源下是否有七和弦可用（决定第三转位是否有意义）：
// 自定义看所选类型，顺阶看所选结构
const hasSeventhChord = $derived(
	config.melody.chord.source === 'custom'
		? config.melody.chord.types.some((id) => SEVENTH_CHORD_TYPES.has(id))
		: config.melody.chord.diatonicSizes.includes('seventh')
);

// 不含七和弦时第三转位无意义，自动移除
function pruneThirdInversion() {
	if (!hasSeventhChord) {
		config.melody.chord.inversions = config.melody.chord.inversions.filter(
			(i) => i !== 3
		);
	}
}

// 所选和弦在所选调里放不下时提示（顺阶看所选结构的各级和弦，自定义看所选类型）
const chordRangeTooNarrow = $derived.by(() => {
	if (
		config.melody.mode !== 'chord' ||
		config.melody.chord.inversions.length === 0
	) {
		return false;
	}
	if (config.melody.chord.source === 'diatonic') {
		if (config.melody.chord.diatonicSizes.length === 0) {
			return false;
		}
		return (
			diatonicChordOptions(
				config.range,
				config.key,
				config.melody.chord.inversions,
				config.melody.chord.diatonicSizes
			).length === 0
		);
	}
	if (config.melody.chord.types.length === 0) {
		return false;
	}
	return config.melody.chord.types.every((type) => {
		const structure = CHORD_STRUCTURES[type];
		const usable = config.melody.chord.inversions.filter(
			(i) => i < structure.length
		);
		const inversions = usable.length > 0 ? usable : [0];
		return inversions.every(
			(inversion) => !chordFitsPool(config.range, config.key, type, inversion)
		);
	});
});
</script>

<Card.Root>
	<Card.Header>
		<Card.Title class="flex items-center gap-2">
			<AudioWaveform class="size-4 text-muted-foreground" />
			{m.melodyTitle()}
		</Card.Title>
		<Card.Description>{m.melodyDescription()}</Card.Description>
	</Card.Header>
	<Card.Content class="flex flex-col gap-4">
		<div class="flex flex-wrap items-center gap-2">
			<span class="text-sm font-medium">{m.melodyModeLegend()}</span>
			<ToggleGroup
				type="single"
				value={config.melody.mode}
				onValueChange={changeMode}
				variant="outline"
				size="sm"
			>
				<ToggleGroupItem value="random" class={activeItemClass}>
					{m.melodyModeRandomNotes()}
				</ToggleGroupItem>
				<ToggleGroupItem value="interval" class={activeItemClass}>
					{m.melodyModeInterval()}
				</ToggleGroupItem>
				<ToggleGroupItem value="chord" class={activeItemClass}>
					{m.melodyModeChord()}
				</ToggleGroupItem>
			</ToggleGroup>
		</div>

		{#if config.melody.mode === 'interval'}
			<fieldset>
				<legend class="mb-2 text-sm font-medium">
					{m.melodyIntervalsLegend()}
				</legend>
				<div class="flex w-full flex-wrap items-center gap-x-5 gap-y-2">
					{#each intervalOptions as option (option.id)}
						<label
							for="interval-{option.id}"
							class="flex cursor-pointer items-center gap-2 text-sm"
						>
							<Checkbox
								id="interval-{option.id}"
								checked={config.melody.intervals.includes(option.id)}
								onCheckedChange={(checked) =>
									toggleInterval(option.id, checked === true)}
							/>
							{option.label()}
						</label>
					{/each}
				</div>
				{#if config.melody.intervals.length === 0}
					<p class="mt-2 text-xs text-destructive">
						{m.melodyIntervalsRequired()}
					</p>
				{:else}
					<p class="mt-2 text-xs text-muted-foreground">
						{m.melodyIntervalsHint()}
					</p>
				{/if}
				{#if rangeTooNarrow}
					<p class="mt-2 text-xs text-destructive">
						{m.melodyRangeTooNarrow()}
					</p>
				{/if}
				<p class="mt-2 text-xs text-muted-foreground">
					{m.melodyIntervalNoAccidentals()}
				</p>
			</fieldset>
		{:else if config.melody.mode === 'chord'}
			<div class="flex flex-wrap items-center gap-2">
				<span class="text-sm font-medium">{m.chordSourceLegend()}</span>
				<ToggleGroup
					type="single"
					value={config.melody.chord.source}
					onValueChange={changeChordSource}
					variant="outline"
					size="sm"
				>
					{#each chordSourceOptions as option (option.id)}
						<ToggleGroupItem value={option.id} class={activeItemClass}>
							{option.label()}
						</ToggleGroupItem>
					{/each}
				</ToggleGroup>
			</div>
			{#if config.melody.chord.source === 'custom'}
				<fieldset>
					<legend class="mb-2 text-sm font-medium">
						{m.chordTriadsLegend()}
					</legend>
					<div class="flex w-full flex-wrap items-center gap-x-5 gap-y-2">
						{#each triadTypeOptions as option (option.id)}
							<label
								for="chord-type-{option.id}"
								class="flex cursor-pointer items-center gap-2 text-sm"
							>
								<Checkbox
									id="chord-type-{option.id}"
									checked={config.melody.chord.types.includes(option.id)}
									onCheckedChange={(checked) =>
										toggleChordType(option.id, checked === true)}
								/>
								{option.label()}
							</label>
						{/each}
					</div>
				</fieldset>
				<fieldset>
					<legend class="mb-2 text-sm font-medium">
						{m.chordSeventhsLegend()}
					</legend>
					<div class="flex w-full flex-wrap items-center gap-x-5 gap-y-2">
						{#each seventhTypeOptions as option (option.id)}
							<label
								for="chord-type-{option.id}"
								class="flex cursor-pointer items-center gap-2 text-sm"
							>
								<Checkbox
									id="chord-type-{option.id}"
									checked={config.melody.chord.types.includes(option.id)}
									onCheckedChange={(checked) =>
										toggleChordType(option.id, checked === true)}
								/>
								{option.label()}
							</label>
						{/each}
					</div>
					{#if config.melody.chord.types.length === 0}
						<p class="mt-2 text-xs text-destructive">
							{m.melodyChordTypesRequired()}
						</p>
					{/if}
				</fieldset>
			{:else}
				<fieldset>
					<legend class="mb-2 text-sm font-medium">
						{m.chordSizesLegend()}
					</legend>
					<div class="flex w-full flex-wrap items-center gap-x-5 gap-y-2">
						{#each diatonicSizeOptions as option (option.id)}
							<label
								for="diatonic-size-{option.id}"
								class="flex cursor-pointer items-center gap-2 text-sm"
							>
								<Checkbox
									id="diatonic-size-{option.id}"
									checked={config.melody.chord.diatonicSizes.includes(
										option.id
									)}
									onCheckedChange={(checked) =>
										toggleDiatonicSize(option.id, checked === true)}
								/>
								{option.label()}
							</label>
						{/each}
					</div>
					{#if config.melody.chord.diatonicSizes.length === 0}
						<p class="mt-2 text-xs text-destructive">
							{m.melodyChordSizesRequired()}
						</p>
					{:else}
						<p class="mt-2 text-xs text-muted-foreground">
							{m.melodyChordDiatonicHint()}
						</p>
					{/if}
				</fieldset>
			{/if}
			<fieldset>
				<legend class="mb-2 text-sm font-medium">
					{m.chordInversionsLegend()}
				</legend>
				<div class="flex w-full flex-wrap items-center gap-x-5 gap-y-2">
					{#each chordInversionOptions as option (option.id)}
						<label
							for="chord-inversion-{option.id}"
							class="flex items-center gap-2 text-sm{option.seventhOnly &&
							!hasSeventhChord
								? ' cursor-not-allowed opacity-50'
								: ' cursor-pointer'}"
						>
							<Checkbox
								id="chord-inversion-{option.id}"
								checked={config.melody.chord.inversions.includes(option.id)}
								disabled={option.seventhOnly && !hasSeventhChord}
								onCheckedChange={(checked) =>
									toggleInversion(option.id, checked === true)}
							/>
							{option.label()}
						</label>
					{/each}
				</div>
				{#if config.melody.chord.inversions.length === 0}
					<p class="mt-2 text-xs text-destructive">
						{m.melodyChordInversionsRequired()}
					</p>
				{/if}
			</fieldset>
			<div class="flex flex-wrap items-center gap-2">
				<span class="text-sm font-medium">{m.chordDirectionLegend()}</span>
				<ToggleGroup
					type="single"
					value={config.melody.chord.direction}
					onValueChange={changeDirection}
					variant="outline"
					size="sm"
				>
					{#each chordDirectionOptions as option (option.id)}
						<ToggleGroupItem value={option.id} class={activeItemClass}>
							{option.label()}
						</ToggleGroupItem>
					{/each}
				</ToggleGroup>
			</div>
			{#if chordRangeTooNarrow}
				<p class="text-xs text-destructive">
					{m.melodyChordRangeTooNarrow()}
				</p>
			{/if}
			{#if config.melody.chord.source === 'custom'}
				<p class="text-xs text-muted-foreground">{m.melodyChordHint()}</p>
			{/if}
			<p class="text-xs text-muted-foreground">
				{m.melodyChordNoAccidentals()}
			</p>
		{/if}
	</Card.Content>
</Card.Root>
