<script lang="ts">
import { SlidersHorizontal } from '@lucide/svelte';
import * as Card from '#lib/components/ui/card/index.js';
import { Slider } from '#lib/components/ui/slider/index.js';
import { m } from '#lib/paraglide/messages.js';
import {
	MEASURES_MAX,
	MEASURES_MIN,
	MEASURES_STEP,
	type PracticeConfig
} from '#lib/practice/config.js';

let { config }: { config: PracticeConfig } = $props();
</script>

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
					>{m.practiceMeasures({ count: config.measuresPerExercise })}</span
				>
			</div>
			<Slider
				type="single"
				min={MEASURES_MIN}
				max={MEASURES_MAX}
				step={MEASURES_STEP}
				bind:value={config.measuresPerExercise}
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
