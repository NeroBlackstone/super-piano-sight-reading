<script lang="ts">
import { Languages, Piano } from '@lucide/svelte';
import { Badge } from '#lib/components/ui/badge/index.js';
import { Button } from '#lib/components/ui/button/index.js';
import * as DropdownMenu from '#lib/components/ui/dropdown-menu/index.js';
import { m } from '#lib/paraglide/messages.js';
import { getLocale, locales, setLocale } from '#lib/paraglide/runtime.js';
import { LOCALE_NAMES } from '#lib/practice/options.js';
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
		<DropdownMenu.Root>
			<DropdownMenu.Trigger>
				{#snippet child({
					props
				})}
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
</header>
