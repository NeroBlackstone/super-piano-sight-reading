<script lang="ts">
import { Languages, Piano } from '@lucide/svelte';
import { onMount } from 'svelte';
import { Badge } from '#lib/components/ui/badge/index.js';
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
			<Badge variant="outline" class="hidden sm:inline-flex"
				>{m.headerBadge()}</Badge
			>
		</div>
		<div class="flex shrink-0 items-center gap-2">
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
