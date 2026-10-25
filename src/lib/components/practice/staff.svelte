<script lang="ts">
import { onMount } from 'svelte';
import type { EasyScore, Factory, StemmableNote, Voice } from 'vexflow';
import type { TimeSignature } from '#lib/practice/config.js';
import {
	applyDurationSplitRule,
	applyTwoLevelRule,
	type Exercise,
	eventCost,
	type NoteEvent,
	snapToGrid,
	UNITS
} from '#lib/practice/exercise/index.js';

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
	import('vexflow').then(async (module) => {
		// VexFlow 5 的符头是文字字形，符干的 X 坐标来自 canvas measureText 量出的字形宽度。
		// 字体尚未就绪时量到的是回退字体的宽度，符干就会脱离符头；模块加载完并不等于字体加载完。
		await document.fonts.ready;
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
	const height = rows.length * ROW_HEIGHT + 20;

	const renderer = new vf.Renderer(container, vf.Renderer.Backends.SVG);
	renderer.resize(width, height);

	// 高层 API：Factory 负责创建元素并统一 format / draw；容器没有固定 id，
	// 所以不走 elementId 建渲染器，而是注入我们自己的 Renderer 上下文。
	const factory = new vf.Factory({
		renderer: { elementId: null, width, height }
	});
	factory.setContext(renderer.getContext());
	const score = factory.EasyScore({ throwOnError: true });
	score.set({
		clef: exercise.clef,
		time: exercise.timeSignature,
		stem: 'auto'
	});

	rows.forEach((rowMeasures, rowIndex) => {
		const y = rowIndex * ROW_HEIGHT + 20;
		const staveWidth = (width - STAVE_MARGIN * 2) / rowMeasures.length;

		rowMeasures.forEach((measure, i) => {
			// 每个小节一个 System：宽度固定，小节内的排布由 System 自行完成，
			// 首小节的谱号 / 调号 / 拍号占宽不会挤歪后面的音符。
			const system = factory.System({
				x: STAVE_MARGIN + i * staveWidth,
				y,
				width: staveWidth
			});

			const voice = buildVoice(factory, score, measure, exercise);
			// 临时记号交给 VexFlow 决定：对照调号 + 小节内上下文，该画的画、重复的删
			vf.Accidental.applyAccidentals([voice], exercise.key);

			const stave = system.addStave({
				voices: [voice],
				options: { leftBar: true }
			});
			// 每行行首重复谱号与调号（标准记谱法）；拍号只在全曲开头
			if (i === 0) {
				stave.addClef(exercise.clef);
				stave.addKeySignature(exercise.key);
				if (rowIndex === 0) {
					stave.addTimeSignature(exercise.timeSignature);
				}
			}
			// 全曲最后一小节画终止线
			const isLast =
				rowIndex === rows.length - 1 && i === rowMeasures.length - 1;
			stave.setEndBarType(isLast ? vf.BarlineType.END : vf.BarlineType.SINGLE);
		});
	});

	factory.draw();
}

/** 一个小节转成 EasyScore 源码串：真实音高 + 时值 + 休止 / 附点 */
function toEasyScoreLine(measure: NoteEvent[]): string {
	return measure
		.map((event) => {
			// vexKey 形如 'c#/4'，EasyScore 要求 'c#4'；
			// 升降号是否显示不由字符串决定，统一交给 applyAccidentals
			const key = event.vexKey.replace('/', '');
			const duration = DURATION_CODES[event.duration];
			const rest = event.midi === null ? '/r' : '';
			const dots = event.dots ? '.' : '';
			return `${key}/${duration}${rest}${dots}`;
		})
		.join(', ');
}

function buildVoice(
	factory: Factory,
	score: EasyScore,
	measure: NoteEvent[],
	exercise: Exercise
): Voice {
	// 记谱层变换（不改演奏内容）：先按时值拆分规则把不在拍点上的长音拆开，
	// 再由两等级规则断开跨必标拍点的音符（其切点都落在拍点上，不会破坏前一步）
	const events = applyTwoLevelRule(
		applyDurationSplitRule(measure, exercise.timeSignature),
		exercise.timeSignature
	);
	const notes = score.notes(toEasyScoreLine(events));

	// 生成器保证三连音是连续 3 个同质事件；
	// 用 triplet 的起始边沿定位组首（前一个事件非三连音，或已在小节开头）
	for (let j = 0; j < events.length; j++) {
		const startsTriplet =
			events[j].triplet && (j === 0 || !events[j - 1].triplet);
		if (startsTriplet) {
			score.tuplet(notes.slice(j, j + 3), {
				numNotes: 3,
				notesOccupied: 2
			});
		}
	}

	const beatUnits = beatUnitsFor(exercise.timeSignature);
	for (const run of beamRuns(events, notes, beatUnits)) {
		score.beam(run);
	}

	// 拆分产生的连音线：tieToNext 的相邻两音成对画线（经 Factory 进入 renderQ 统一绘制）
	for (let j = 0; j + 1 < events.length; j++) {
		if (events[j].tieToNext) {
			factory.StaveTie({ from: notes[j], to: notes[j + 1] });
		}
	}

	return score.voice(notes);
}

/**
 * 手动符杠分组：把同一拍内连续的八分 / 十六分音符（非休止、非附点）连成一组；
 * 休止符、附点音符、跨拍处、三连音与非三连音之间都断开。
 * EasyScore 的 beam() 不懂拍界规则，分组判断必须自己做。
 */
function beamRuns(
	measure: NoteEvent[],
	notes: StemmableNote[],
	beatUnits: number
): StemmableNote[][] {
	const runs: StemmableNote[][] = [];
	let run: StemmableNote[] = [];
	let runTriplet = false;
	let runStart = 0;
	let start = 0;

	const flush = () => {
		if (run.length > 1) runs.push(run);
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

		if (!beamed || crossesBeat || !sameGroup) flush();

		if (beamed && !crossesBeat) {
			// 起新组时记录组首的拍位与三连音属性；否则上一组（或不可连杠
			// 音符）的旧值会把同拍的后续音符误判成跨拍而反复拆组
			if (run.length === 0) {
				runTriplet = event.triplet;
				runStart = start;
			}
			run.push(notes[i]);
		}
		// 三连音占时的浮点残差吸附回整数网格，否则拍点上的音符会被误判为跨拍
		start = snapToGrid(start + cost);
	}
	flush();
	return runs;
}
</script>

<!-- 容器必须占满宽度：空 div 作为 flex 居中项会收缩为 0，导致 ResizeObserver 永远测不到宽度 -->
<div bind:this={container} class="w-full min-w-0"></div>
