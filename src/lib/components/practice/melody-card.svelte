<script lang="ts">
import { AudioWaveform } from '@lucide/svelte';
import * as Card from '#lib/components/ui/card/index.js';
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
	intervalOptions,
	SEVENTH_CHORD_TYPES,
	seventhTypeOptions,
	triadTypeOptions
} from '#lib/practice/options.js';

let { config }: { config: PracticeConfig } = $props();

// bits-ui 单选组再次点击会把值清空成 ''，这里直接驳回，模式必选
function changeMode(value: string) {
	if (value === 'random' || value === 'interval' || value === 'chord') {
		config.melody.mode = value as MelodyMode;
	}
}

function changeIntervals(value: string[]) {
	config.melody.intervals = value.map(Number);
}

function changeChordSource(value: string) {
	if (value === 'diatonic' || value === 'custom') {
		config.melody.chord.source = value as ChordSource;
		// 顺阶只有三和弦，第三转位无意义，自动移除
		if (value === 'diatonic') {
			config.melody.chord.inversions = config.melody.chord.inversions.filter(
				(i) => i !== 3
			);
		}
	}
}

// 三和弦 / 七和弦两组开关共用 types 数组：改一组时保留另一组的已选项
function changeChordTypes(group: ChordTypeId[], value: string[]) {
	const picked = new Set(value);
	const kept = config.melody.chord.types.filter((id) => !group.includes(id));
	config.melody.chord.types = [
		...kept,
		...value.map((id) => id as ChordTypeId)
	];
	// 只剩三和弦时第三转位无意义，自动移除
	if (!config.melody.chord.types.some((id) => SEVENTH_CHORD_TYPES.has(id))) {
		config.melody.chord.inversions = config.melody.chord.inversions.filter(
			(i) => i !== 3
		);
	}
}

function changeInversions(value: string[]) {
	config.melody.chord.inversions = value.map(Number) as ChordInversion[];
}

function changeDirection(value: string) {
	if (value === 'up' || value === 'down') {
		config.melody.chord.direction = value as ChordDirection;
	}
}

// 所选最大音程在任何一个已选调里都放不下时提示（生成端此时保持同音）
const rangeTooNarrow = $derived.by(() => {
	if (
		config.melody.mode !== 'interval' ||
		config.melody.intervals.length === 0 ||
		config.keys.length === 0
	) {
		return false;
	}
	const steps = Math.max(...config.melody.intervals) - 1;
	// 池内下标差 steps 仍留在池内：至少要有 steps + 1 个调内音
	return config.keys.every(
		(key) => diatonicPool(config.range, key).length <= steps
	);
});

// 自定义来源下已选七和弦类型：第三转位只对七和弦开放（顺阶只有三和弦）
const hasSeventhType = $derived(
	config.melody.chord.source === 'custom' &&
		config.melody.chord.types.some((id) => SEVENTH_CHORD_TYPES.has(id))
);

// 所选和弦在任何一个已选调里都放不下时提示（顺阶看各级三和弦，自定义看所选类型）
const chordRangeTooNarrow = $derived.by(() => {
	if (
		config.melody.mode !== 'chord' ||
		config.melody.chord.inversions.length === 0 ||
		config.keys.length === 0
	) {
		return false;
	}
	if (config.melody.chord.source === 'diatonic') {
		return config.keys.every(
			(key) =>
				diatonicChordOptions(config.range, key, config.melody.chord.inversions)
					.length === 0
		);
	}
	if (config.melody.chord.types.length === 0) {
		return false;
	}
	return config.keys.every((key) =>
		config.melody.chord.types.every((type) => {
			const structure = CHORD_STRUCTURES[type];
			const usable = config.melody.chord.inversions.filter(
				(i) => i < structure.length
			);
			const inversions = usable.length > 0 ? usable : [0];
			return inversions.every(
				(inversion) => !chordFitsPool(config.range, key, type, inversion)
			);
		})
	);
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
		<fieldset>
			<legend class="mb-2 text-sm font-medium">{m.melodyModeLegend()}</legend>
			<ToggleGroup
				type="single"
				value={config.melody.mode}
				onValueChange={changeMode}
				variant="outline"
				spacing={2}
				class="flex w-full flex-wrap gap-2"
			>
				<ToggleGroupItem
					value="random"
					size="sm"
					class="h-9 rounded-full px-3.5 data-[state=on]:border-primary! data-[state=on]:bg-primary! data-[state=on]:text-primary-foreground!"
				>
					{m.melodyModeRandomNotes()}
				</ToggleGroupItem>
				<ToggleGroupItem
					value="interval"
					size="sm"
					class="h-9 rounded-full px-3.5 data-[state=on]:border-primary! data-[state=on]:bg-primary! data-[state=on]:text-primary-foreground!"
				>
					{m.melodyModeInterval()}
				</ToggleGroupItem>
				<ToggleGroupItem
					value="chord"
					size="sm"
					class="h-9 rounded-full px-3.5 data-[state=on]:border-primary! data-[state=on]:bg-primary! data-[state=on]:text-primary-foreground!"
				>
					{m.melodyModeChord()}
				</ToggleGroupItem>
			</ToggleGroup>
		</fieldset>

		{#if config.melody.mode === 'interval'}
			<fieldset>
				<legend class="mb-2 text-sm font-medium">
					{m.melodyIntervalsLegend()}
				</legend>
				<ToggleGroup
					type="multiple"
					value={config.melody.intervals.map(String)}
					onValueChange={changeIntervals}
					variant="outline"
					spacing={2}
					class="flex w-full flex-wrap gap-2"
				>
					{#each intervalOptions as option (option.id)}
						<ToggleGroupItem
							value={String(option.id)}
							size="sm"
							class="h-9 rounded-full px-3.5 data-[state=on]:border-primary! data-[state=on]:bg-primary! data-[state=on]:text-primary-foreground!"
						>
							{option.label()}
						</ToggleGroupItem>
					{/each}
				</ToggleGroup>
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
			<fieldset>
				<legend class="mb-2 text-sm font-medium">
					{m.chordSourceLegend()}
				</legend>
				<ToggleGroup
					type="single"
					value={config.melody.chord.source}
					onValueChange={changeChordSource}
					variant="outline"
					spacing={2}
					class="flex w-full flex-wrap gap-2"
				>
					{#each chordSourceOptions as option (option.id)}
						<ToggleGroupItem
							value={option.id}
							size="sm"
							class="h-9 rounded-full px-3.5 data-[state=on]:border-primary! data-[state=on]:bg-primary! data-[state=on]:text-primary-foreground!"
						>
							{option.label()}
						</ToggleGroupItem>
					{/each}
				</ToggleGroup>
			</fieldset>
			{#if config.melody.chord.source === 'custom'}
				<fieldset>
					<legend class="mb-2 text-sm font-medium">
						{m.chordTriadsLegend()}
					</legend>
					<ToggleGroup
						type="multiple"
						value={config.melody.chord.types.filter((id) =>
							triadTypeOptions.some((option) => option.id === id)
						)}
						onValueChange={(value) =>
							changeChordTypes(
								triadTypeOptions.map((option) => option.id),
								value
							)}
						variant="outline"
						spacing={2}
						class="flex w-full flex-wrap gap-2"
					>
						{#each triadTypeOptions as option (option.id)}
							<ToggleGroupItem
								value={option.id}
								size="sm"
								class="h-9 rounded-full px-3.5 data-[state=on]:border-primary! data-[state=on]:bg-primary! data-[state=on]:text-primary-foreground!"
							>
								{option.label()}
							</ToggleGroupItem>
						{/each}
					</ToggleGroup>
				</fieldset>
				<fieldset>
					<legend class="mb-2 text-sm font-medium">
						{m.chordSeventhsLegend()}
					</legend>
					<ToggleGroup
						type="multiple"
						value={config.melody.chord.types.filter((id) =>
							SEVENTH_CHORD_TYPES.has(id)
						)}
						onValueChange={(value) =>
							changeChordTypes(
								seventhTypeOptions.map((option) => option.id),
								value
							)}
						variant="outline"
						spacing={2}
						class="flex w-full flex-wrap gap-2"
					>
						{#each seventhTypeOptions as option (option.id)}
							<ToggleGroupItem
								value={option.id}
								size="sm"
								class="h-9 rounded-full px-3.5 data-[state=on]:border-primary! data-[state=on]:bg-primary! data-[state=on]:text-primary-foreground!"
							>
								{option.label()}
							</ToggleGroupItem>
						{/each}
					</ToggleGroup>
					{#if config.melody.chord.types.length === 0}
						<p class="mt-2 text-xs text-destructive">
							{m.melodyChordTypesRequired()}
						</p>
					{/if}
				</fieldset>
			{:else}
				<p class="text-xs text-muted-foreground">
					{m.melodyChordDiatonicHint()}
				</p>
			{/if}
			<fieldset>
				<legend class="mb-2 text-sm font-medium">
					{m.chordInversionsLegend()}
				</legend>
				<ToggleGroup
					type="multiple"
					value={config.melody.chord.inversions.map(String)}
					onValueChange={changeInversions}
					variant="outline"
					spacing={2}
					class="flex w-full flex-wrap gap-2"
				>
					{#each chordInversionOptions as option (option.id)}
						<ToggleGroupItem
							value={String(option.id)}
							size="sm"
							disabled={option.seventhOnly && !hasSeventhType}
							class="h-9 rounded-full px-3.5 data-[state=on]:border-primary! data-[state=on]:bg-primary! data-[state=on]:text-primary-foreground!"
						>
							{option.label()}
						</ToggleGroupItem>
					{/each}
				</ToggleGroup>
				{#if config.melody.chord.inversions.length === 0}
					<p class="mt-2 text-xs text-destructive">
						{m.melodyChordInversionsRequired()}
					</p>
				{/if}
			</fieldset>
			<fieldset>
				<legend class="mb-2 text-sm font-medium">
					{m.chordDirectionLegend()}
				</legend>
				<ToggleGroup
					type="single"
					value={config.melody.chord.direction}
					onValueChange={changeDirection}
					variant="outline"
					spacing={2}
					class="flex w-full flex-wrap gap-2"
				>
					{#each chordDirectionOptions as option (option.id)}
						<ToggleGroupItem
							value={option.id}
							size="sm"
							class="h-9 rounded-full px-3.5 data-[state=on]:border-primary! data-[state=on]:bg-primary! data-[state=on]:text-primary-foreground!"
						>
							{option.label()}
						</ToggleGroupItem>
					{/each}
				</ToggleGroup>
			</fieldset>
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
