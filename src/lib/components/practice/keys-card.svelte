<script lang="ts">
import { Shuffle } from '@lucide/svelte';
import ProbabilitySetting from '#lib/components/practice/probability-setting.svelte';
import * as Card from '#lib/components/ui/card/index.js';
import {
	ToggleGroup,
	ToggleGroupItem
} from '#lib/components/ui/toggle-group/index.js';
import * as Tooltip from '#lib/components/ui/tooltip/index.js';
import { m } from '#lib/paraglide/messages.js';
import type { PracticeConfig } from '#lib/practice/config.js';
import { keyOptions } from '#lib/practice/options.js';

let { config }: { config: PracticeConfig } = $props();
</script>

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
				bind:value={config.keys}
				variant="outline"
				spacing={2}
				class="flex w-full flex-wrap gap-2"
			>
				{#each keyOptions as option (option.id)}
					<Tooltip.Root>
						<Tooltip.Trigger
							>{#snippet child({ props })}
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
			{#if config.keys.length === 0}
				<p class="mt-2 text-xs text-destructive">{m.keysRequired()}</p>
			{:else}
				<p class="mt-2 text-xs text-muted-foreground">
					{m.keysSelected({ count: config.keys.length })}
				</p>
			{/if}
		</fieldset>

		<div class="mt-1">
			<!-- 音程模式下临时变音记号不生效：置灰并说明，开关值原样保留 -->
			<ProbabilitySetting
				id="accidentals"
				label={m.accidentalsLabel()}
				description={m.accidentalsDesc()}
				probabilityLabel={m.accidentalsProbability()}
				probabilityDescription={m.accidentalsProbabilityDesc()}
				ariaLabel={m.accidentalsAria()}
				feature={config.accidentals}
				disabled={config.melody.mode === 'interval'}
				disabledHint={m.accidentalsUnavailableInIntervalMode()}
			/>
		</div>
	</Card.Content>
</Card.Root>
