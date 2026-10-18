/**
 * MIDI 输入设备状态（Web MIDI API）。
 *
 * 纯客户端能力：initMidi() 幂等地申请 MIDI 访问权限并监听设备插拔，
 * 供页头的连接状态指示等消费；浏览器不支持或权限被拒时静默降级。
 */

let started = false;

/** 排除 ALSA 的虚拟回环端口（如 "Midi Through Port-0"），它不是真实设备 */
const isVirtualPort = (name: string) => name.startsWith('Midi Through');

class MidiState {
	/** 浏览器是否支持 Web MIDI（如 Firefox 默认不支持） */
	supported = $state(true);
	/** MIDI 访问权限是否被拒绝 */
	denied = $state(false);
	/** 已连接输入设备的名称 */
	inputs = $state<string[]>([]);
	/** 是否有可用的 MIDI 输入 */
	connected = $derived(this.inputs.length > 0);
}

/** 全局单例：组件直接读取即可 */
export const midi = new MidiState();

/** 幂等初始化：重复调用只有第一次生效 */
export async function initMidi(): Promise<void> {
	if (started) return;
	started = true;
	if (!navigator.requestMIDIAccess) {
		midi.supported = false;
		return;
	}
	try {
		const access = await navigator.requestMIDIAccess();
		// 插拔设备时 access.inputs 会先更新，再触发 statechange
		const sync = () => {
			midi.inputs = Array.from(access.inputs.values())
				.map((input) => input.name ?? '')
				.filter((name) => name !== '' && !isVirtualPort(name));
		};
		access.onstatechange = sync;
		sync();
	} catch {
		midi.denied = true;
	}
}
