/**
 * Web Audio 合成的节拍器点击声：倒计时一小节用，不引入音频资源文件。
 *
 * AudioContext 必须在用户手势内创建（浏览器自动播放策略），
 * 所以由调用方在点击"开始"时调用 ensureAudio()。
 */

let context: AudioContext | null = null;

/** 在用户手势内创建 / 复用 AudioContext，失败（不支持）时返回 null */
export function ensureAudio(): AudioContext | null {
	if (context) return context;
	try {
		context = new AudioContext();
	} catch {
		context = null;
	}
	return context;
}

/** 当前音频时钟（秒）；无 AudioContext 时退回 0 */
export function audioNow(): number {
	return context?.currentTime ?? 0;
}

/**
 * 排一次点击：when 为 AudioContext 时钟的绝对秒数（提前排程保证无抖动）。
 * accent 为 true（每小节第一拍）时音量更大、频率略低。
 */
export function scheduleClick(when: number, accent: boolean): void {
	if (!context) return;
	const osc = context.createOscillator();
	const gain = context.createGain();
	osc.type = 'square';
	osc.frequency.setValueAtTime(accent ? 1500 : 1000, when);
	gain.gain.setValueAtTime(0.0001, when);
	gain.gain.exponentialRampToValueAtTime(accent ? 0.4 : 0.22, when + 0.002);
	gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.07);
	osc.connect(gain).connect(context.destination);
	osc.start(when);
	osc.stop(when + 0.1);
}
