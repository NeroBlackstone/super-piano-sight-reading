<script lang="ts">
import { onMount } from 'svelte';
import type {
	EasyScore,
	Factory,
	StaveNote,
	StemmableNote,
	Voice
} from 'vexflow';
import type { KeyId, TimeSignature } from '#lib/practice/config.js';
import {
	applyDurationSplitRule,
	applyRestGroupingRule,
	applyTwoLevelRule,
	type Exercise,
	eventCost,
	KEY_ALTERATIONS,
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
/** 小节的最小宽度（px）：不超过基准事件数的小节就占这么宽 */
const MIN_MEASURE_WIDTH = 300;
/** 小节宽度的基准事件数：8 个音符（含休止符）的小节占最小宽度 */
const BASE_EVENTS = 8;
/** 超出基准的每个事件按此倍数计权：密集小节的拉伸比等比例更宽 */
const EXCESS_WEIGHT = 3;

/**
 * 小节宽度的计权：不超过 BASE_EVENTS 个事件的小节都算基准宽（最小宽度）；
 * 超出的部分每个事件按 EXCESS_WEIGHT 倍计，事件越多的小节拉伸越猛
 * （密集小节的十六分音符字形 / 符杠更占宽，仅按个数等比例分宽不够）。
 */
function measureWeight(eventCount: number): number {
	return eventCount <= BASE_EVENTS
		? BASE_EVENTS
		: BASE_EVENTS + EXCESS_WEIGHT * (eventCount - BASE_EVENTS);
}

/** 小节的期望宽度：计权除以基准事件数，再乘最小宽度 */
function desiredWidth(eventCount: number): number {
	return (MIN_MEASURE_WIDTH * measureWeight(eventCount)) / BASE_EVENTS;
}

/**
 * 按期望宽度把小节贪心分行：一行尽量多装，装不下下一个小节就换行，
 * 不硬凑固定的小节数；每行至少一个小节（期望宽度超过行宽的密集小节独占一行）。
 */
function layoutRows(
	measures: NoteEvent[][],
	available: number
): NoteEvent[][][] {
	const rows: NoteEvent[][][] = [];
	let row: NoteEvent[][] = [];
	let rowWidth = 0;
	for (const measure of measures) {
		const w = desiredWidth(measure.length);
		if (row.length > 0 && rowWidth + w > available) {
			rows.push(row);
			row = [];
			rowWidth = 0;
		}
		row.push(measure);
		rowWidth += w;
	}
	if (row.length > 0) rows.push(row);
	return rows;
}

/** 符杠分组的拍长：/4 拍按四分音符，6/8 按附点四分音符 */
function beatUnitsFor(timeSignature: TimeSignature): number {
	return timeSignature === '6/8' ? 6 : 4;
}

/** vexKey（如 'c#/4'）→ 字母 + 相对本位音级的升降数 + 八度 */
function parseVexKey(vexKey: string): {
	letter: string;
	alteration: number;
	octave: number;
} | null {
	const match = /^([a-g])(#{1,2}|b{1,2})?\/(\d)$/.exec(vexKey);
	if (!match) return null;
	const suffix = match[2] ?? '';
	const alteration =
		suffix === '' ? 0 : suffix.startsWith('#') ? suffix.length : -suffix.length;
	return { letter: match[1], alteration, octave: Number(match[3]) };
}

/** 升降数 → 记号类型（生成器只产出单升 / 单降 / 还原） */
const ACCIDENTAL_TYPES: Record<number, '#' | 'b' | 'n'> = {
	1: '#',
	'-1': 'b',
	0: 'n'
};

/**
 * 跨小节提醒记号：临时变音到小节线即失效，但读谱容易把它延续到下一小节；
 * 同一字母同一八度的音在下一小节首次出现且回到调号状态（变音被取消）时，
 * 强制显示调号状态的记号——字母未被调号升降时即还原记号，否则为回到调号的升 / 降号。
 * 返回逐小节的「事件下标 → 记号类型」，applyAccidentals 只看单个小节，跨小节的提醒在这里算。
 */
function courtesyAccidentals(
	measures: NoteEvent[][],
	key: KeyId
): Map<number, '#' | 'b' | 'n'>[] {
	const courtesy = measures.map(() => new Map<number, '#' | 'b' | 'n'>());
	// 上一小节结束时各 letter+octave 的升降状态；本小节未出现的音不延续提醒
	let carried = new Map<string, number>();

	measures.forEach((measure, measureIndex) => {
		const endState = new Map<string, number>();
		measure.forEach((event, eventIndex) => {
			if (event.midi === null) return;
			const parsed = parseVexKey(event.vexKey);
			if (!parsed) return;
			const id = `${parsed.letter}/${parsed.octave}`;
			if (!endState.has(id)) {
				const keyAlt = KEY_ALTERATIONS[key][parsed.letter] ?? 0;
				const prevAlt = carried.get(id) ?? keyAlt;
				if (parsed.alteration === keyAlt && prevAlt !== keyAlt) {
					courtesy[measureIndex].set(eventIndex, ACCIDENTAL_TYPES[keyAlt]);
				}
			}
			endState.set(id, parsed.alteration);
		});
		carried = endState;
	});
	return courtesy;
}

function draw(
	vf: VexFlowModule,
	container: HTMLDivElement,
	exercise: Exercise,
	width: number
) {
	container.innerHTML = '';
	const notated = exercise.measures.map((measure) =>
		notatedEvents(measure, exercise)
	);
	const courtesy = courtesyAccidentals(notated, exercise.key);
	const available = width - STAVE_MARGIN * 2;
	const rows = layoutRows(notated, available);
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

	let measureIndex = 0;
	rows.forEach((rowEvents, rowIndex) => {
		const y = rowIndex * ROW_HEIGHT + 20;
		// 末行不两端对齐，按期望宽度排（小节独占一行且超宽时收缩到行宽）；
		// 其余行按期望宽度等比放大铺满整行——铺满只会变宽，最小宽度仍有保证
		const desiredSum = rowEvents.reduce(
			(sum, events) => sum + desiredWidth(events.length),
			0
		);
		const scale =
			rowIndex === rows.length - 1
				? Math.min(1, available / desiredSum)
				: available / desiredSum;
		let x = STAVE_MARGIN;

		rowEvents.forEach((events, i) => {
			const staveWidth = desiredWidth(events.length) * scale;
			// 每个小节一个 System：宽度固定，小节内的排布由 System 自行完成，
			// 首小节的谱号 / 调号 / 拍号占宽不会挤歪后面的音符。
			const system = factory.System({
				x,
				y,
				width: staveWidth
			});
			x += staveWidth;

			const voice = buildVoice(factory, score, events, exercise);
			// 临时记号交给 VexFlow 决定：对照调号 + 小节内上下文，该画的画、重复的删
			vf.Accidental.applyAccidentals([voice], exercise.key);
			// 跨小节提醒记号在其后叠加：先加会被 applyAccidentals 当重复记号删掉
			for (const [j, type] of courtesy[measureIndex]) {
				(voice.getTickables()[j] as StaveNote).addModifier(
					new vf.Accidental(type),
					0
				);
			}

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
			const isLast = rowIndex === rows.length - 1 && i === rowEvents.length - 1;
			stave.setEndBarType(isLast ? vf.BarlineType.END : vf.BarlineType.SINGLE);
			measureIndex++;
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

/**
 * 一个小节的记谱层变换（不改演奏内容）：先按时值拆分规则把不在拍点上的一拍及以上音符拆开，
 * 再由两等级规则断开跨必标拍点的音符（其切点都落在拍点上，不会破坏前一步），
 * 最后把连续休止符按拍点重新编组，每个休止符都不跨节拍
 * （休止符从不连线，重组不改动任何音符，不会破坏前两步）。
 * 变换后的事件数即实际渲染的音符（含休止符）个数，小节宽度按它加权。
 */
function notatedEvents(measure: NoteEvent[], exercise: Exercise): NoteEvent[] {
	return applyRestGroupingRule(
		applyTwoLevelRule(
			applyDurationSplitRule(measure, exercise.timeSignature),
			exercise.timeSignature
		),
		exercise.timeSignature
	);
}

function buildVoice(
	factory: Factory,
	score: EasyScore,
	events: NoteEvent[],
	exercise: Exercise
): Voice {
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
		// autoStem 按整组平均音高统一符干方向，符杠整体在音符上方或下方；
		// 缺省时逐音定向，高低音同组会导致符杠横在音符中间
		score.beam(run, { autoStem: true });
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
