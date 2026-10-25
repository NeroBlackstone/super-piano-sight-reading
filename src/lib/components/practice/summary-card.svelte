<script lang="ts">
import { Lightbulb, Play, RotateCcw } from '@lucide/svelte';
import { Button } from '#lib/components/ui/button/index.js';
import * as Card from '#lib/components/ui/card/index.js';
import { Separator } from '#lib/components/ui/separator/index.js';
import { m } from '#lib/paraglide/messages.js';
import type { PracticeConfig } from '#lib/practice/config.js';
import { noteName } from '#lib/practice/note.js';
import {
	beatUnitFor,
	chordDirectionLabels,
	chordInversionLabels,
	chordTypeLabels,
	clefLabels,
	durationLabels,
	intervalLabels,
	keyLabels,
	tempoLabel,
	timeSignatureLabels
} from '#lib/practice/options.js';
import { savePracticeConfig } from '#lib/practice/session.js';
import { goto } from '$app/navigation';

let { config }: { config: PracticeConfig } = $props();

function startPractice() {
	savePracticeConfig(config);
	goto('/practice');
}

const beatUnit = $derived(beatUnitFor(config.timeSignature));

const summaryKeys = $derived(
	config.keys.length > 0
		? config.keys.map((id) => keyLabels[id]).join(m.listJoiner())
		: m.keysNone()
);
const summaryDurations = $derived(
	config.durations.length > 0
		? config.durations
				.map((id) => durationLabels[id]?.() ?? id)
				.join(m.listJoiner())
		: m.durationsNone()
);
const summaryAccidentals = $derived(
	config.accidentals.enabled
		? m.summaryAccidentalsOn({
				percent: Math.round(config.accidentals.probability * 100)
			})
		: m.summaryAccidentalsOff()
);
const summaryMelody = $derived.by(() => {
	if (config.melody.mode === 'interval') {
		return config.melody.intervals.length > 0
			? config.melody.intervals
					.map((id) => intervalLabels[id]?.() ?? String(id))
					.join(m.listJoiner())
			: m.melodyIntervalsNone();
	}
	if (config.melody.mode === 'chord') {
		const chord = config.melody.chord;
		if (chord.types.length === 0 || chord.inversions.length === 0) {
			return m.melodyChordsNone();
		}
		const types = chord.types
			.map((id) => chordTypeLabels[id]?.() ?? id)
			.join(m.listJoiner());
		const inversions = chord.inversions
			.map((id) => chordInversionLabels[id]?.() ?? String(id))
			.join(m.listJoiner());
		return [
			m.melodyModeChord(),
			types,
			inversions,
			chordDirectionLabels[chord.direction]?.() ?? chord.direction
		].join(' · ');
	}
	return m.melodyModeRandom();
});
</script>

{#snippet summaryRow(label: string, value: string)}
	<div class="flex items-start justify-between gap-3 py-1 text-sm">
		<span class="shrink-0 text-muted-foreground">{label}</span>
		<span class="text-right font-medium">{value}</span>
	</div>
{/snippet}

<aside class="lg:sticky lg:top-20 lg:self-start">
	<Card.Root>
		<Card.Header class="pb-3">
			<Card.Title>{m.summaryTitle()}</Card.Title>
			<Card.Description>{m.summaryCheckBeforeStart()}</Card.Description>
		</Card.Header>
		<Card.Content>
			<div class="flex flex-col">
				{@render summaryRow(m.summaryClef(), clefLabels[config.clef]?.() ?? '')}
				{@render summaryRow(m.summaryKeys(), summaryKeys)}
				{@render summaryRow(
					m.summaryRange(),
					`${noteName(config.range[0])} – ${noteName(config.range[1])}`
				)}
				{@render summaryRow(m.summaryMelody(), summaryMelody)}
				{@render summaryRow(
					m.summaryTimeSig(),
					timeSignatureLabels[config.timeSignature]
				)}
				{@render summaryRow(
					m.summaryTempo(),
					`${tempoLabel(config.tempo)} · ${beatUnit.glyph} = ${config.tempo} BPM`
				)}
				{@render summaryRow(m.summaryDurations(), summaryDurations)}
				{@render summaryRow(m.summaryAccidentals(), summaryAccidentals)}
				{@render summaryRow(
					m.summaryPerExercise(),
					m.practiceMeasures({ count: config.measuresPerExercise })
				)}
			</div>

			<Separator class="my-4" />

			<Button
				type="button"
				size="lg"
				class="w-full"
				disabled={config.keys.length === 0 ||
					config.durations.length === 0 ||
					(config.melody.mode === 'interval' &&
						config.melody.intervals.length === 0) ||
					(config.melody.mode === 'chord' &&
						(config.melody.chord.types.length === 0 ||
							config.melody.chord.inversions.length === 0))}
				onclick={startPractice}
			>
				<Play class="size-4" />
				{m.summaryStart()}
			</Button>
			<Button type="button" variant="outline" size="sm" class="mt-2 w-full">
				<RotateCcw class="size-3.5" />
				{m.summaryReset()}
			</Button>
			<p class="mt-3 text-center text-xs text-muted-foreground">
				{m.summaryFootnote()}
			</p>
		</Card.Content>
	</Card.Root>

	<div
		class="mt-3 flex gap-2 rounded-xl border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground"
	>
		<Lightbulb class="mt-0.5 size-3.5 shrink-0" />
		<p>{m.summaryPracticeTip()}</p>
	</div>
</aside>
