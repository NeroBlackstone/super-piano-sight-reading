<script lang="ts">
import { Languages, Piano } from '@lucide/svelte';
import { onMount } from 'svelte';
import { Button } from '#lib/components/ui/button/index.js';
import * as DropdownMenu from '#lib/components/ui/dropdown-menu/index.js';
import * as Tooltip from '#lib/components/ui/tooltip/index.js';
import { m } from '#lib/paraglide/messages.js';
import { getLocale, locales, setLocale } from '#lib/paraglide/runtime.js';
import { initMidi, midi } from '#lib/practice/midi.svelte.js';
import { LOCALE_NAMES } from '#lib/practice/options.js';

onMount(() => {
	void initMidi();
});

/** MIDI 状态文字：已连接时优先展示设备名，多台设备时展示数量 */
const midiText = $derived(
	!midi.supported
		? m.midiUnsupported()
		: midi.denied
			? m.midiDenied()
			: midi.connected
				? midi.inputs.length === 1
					? midi.inputs[0]
					: m.midiConnectedCount({ count: midi.inputs.length })
				: m.midiDisconnected()
);
</script>

<header class="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
	<div
		class="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6"
	>
		<div class="flex min-w-0 items-center gap-2.5">
			<span
				class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground"
			>
				<Piano class="size-4.5" />
			</span>
			<span class="truncate text-sm font-semibold tracking-tight"
				>{m.headerTitle()}</span
			>
		</div>
		<div class="flex shrink-0 items-center gap-2">
			<Button
				variant="ghost"
				size="icon-sm"
				type="button"
				href="https://github.com/NeroBlackstone/super-piano-sight-reading"
				target="_blank"
				rel="noopener noreferrer"
				aria-label="GitHub"
			>
				<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
					<path
						d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55v-2.15c-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.76 2.7 1.25 3.35.96.1-.75.4-1.25.72-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .96-.31 3.15 1.18a10.9 10.9 0 0 1 5.74 0c2.18-1.49 3.14-1.18 3.14-1.18.63 1.59.24 2.76.12 3.05.74.81 1.18 1.83 1.18 3.09 0 4.41-2.7 5.38-5.27 5.66.41.36.78 1.06.78 2.14v3.17c0 .3.21.67.8.55A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z"
					/>
				</svg>
			</Button>
			<Tooltip.Root>
				<Tooltip.Trigger>
					{#snippet child({ props })}
						<span
							{...props}
							class="flex max-w-40 items-center gap-1.5 text-xs text-muted-foreground"
						>
							<span
								class="size-1.5 shrink-0 rounded-full transition-colors {midi.connected
									? 'bg-emerald-500'
									: 'bg-muted-foreground/40'}"
							></span>
							<span class="truncate">{midiText}</span>
						</span>
					{/snippet}
				</Tooltip.Trigger>
				<Tooltip.Content>
					{midi.connected ? midi.inputs.join(m.listJoiner()) : midiText}
				</Tooltip.Content>
			</Tooltip.Root>
			<DropdownMenu.Root>
				<DropdownMenu.Trigger>
					{#snippet child({ props })}
						<Button {...props} variant="ghost" size="sm" type="button">
							<Languages class="size-4" />
							{LOCALE_NAMES[getLocale()]}
						</Button>
					{/snippet}
				</DropdownMenu.Trigger>
				<DropdownMenu.Content align="end">
					{#each locales as locale (locale)}
						<DropdownMenu.Item onSelect={() => setLocale(locale)}>
							{LOCALE_NAMES[locale]}
						</DropdownMenu.Item>
					{/each}
				</DropdownMenu.Content>
			</DropdownMenu.Root>
		</div>
	</div>
</header>
