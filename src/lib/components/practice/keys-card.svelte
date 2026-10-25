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
import type { KeyId, PracticeConfig } from '#lib/practice/config.js';
import { keyOptions } from '#lib/practice/options.js';

let { config }: { config: PracticeConfig } = $props();

// shadcn 默认选中态 bg-muted 偏淡，选中时改为 primary 实底反色文字
const activeItemClass =
	'data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:hover:bg-primary/90 data-[state=on]:hover:text-primary-foreground';

// bits-ui 单选组再次点击会把值清空成 ''，这里直接驳回，调号必选
function changeKey(value: string) {
	if (keyOptions.some((option) => option.id === value)) {
		config.key = value as KeyId;
	}
}
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
		<div class="flex flex-wrap items-center gap-2">
			<span class="text-sm font-medium">{m.keysLegend()}</span>
			<ToggleGroup
				type="single"
				value={config.key}
				onValueChange={changeKey}
				variant="outline"
				size="sm"
			>
				{#each keyOptions as option (option.id)}
					<Tooltip.Root>
						<Tooltip.Trigger
							>{#snippet child({ props })}
								<ToggleGroupItem
									{...props}
									value={option.id}
									class="min-w-12 {activeItemClass}"
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
		</div>

		<div class="mt-1">
			<!-- 音程 / 分解和弦模式下临时变音记号不生效：置灰并说明，开关值原样保留 -->
			<ProbabilitySetting
				id="accidentals"
				label={m.accidentalsLabel()}
				description={m.accidentalsDesc()}
				probabilityLabel={m.accidentalsProbability()}
				probabilityDescription={m.accidentalsProbabilityDesc()}
				ariaLabel={m.accidentalsAria()}
				feature={config.accidentals}
				disabled={config.melody.mode !== 'random'}
				disabledHint={m.accidentalsOnlyInRandomMode()}
			/>
		</div>
	</Card.Content>
</Card.Root>
