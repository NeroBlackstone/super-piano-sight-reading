<script lang="ts">
import { onMount } from 'svelte';
import type { Beam, StaveNote, StemmableNote, Tuplet } from 'vexflow';
import type { Clef, TimeSignature } from '#lib/practice/config.js';
import {
	type Exercise,
	type NoteEvent,
	UNITS
} from '#lib/practice/exercise.js';

let { exercise }: { exercise: Exercise } = $props();

// vexflow 体积较大且依赖 DOM，仅在浏览器端动态加载
type VexFlowModule = typeof import('vexflow');

let container: HTMLDivElement | undefined = $state();
let vexflow: VexFlowModule | null = $state(null);
let width = $state(0);

onMount(() => {
	const observer = new ResizeObserver((entries) => {
		width = entries[0]?.contentRect.width ?? 0;
	});
	if (container) observer.observe(container);
	import('vexflow').then((module) => {
		vexflow = module;
	});
	return () => observer.disconnect();
});

// 模块加载完成、容器有宽度后才开始绘制；exercise / 宽度变化时重绘
$effect(() => {
	if (!vexflow || !container || width <= 0) return;
	draw(vexflow, container, exercise, width);
});

const DURATION_CODES: Record<string, string> = {
	whole: 'w',
	half: 'h',
	quarter: 'q',
	eighth: '8',
	sixteenth: '16'
};

const STAVE_MARGIN = 12;
/** 每行（谱表系统）占的像素高度 */
const ROW_HEIGHT = 140;

function measuresPerRow(w: number): number {
	if (w < 600) return 2;
	if (w < 900) return 3;
	return 4;
}

function chunk<T>(items: T[], size: number): T[][] {
	const rows: T[][] = [];
	for (let i = 0; i < items.length; i += size) {
		rows.push(items.slice(i, i + size));
	}
	return rows;
}

/** 事件的实际占时（十六分音符单位，含附点 / 三连音修正） */
function eventCost(event: NoteEvent): number {
	const base = UNITS[event.duration];
	if (event.triplet) return (base * 2) / 3;
	if (event.dots) return base * 1.5;
	return base;
}

/** 符杠分组的拍长：/4 拍按四分音符，6/8 按附点四分音符 */
function beatUnitsFor(timeSignature: TimeSignature): number {
	return timeSignature === '6/8' ? 6 : 4;
}

function draw(
	vf: VexFlowModule,
	container: HTMLDivElement,
	exercise: Exercise,
	width: number
) {
	container.innerHTML = '';
	const rows = chunk(exercise.measures, measuresPerRow(width));

	const renderer = new vf.Renderer(container, vf.Renderer.Backends.SVG);
	renderer.resize(width, rows.length * ROW_HEIGHT + 20);
	const context = renderer.getContext();

	const [numBeats, beatValue] = exercise.timeSignature.split('/').map(Number);
	const beatUnits = beatUnitsFor(exercise.timeSignature);

	rows.forEach((rowMeasures, rowIndex) => {
		const y = rowIndex * ROW_HEIGHT + 20;
		const staveWidth = (width - STAVE_MARGIN * 2) / rowMeasures.length;

		const staves = rowMeasures.map((_, i) => {
			const stave = new vf.Stave(STAVE_MARGIN + i * staveWidth, y, staveWidth);
			// 每行行首重复谱号；调号与拍号只在全曲开头
			if (i === 0) {
				stave.addClef(exercise.clef);
				if (rowIndex === 0) {
					stave.addKeySignature(exercise.key);
					stave.addTimeSignature(exercise.timeSignature);
				}
			}
			stave.setEndBarType(vf.BarlineType.SINGLE);
			return stave;
		});
		// 全曲最后一小节画终止线
		if (rowIndex === rows.length - 1) {
			staves[staves.length - 1].setEndBarType(vf.BarlineType.END);
		}

		for (const stave of staves) stave.setContext(context).draw();

		// 逐小节构建音符、三连音与符杠，并各自成为一个 Voice。
		// 必须逐小节 format/draw：整行合成一个 Voice 会把音符均匀铺满整行，
		// 而首小节的谱号 / 调号 / 拍号占掉一段宽度，音符就不落在小节线上了。
		rowMeasures.forEach((measure, i) => {
			const stave = staves[i];
			const measureNotes = measure.map((event) =>
				buildNote(vf, event, exercise.clef)
			);
			// 生成器保证三连音是连续 3 个同质事件
			const tuplets: Tuplet[] = [];
			for (let j = 0; j + 2 < measure.length; j += 3) {
				if (measure[j].triplet) {
					tuplets.push(
						new vf.Tuplet(measureNotes.slice(j, j + 3), {
							numNotes: 3,
							notesOccupied: 2
						})
					);
				}
			}
			const beams = beamMeasure(vf, measure, measureNotes, beatUnits);

			const voice = new vf.Voice({ numBeats, beatValue });
			voice.addTickables(measureNotes);
			// Stave 没有 getNoteWidth，用音符区的起止 X 相减
			const noteWidth = stave.getNoteEndX() - stave.getNoteStartX();
			new vf.Formatter().joinVoices([voice]).format([voice], noteWidth);

			voice.draw(context, stave);
			for (const beam of beams) beam.setContext(context).draw();
			for (const tuplet of tuplets) tuplet.setContext(context).draw();
		});
	});
}

function buildNote(
	vf: VexFlowModule,
	event: NoteEvent,
	clef: Clef
): StemmableNote {
	const note: StaveNote = new vf.StaveNote({
		keys: [event.vexKey],
		duration: DURATION_CODES[event.duration] + (event.midi === null ? 'r' : ''),
		clef,
		autoStem: true
	});
	if (event.dots) vf.Dot.buildAndAttach([note], { all: true });
	if (event.accidental) {
		note.addModifier(new vf.Accidental(event.accidental), 0);
	}
	return note;
}

/**
 * 手动符杠：把同一拍内连续的八分 / 十六分音符（非休止、非附点）连成一组；
 * 休止符、附点音符、跨拍处、三连音与非三连音之间都断开。
 */
function beamMeasure(
	vf: VexFlowModule,
	measure: NoteEvent[],
	notes: StemmableNote[],
	beatUnits: number
): Beam[] {
	const beams: Beam[] = [];
	let run: StemmableNote[] = [];
	let runTriplet = false;
	let runStart = 0;
	let start = 0;

	const flush = () => {
		if (run.length > 1) beams.push(new vf.Beam(run));
		run = [];
	};

	for (let i = 0; i < measure.length; i++) {
		const event = measure[i];
		const cost = eventCost(event);
		const beamed =
			event.midi !== null &&
			!event.dots &&
			UNITS[event.duration] <= UNITS.eighth;
		// 音符跨越拍界（如 4/4 第 3 拍上的八分音符）时自成一组
		const crossesBeat =
			Math.floor(start / beatUnits) !==
			Math.floor((start + cost - 0.01) / beatUnits);
		const sameGroup =
			run.length === 0 ||
			(event.triplet === runTriplet &&
				Math.floor(start / beatUnits) === Math.floor(runStart / beatUnits));

		if (!beamed || crossesBeat || !sameGroup) {
			flush();
			runTriplet = event.triplet;
			runStart = start;
			if (beamed && !crossesBeat) run.push(notes[i]);
		} else {
			run.push(notes[i]);
		}
		start += cost;
	}
	flush();
	return beams;
}
</script>

<!-- 容器必须占满宽度：空 div 作为 flex 居中项会收缩为 0，导致 ResizeObserver 永远测不到宽度 -->
<div bind:this={container} class="w-full min-w-0"></div>
