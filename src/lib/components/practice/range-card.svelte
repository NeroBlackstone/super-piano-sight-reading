<script lang="ts">
import { Piano } from '@lucide/svelte';
import { Button } from '#lib/components/ui/button/index.js';
import * as Card from '#lib/components/ui/card/index.js';
import { Slider } from '#lib/components/ui/slider/index.js';
import { m } from '#lib/paraglide/messages.js';
import {
	KEYBOARD_MAX,
	KEYBOARD_MIN,
	type PracticeConfig
} from '#lib/practice/config.js';
import { noteName } from '#lib/practice/note.js';
import {
	rangeOctavePresets,
	rangeQuickPresets
} from '#lib/practice/options.js';

let { config }: { config: PracticeConfig } = $props();

// 钢琴键盘示意：A0 – C8（88 键完整音域），边界取自配置常量
const KB_MIN = KEYBOARD_MIN;
const KB_MAX = KEYBOARD_MAX;
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
const inRange = (midi: number) =>
	midi >= config.range[0] && midi <= config.range[1];

// 快捷预设生效：音域恰好等于谱表范围；此时八度按钮全部视为未选
const isQuickActive = (value: number[]) =>
	config.range[0] === value[0] && config.range[1] === value[1];
const quickActive = () =>
	rangeQuickPresets.some((preset) => isQuickActive(preset.value));

const applyQuickPreset = (value: number[]) => {
	config.range = [...value];
};

// 八度被视作选中：无快捷预设生效，且该八度完全落在当前音域内
const isOctaveActive = (value: number[]) =>
	!quickActive() && config.range[0] <= value[0] && config.range[1] >= value[1];

// 八度叠加：未选中则并入（取并集的边界），已选中则移除后由剩余选中八度重新合并；
// 合并出的音域是连续区间，去掉中间八度会补齐空洞，至少保留一个八度
const toggleOctave = (preset: { id: string; value: number[] }) => {
	if (!isOctaveActive(preset.value)) {
		config.range = [
			Math.min(config.range[0], preset.value[0]),
			Math.max(config.range[1], preset.value[1])
		];
		return;
	}
	const rest = rangeOctavePresets.filter(
		(it) => it.id !== preset.id && isOctaveActive(it.value)
	);
	if (rest.length === 0) return;
	config.range = [
		Math.min(...rest.map((it) => it.value[0])),
		Math.max(...rest.map((it) => it.value[1]))
	];
};
</script>

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
				<span class="flex items-center gap-1.5 text-xs text-muted-foreground">
					<span class="inline-block size-2 rounded-full bg-primary"></span>
					{m.rangeInRange()}
				</span>
			</div>
			<div
				class="relative h-28 select-none"
				role="img"
				aria-label={m.rangeKeyboardAria({
					from: noteName(config.range[0]),
					to: noteName(config.range[1])
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
					>{noteName(config.range[0])}</span
				>
			</div>
			<div class="text-sm">
				<span class="text-muted-foreground">{m.rangeHighest()}</span>
				<span class="ml-1.5 font-semibold tabular-nums"
					>{noteName(config.range[1])}</span
				>
			</div>
		</div>
		<Slider
			type="multiple"
			min={KB_MIN}
			max={KB_MAX}
			step={1}
			bind:value={config.range}
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
			{#each rangeOctavePresets as preset (preset.id)}
				<Button
					type="button"
					variant="outline"
					size="sm"
					aria-pressed={isOctaveActive(preset.value)}
					onclick={() => toggleOctave(preset)}
					class="rounded-full {isOctaveActive(preset.value)
						? 'border-primary bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground'
						: ''}"
				>
					{preset.label()}
				</Button>
			{/each}
		</div>

		<div class="mt-3 flex flex-wrap items-center gap-2">
			<span class="text-xs font-medium text-muted-foreground"
				>{m.rangePresets()}</span
			>
			{#each rangeQuickPresets as preset (preset.id)}
				<Button
					type="button"
					variant="outline"
					size="sm"
					aria-pressed={isQuickActive(preset.value)}
					onclick={() => applyQuickPreset(preset.value)}
					class="rounded-full {isQuickActive(preset.value)
						? 'border-primary bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground'
						: ''}"
				>
					{preset.label()}
				</Button>
			{/each}
		</div>
	</Card.Content>
</Card.Root>
