<script lang="ts">
import { Slider } from '#lib/components/ui/slider/index.js';
import { Switch } from '#lib/components/ui/switch/index.js';
import type { OptionalFeature } from '#lib/practice/config.js';

let {
	id,
	label,
	description,
	probabilityLabel,
	probabilityDescription,
	ariaLabel,
	feature,
	disabled = false,
	disabledHint
}: {
	id: string;
	label: string;
	description: string;
	probabilityLabel: string;
	probabilityDescription: string;
	ariaLabel: string;
	/** 直接持有配置里的 $state 子对象，开关/概率就地修改 */
	feature: OptionalFeature;
	/** 置灰开关与滑杆：开关值原样保留，恢复后即回到先前状态 */
	disabled?: boolean;
	/** 置灰时替换 description 显示的原因说明 */
	disabledHint?: string;
} = $props();
</script>

<div class="space-y-3">
	<div class="flex items-center justify-between gap-4">
		<div class="space-y-0.5">
			<label for={id} class="text-sm font-medium">{label}</label>
			<p id="{id}-desc" class="text-xs text-muted-foreground">
				{#if disabled && disabledHint}
					{disabledHint}
				{:else}
					{description}
				{/if}
			</p>
		</div>
		<Switch
			{id}
			aria-describedby="{id}-desc"
			bind:checked={feature.enabled}
			{disabled}
		/>
	</div>
	{#if feature.enabled}
		<div class="space-y-2">
			<div class="flex items-center justify-between">
				<span class="text-sm font-medium">{probabilityLabel}</span>
				<span class="text-sm tabular-nums text-muted-foreground"
					>{Math.round(feature.probability * 100)}%</span
				>
			</div>
			<Slider
				type="single"
				min={0}
				max={1}
				step={0.05}
				bind:value={feature.probability}
				aria-label={ariaLabel}
				{disabled}
			/>
			<p class="text-xs text-muted-foreground">{probabilityDescription}</p>
		</div>
	{/if}
</div>
