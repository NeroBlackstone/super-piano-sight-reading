<script lang="ts">
import { ClefBass, ClefTreble, EighthNote } from '@lucide/svelte';
import * as Card from '#lib/components/ui/card/index.js';
import {
	ToggleGroup,
	ToggleGroupItem
} from '#lib/components/ui/toggle-group/index.js';
import { m } from '#lib/paraglide/messages.js';
import type { PracticeConfig } from '#lib/practice/config.js';

let { config }: { config: PracticeConfig } = $props();
</script>

<Card.Root>
	<Card.Header>
		<Card.Title class="flex items-center gap-2">
			<EighthNote class="size-4 text-muted-foreground" />
			{m.clefTitle()}
		</Card.Title>
		<Card.Description>{m.clefDescription()}</Card.Description>
	</Card.Header>
	<Card.Content>
		<fieldset>
			<legend class="sr-only">{m.clefTitle()}</legend>
			<ToggleGroup
				type="single"
				bind:value={config.clef}
				variant="outline"
				spacing={3}
				class="grid w-full grid-cols-1 gap-3 sm:grid-cols-2"
			>
				<ToggleGroupItem
					value="treble"
					class="h-auto items-center gap-3 px-4 py-3 text-left data-[state=on]:border-primary! data-[state=on]:bg-primary/5! data-[state=on]:shadow-sm"
				>
					<ClefTreble class="size-8 shrink-0 text-primary" />
					<span class="flex flex-col gap-0.5">
						<span class="text-sm font-medium">{m.clefTreble()}</span>
						<span class="text-xs font-normal text-muted-foreground"
							>{m.clefTrebleHint()}</span
						>
					</span>
				</ToggleGroupItem>
				<ToggleGroupItem
					value="bass"
					class="h-auto items-center gap-3 px-4 py-3 text-left data-[state=on]:border-primary! data-[state=on]:bg-primary/5! data-[state=on]:shadow-sm"
				>
					<ClefBass class="size-8 shrink-0 text-primary" />
					<span class="flex flex-col gap-0.5">
						<span class="text-sm font-medium">{m.clefBass()}</span>
						<span class="text-xs font-normal text-muted-foreground"
							>{m.clefBassHint()}</span
						>
					</span>
				</ToggleGroupItem>
			</ToggleGroup>
		</fieldset>
	</Card.Content>
</Card.Root>
