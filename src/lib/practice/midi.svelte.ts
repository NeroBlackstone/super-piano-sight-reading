/**
 * MIDI 输入设备状态（Web MIDI API）与音符事件订阅。
 *
 * 纯客户端能力：initMidi() 幂等地申请 MIDI 访问权限并监听设备插拔，
 * 供页头的连接状态指示等消费；浏览器不支持或权限被拒时静默降级。
 *
 * subscribeNotes() 订阅所有输入设备的音符消息（跟弹判定用），
 * 无设备 / 不支持时永不触发，订阅方无需感知降级。
 */

let started = false;

/** 排除 ALSA 的虚拟回环端口（如 "Midi Through Port-0"），它不是真实设备 */
const isVirtualPort = (name: string) => name.startsWith('Midi Through');

/** 一个音符事件：按下（on）或抬起（off） */
export interface NoteEvent {
	/** MIDI 音高 0–127 */
	midi: number;
	/** true = 按下，false = 抬起 */
	on: boolean;
}

type NoteListener = (event: NoteEvent) => void;

const noteListeners = new Set<NoteListener>();

/** 订阅音符事件（所有输入设备汇总），返回退订函数 */
export function subscribeNotes(listener: NoteListener): () => void {
	noteListeners.add(listener);
	return () => {
		noteListeners.delete(listener);
	};
}

/** 解析一条 MIDI 消息：仅关心 note-on / note-off，其余（CC、踏板等）忽略 */
function dispatchNoteMessage(event: Event): void {
	const data = (event as MIDIMessageEvent).data;
	if (!data || data.length < 3) return;
	const status = data[0] & 0xf0;
	if (status !== 0x90 && status !== 0x80) return;
	// note-on + velocity 0 是 note-off 的变体（部分键盘如此发送）
	const on = status === 0x90 && data[2] > 0;
	if (noteListeners.size === 0) return;
	for (const listener of noteListeners) {
		listener({ midi: data[1] & 0x7f, on });
	}
}

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
			const inputs = Array.from(access.inputs.values());
			for (const input of inputs) {
				if (!isVirtualPort(input.name ?? '')) {
					input.onmidimessage = dispatchNoteMessage;
				}
			}
			midi.inputs = inputs
				.map((input) => input.name ?? '')
				.filter((name) => name !== '' && !isVirtualPort(name));
		};
		access.onstatechange = sync;
		sync();
	} catch {
		midi.denied = true;
	}
}
