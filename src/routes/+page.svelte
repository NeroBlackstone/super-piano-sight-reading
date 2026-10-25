<script lang="ts">
import { onMount, untrack } from 'svelte';
import ClefCard from '#lib/components/practice/clef-card.svelte';
import KeysCard from '#lib/components/practice/keys-card.svelte';
import PracticeCard from '#lib/components/practice/practice-card.svelte';
import RangeCard from '#lib/components/practice/range-card.svelte';
import RhythmCard from '#lib/components/practice/rhythm-card.svelte';
import SiteHeader from '#lib/components/practice/site-header.svelte';
import SummaryCard from '#lib/components/practice/summary-card.svelte';
import { m } from '#lib/paraglide/messages.js';
import {
	createDefaultConfig,
	type PracticeConfig,
	TEMPO_MAX,
	TEMPO_MIN,
	type TimeSignature
} from '#lib/practice/config.js';
import { defaultUnitByDenominator } from '#lib/practice/options.js';
import { loadPracticeConfig } from '#lib/practice/session.js';

// —— 原型：仅用于展示交互状态 ——
// 练习配置唯一真源，结构与默认值见 #lib/practice/config.js
let config = $state<PracticeConfig>(createDefaultConfig());

// 从练习页返回时恢复上次开始练习的配置
onMount(() => {
	const saved = loadPracticeConfig();
	if (saved) {
		config = saved;
		prevTimeSignature = saved.timeSignature;
	}
});

// 拍号变化时：按分母重置默认时值（/4 拍 → 四分，/8 拍 → 八分），
// 并等比换算 BPM 保持绝对速度不变；拍号必选 —— bits-ui 单选组再次点击
// 会把值清空成 ''，这里直接驳回
// 刻意只取初始值（配合 onMount 恢复配置后再同步），用 untrack 跳过响应式追踪
let prevTimeSignature: string = untrack(() => config.timeSignature);
$effect.pre(() => {
	const next: string = config.timeSignature;
	if (next === prevTimeSignature) return;
	if (next === '') {
		config.timeSignature = prevTimeSignature as TimeSignature;
		return;
	}
	const prevDen = prevTimeSignature.split('/')[1];
	const den = next.split('/')[1];
	const unit = defaultUnitByDenominator[den];
	if (unit) config.durations = [unit];
	// 一拍单位随分母变化时等比换算 BPM，保持绝对速度不变
	const factor = Number(prevDen) / Number(den);
	if (factor !== 1) {
		config.tempo = Math.min(
			TEMPO_MAX,
			Math.max(TEMPO_MIN, Math.round(config.tempo * factor))
		);
	}
	prevTimeSignature = next;
});
</script>

<svelte:head>
	<title>{m.pageTitle()}</title>
</svelte:head>

<SiteHeader />

<main
	class="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:py-8"
>
	<div class="flex min-w-0 flex-col gap-6">
		<!-- 谱号 -->
		<ClefCard {config} />
		<!-- 调号 -->
		<KeysCard {config} />
		<!-- 音域 -->
		<RangeCard {config} />
		<!-- 音符与节奏 -->
		<RhythmCard {config} />
		<!-- 练习设置 -->
		<PracticeCard {config} />
	</div>

	<!-- 配置摘要 -->
	<SummaryCard {config} />
</main>

<footer class="border-t">
	<div
		class="mx-auto max-w-6xl px-4 py-4 text-xs text-muted-foreground sm:px-6"
	>
		{m.footerText()}
	</div>
</footer>
