<script lang="ts">
import { AudioWaveform } from '@lucide/svelte';
import * as Card from '#lib/components/ui/card/index.js';
import {
	ToggleGroup,
	ToggleGroupItem
} from '#lib/components/ui/toggle-group/index.js';
import { m } from '#lib/paraglide/messages.js';
import type { MelodyMode, PracticeConfig } from '#lib/practice/config.js';
import { diatonicPool } from '#lib/practice/exercise/index.js';
import { intervalOptions } from '#lib/practice/options.js';

let { config }: { config: PracticeConfig } = $props();

// bits-ui 单选组再次点击会把值清空成 ''，这里直接驳回，模式必选
function changeMode(value: string) {
	if (value === 'random' || value === 'interval') {
		config.melody.mode = value as MelodyMode;
	}
}

function changeIntervals(value: string[]) {
	config.melody.intervals = value.map(Number);
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
		{/if}
	</Card.Content>
</Card.Root>
