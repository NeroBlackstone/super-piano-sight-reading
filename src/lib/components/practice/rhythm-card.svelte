<script lang="ts">
import { Layers } from '@lucide/svelte';
import ProbabilitySetting from '#lib/components/practice/probability-setting.svelte';
import * as Card from '#lib/components/ui/card/index.js';
import { Separator } from '#lib/components/ui/separator/index.js';
import { Slider } from '#lib/components/ui/slider/index.js';
import {
	ToggleGroup,
	ToggleGroupItem
} from '#lib/components/ui/toggle-group/index.js';
import * as Tooltip from '#lib/components/ui/tooltip/index.js';
import { m } from '#lib/paraglide/messages.js';
import {
	type PracticeConfig,
	TEMPO_MAX,
	TEMPO_MIN
} from '#lib/practice/config.js';
import {
	beatUnitFor,
	durationOptions,
	tempoLabel,
	timeSignatureOptions
} from '#lib/practice/options.js';

let { config }: { config: PracticeConfig } = $props();

const beatUnit = $derived(beatUnitFor(config.timeSignature));
</script>

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
				bind:value={config.timeSignature}
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
					>{tempoLabel(config.tempo)}
					·
					<span class="font-semibold tabular-nums text-foreground"
						>{beatUnit.glyph}
						= {config.tempo} BPM</span
					></span
				>
			</div>
			<Slider
				type="single"
				min={TEMPO_MIN}
				max={TEMPO_MAX}
				step={1}
				bind:value={config.tempo}
				aria-label={m.tempoAria({ glyph: beatUnit.glyph })}
			/>
			<div
				class="mt-1 flex justify-between text-[11px] tabular-nums text-muted-foreground"
			>
				<span>40</span><span>{m.tempoBeatUnit({ name: beatUnit.name() })}</span
				><span>208</span>
			</div>
		</fieldset>

		<fieldset>
			<legend class="mb-2 text-sm font-medium">{m.durationsLegend()}</legend>
			<ToggleGroup
				type="multiple"
				bind:value={config.durations}
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
			{#if config.durations.length === 0}
				<p class="mt-2 text-xs text-destructive">{m.durationsRequired()}</p>
			{:else}
				<p class="mt-2 text-xs text-muted-foreground">
					{m.durationsSelected({ count: config.durations.length })}
				</p>
			{/if}
		</fieldset>

		<Separator />

		<ProbabilitySetting
			id="rests"
			label={m.rhythmRestsLabel()}
			description={m.rhythmRestsDesc()}
			probabilityLabel={m.rhythmRestsProbability()}
			probabilityDescription={m.rhythmRestsProbabilityDesc()}
			ariaLabel={m.rhythmRestsAria()}
			feature={config.rests}
		/>

		<ProbabilitySetting
			id="dots"
			label={m.rhythmDotsLabel()}
			description={m.rhythmDotsDesc()}
			probabilityLabel={m.rhythmDotsProbability()}
			probabilityDescription={m.rhythmDotsProbabilityDesc()}
			ariaLabel={m.rhythmDotsAria()}
			feature={config.dots}
		/>

		<ProbabilitySetting
			id="triplets"
			label={m.rhythmTripletsLabel()}
			description={m.rhythmTripletsDesc()}
			probabilityLabel={m.rhythmTripletsProbability()}
			probabilityDescription={m.rhythmTripletsProbabilityDesc()}
			ariaLabel={m.rhythmTripletsAria()}
			feature={config.triplets}
		/>
	</Card.Content>
</Card.Root>
