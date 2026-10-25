<script lang="ts">
import { Layers } from '@lucide/svelte';
import ProbabilitySetting from '#lib/components/practice/probability-setting.svelte';
import * as Card from '#lib/components/ui/card/index.js';
import { Checkbox } from '#lib/components/ui/checkbox/index.js';
import { Separator } from '#lib/components/ui/separator/index.js';
import { Slider } from '#lib/components/ui/slider/index.js';
import { Switch } from '#lib/components/ui/switch/index.js';
import {
	ToggleGroup,
	ToggleGroupItem
} from '#lib/components/ui/toggle-group/index.js';
import * as Tooltip from '#lib/components/ui/tooltip/index.js';
import { m } from '#lib/paraglide/messages.js';
import {
	type Duration,
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

// shadcn 默认选中态 bg-muted 偏淡，选中时改为 primary 实底反色文字
const activeItemClass =
	'data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:hover:bg-primary/90 data-[state=on]:hover:text-primary-foreground';

const beatUnit = $derived(beatUnitFor(config.timeSignature));

// 已选时值（保持固定顺序），附点勾选框逐一对应
const selectedDurations = $derived(
	durationOptions.filter((option) => config.durations.includes(option.id))
);

function toggleDot(id: Duration, checked: boolean) {
	config.dots.durations = checked
		? [...config.dots.durations, id]
		: config.dots.durations.filter((d) => d !== id);
}

function toggleDuration(id: Duration, checked: boolean) {
	config.durations = checked
		? [...config.durations, id]
		: config.durations.filter((d) => d !== id);
}

// 取消勾选时值（或拍号切换重置时值）时同步移除其附点勾选，保持 dots.durations ⊆ durations
$effect(() => {
	const pruned = config.dots.durations.filter((d) =>
		config.durations.includes(d)
	);
	if (pruned.length !== config.dots.durations.length) {
		config.dots.durations = pruned;
	}
});
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
		<div class="flex flex-wrap items-center gap-2">
			<span class="text-sm font-medium">{m.timeSigLegend()}</span>
			<ToggleGroup
				type="single"
				bind:value={config.timeSignature}
				variant="outline"
				size="sm"
			>
				{#each timeSignatureOptions as option (option.id)}
					<Tooltip.Root>
						<Tooltip.Trigger
							>{#snippet child({ props })}
								<ToggleGroupItem
									{...props}
									value={option.id}
									class="min-w-12 tabular-nums {activeItemClass}"
								>
									{option.label}
								</ToggleGroupItem>
							{/snippet}</Tooltip.Trigger
						>
						<Tooltip.Content>{option.hint()}</Tooltip.Content>
					</Tooltip.Root>
				{/each}
			</ToggleGroup>
		</div>

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
			<div class="flex w-full flex-wrap items-center gap-x-5 gap-y-2">
				{#each durationOptions as option (option.id)}
					<label
						for="duration-{option.id}"
						class="flex cursor-pointer items-center gap-2 text-sm"
					>
						<Checkbox
							id="duration-{option.id}"
							checked={config.durations.includes(option.id)}
							onCheckedChange={(checked) =>
								toggleDuration(option.id, checked === true)}
						/>
						{option.label()}
					</label>
				{/each}
			</div>
			{#if config.durations.length === 0}
				<p class="mt-2 text-xs text-destructive">{m.durationsRequired()}</p>
			{:else}
				<p class="mt-2 text-xs text-muted-foreground">
					{m.durationsSelected({ count: config.durations.length })}
				</p>

				<!-- 附点：打勾的时值才会出现对应的附点版本 -->
				<div class="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
					{#each selectedDurations as option (option.id)}
						<label
							for="dots-{option.id}"
							class="flex cursor-pointer items-center gap-2 text-sm"
						>
							<Checkbox
								id="dots-{option.id}"
								checked={config.dots.durations.includes(option.id)}
								onCheckedChange={(checked) =>
									toggleDot(option.id, checked === true)}
							/>
							{m.durationsDotted({ duration: option.label() })}
						</label>
					{/each}
				</div>
				{#if config.dots.durations.length > 0}
					<div class="mt-3 space-y-2">
						<div class="flex items-center justify-between">
							<span class="text-sm font-medium"
								>{m.rhythmDotsProbability()}</span
							>
							<span class="text-sm tabular-nums text-muted-foreground"
								>{Math.round(config.dots.probability * 100)}%</span
							>
						</div>
						<Slider
							type="single"
							min={0}
							max={1}
							step={0.05}
							bind:value={config.dots.probability}
							aria-label={m.rhythmDotsAria()}
						/>
						<p class="text-xs text-muted-foreground">
							{m.rhythmDotsProbabilityDesc()}
						</p>
					</div>
				{/if}

				<!-- 生成频率自然化：按权重抽取已选时值，避免等比例 -->
				<div class="mt-4 flex items-center justify-between gap-4">
					<div class="space-y-0.5">
						<label for="naturalize-durations" class="text-sm font-medium">
							{m.durationsNaturalizeLabel()}
						</label>
						<p class="text-xs text-muted-foreground">
							{m.durationsNaturalizeDesc()}
						</p>
					</div>
					<Switch
						id="naturalize-durations"
						bind:checked={config.naturalizeDurations}
					/>
				</div>
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
