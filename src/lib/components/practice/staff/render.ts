import type {
	EasyScore,
	Factory,
	StaveNote,
	StemmableNote,
	Voice
} from 'vexflow';
import {
	courtesyAccidentals,
	type Exercise,
	eventCost,
	type NoteEvent,
	notatedEvents,
	snapToGrid,
	UNITS
} from '#lib/practice/exercise/index.js';
import { computeHighlightBoxes, type HighlightBox } from './highlight.js';
import {
	beatUnitsFor,
	desiredWidth,
	layoutRows,
	ROW_HEIGHT,
	STAVE_MARGIN,
	SYMBOL_ROW_HEIGHT,
	SYMBOL_TOP_MARGIN,
	TOP_MARGIN
} from './layout.js';

// vexflow 体积较大且依赖 DOM，仅在浏览器端动态加载
export type VexFlowModule = typeof import('vexflow');

const DURATION_CODES: Record<string, string> = {
	whole: 'w',
	half: 'h',
	quarter: 'q',
	eighth: '8',
	sixteenth: '16'
};

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

function buildVoice(
	vf: VexFlowModule,
	factory: Factory,
	score: EasyScore,
	events: NoteEvent[],
	exercise: Exercise
): Voice {
	const notes = score.notes(toEasyScoreLine(events));

	// 和弦代号（顺阶分解和弦）：画在该和弦第一个音的谱表上方；
	// 首音被记谱层拆成连音链时只画在第一段（后续段由 tieToNext 与前段相连）
	for (let j = 0; j < events.length; j++) {
		const symbol = events[j].chordSymbol;
		if (symbol === undefined || (j > 0 && events[j - 1].tieToNext)) continue;
		notes[j].addModifier(
			new vf.ChordSymbol()
				.addText(symbol)
				.setFont('Arial', 12, 'bold')
				.setHorizontal(vf.ChordSymbol.HorizontalJustify.CENTER),
			0
		);
	}

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

/** 渲染整个题目，返回逐渲染音符的高亮框（坐标只能在绘制完成后取） */
export function draw(
	vf: VexFlowModule,
	container: HTMLDivElement,
	exercise: Exercise,
	width: number
): HighlightBox[] {
	container.innerHTML = '';
	const notated = exercise.measures.map((measure) =>
		notatedEvents(measure, exercise)
	);
	const courtesy = courtesyAccidentals(notated, exercise.key);
	// 和弦代号（顺阶分解和弦）在谱表上方占一行文字，需要更大的行距与顶部空白
	const hasChordSymbols = notated.some((measure) =>
		measure.some((event) => event.chordSymbol !== undefined)
	);
	const rowHeight = hasChordSymbols ? SYMBOL_ROW_HEIGHT : ROW_HEIGHT;
	const topMargin = hasChordSymbols ? SYMBOL_TOP_MARGIN : TOP_MARGIN;
	const available = width - STAVE_MARGIN * 2;
	const rows = layoutRows(notated, available);
	const height = rows.length * rowHeight + topMargin;

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
	/** 逐小节的渲染音符（与 notated 顺序一致），draw 完后用于算高亮坐标 */
	const tickablesByMeasure: StaveNote[][] = [];
	/** 逐小节的谱表行行顶 y（内容坐标），游标自动翻页按行对齐视口用 */
	const rowTops: number[] = [];
	rows.forEach((rowEvents, rowIndex) => {
		const y = rowIndex * rowHeight + topMargin;
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

			const voice = buildVoice(vf, factory, score, events, exercise);
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
			tickablesByMeasure[measureIndex] = voice.getTickables() as StaveNote[];
			rowTops[measureIndex] = y - topMargin;
			measureIndex++;
		});
	});

	factory.draw();
	// 坐标只能在绘制完成后取（此时符头 X/Y 才是最终值）
	return computeHighlightBoxes(exercise, notated, tickablesByMeasure, rowTops);
}
