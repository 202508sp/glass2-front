<script lang="ts">
  import { SERVICE_UUID, CHAR_TEXT_UUID, connectCore2Glass, writeText } from '$lib';
  import { onMount } from 'svelte';

  // Svelte 5 でも従来スタイルで書いてよければ普通の let でOK
  let isSupported = false;
  let isConnecting = false;
  let isConnected = false;

  let device: BluetoothDevice | null = null;
  let charText: BluetoothRemoteGATTCharacteristic | null = null;

  // スロット用の簡易 state
  type Slot = { text: string; delayMs: number };

  let slots: Slot[] = [
    {
      text: '名前：山田 花子\nヤマダ ハナコ\n介護度：5\n注記：入浴は要介助',
      delayMs: 2000
    }
  ];
  let currentIndex = 0;
  let playing = false;
  let playTimer: number | null = null;

  let logText = '';

  const log = (m: string) => {
    logText += m + '\n';
  };

  onMount(() => {
    isSupported = 'bluetooth' in navigator;
    if (!isSupported) {
      log('このブラウザは Web Bluetooth に対応していません');
    }
  });

  async function handleConnect() {
    if (!isSupported || isConnecting || isConnected) return;
    isConnecting = true;
    try {
      const res = await connectCore2Glass();
      device = res.device;
      charText = res.charText;
      isConnected = true;
      log('BLE: 接続完了');

      device.addEventListener('gattserverdisconnected', () => {
        isConnected = false;
        charText = null;
        log('BLE: 切断されました');
      });
    } catch (e) {
      console.error(e);
      log('BLE: 接続に失敗しました');
    } finally {
      isConnecting = false;
    }
  }

  async function sendOnce() {
    if (!charText) {
      log('BLE が未接続です');
      return;
    }
    if (slots.length === 0) {
      log('スロットがありません');
      return;
    }
    if (currentIndex >= slots.length) currentIndex = 0;
    const slot = slots[currentIndex];
    try {
      await writeText(charText, slot.text || '');
      log(`SEND-ONCE: slot ${currentIndex + 1}`);
    } catch (e) {
      console.error(e);
      log('送信に失敗しました');
    }
  }

  function updateSlot(index: number, field: 'text' | 'delayMs', value: string) {
    const copy = [...slots];
    if (!copy[index]) return;
    if (field === 'text') {
      copy[index] = { ...copy[index], text: value };
    } else {
      const n = Number(value) || 1000;
      copy[index] = { ...copy[index], delayMs: Math.max(100, n) };
    }
    slots = copy;
  }

  function addSlot() {
    slots = [...slots, { text: '', delayMs: 1000 }];
  }

  function removeSlot(index: number) {
    const copy = [...slots];
    copy.splice(index, 1);
    slots = copy;
    if (currentIndex >= slots.length) {
      currentIndex = Math.max(0, slots.length - 1);
    }
  }

  function setCurrent(index: number) {
    currentIndex = index;
  }

  async function playNext() {
    if (!playing) return;
    if (!charText) {
      log('BLE が未接続です');
      playing = false;
      return;
    }
    if (slots.length === 0) {
      log('スロットがありません');
      playing = false;
      return;
    }

    if (currentIndex >= slots.length) currentIndex = 0;
    const slot = slots[currentIndex];

    try {
      await writeText(charText, slot.text || '');
      log(`PLAY: slot ${currentIndex + 1}, delay=${slot.delayMs}ms`);
    } catch (e) {
      console.error(e);
      log('送信中にエラーが発生しました');
      playing = false;
      return;
    }

    currentIndex = (currentIndex + 1) % slots.length;

    playTimer = window.setTimeout(() => {
      void playNext();
    }, slot.delayMs);
  }

  function startPlay() {
    if (playing) return;
    if (slots.length === 0) {
      log('スロットがありません');
      return;
    }
    playing = true;
    void playNext();
  }

  function stopPlay() {
    playing = false;
    if (playTimer !== null) {
      window.clearTimeout(playTimer);
      playTimer = null;
    }
  }
</script>

<main>
  <h2>Glass2 アニメーション（BLE）</h2>

  {#if !isSupported}
    <p>このブラウザは Web Bluetooth に対応していません。</p>
  {/if}

  <div class="controls">
    <button on:click={handleConnect} disabled={!isSupported || isConnecting || isConnected}>
      {#if isConnected}
        接続済み
      {:else if isConnecting}
        接続中...
      {:else}
        BLE 接続
      {/if}
    </button>

    <button on:click={addSlot}>＋ スロット追加</button>
    <button on:click={startPlay} disabled={!isConnected}>▶ 再生</button>
    <button on:click={stopPlay}>■ 停止</button>
    <button on:click={sendOnce} disabled={!isConnected}>今のスロットを単発送信</button>
  </div>

  <div class="slots">
    {#each slots as slot, idx}
      <section class="slot">
        <h3>
          スロット {idx + 1}
          {#if idx === currentIndex}
            （再生位置）
          {/if}
        </h3>
        <label>
          テキスト
          <textarea
            rows="3"
            bind:value={slot.text}
            on:input={(e) => updateSlot(idx, 'text', (e.currentTarget as HTMLTextAreaElement).value)}
          ></textarea>
        </label>
        <label>
          ディレイ (ms)
          <input
            type="number"
            min="100"
            step="100"
            bind:value={slot.delayMs}
            on:input={(e) => updateSlot(idx, 'delayMs', (e.currentTarget as HTMLInputElement).value)}
          />
        </label>
        <div class="slot-buttons">
          <button type="button" on:click={() => setCurrent(idx)}>ここから再生</button>
          <button type="button" on:click={() => removeSlot(idx)}>削除</button>
        </div>
      </section>
    {/each}
  </div>

  <pre class="log">{logText}</pre>
</main>

<style>
  main {
    padding: 16px;
    max-width: 800px;
    margin: 0 auto;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }
  .controls {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 16px;
  }
  button {
    padding: 6px 12px;
    font-size: 14px;
  }
  .slots {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 16px;
  }
  .slot {
    border: 1px solid #ccc;
    padding: 8px;
  }
  textarea {
    width: 100%;
    box-sizing: border-box;
  }
  input[type='number'] {
    width: 100%;
    box-sizing: border-box;
  }
  label {
    display: block;
    margin-top: 4px;
  }
  .slot-buttons {
    margin-top: 8px;
    display: flex;
    gap: 8px;
  }
  .log {
    background: #f5f5f5;
    padding: 8px;
    white-space: pre-wrap;
    font-size: 12px;
  }
</style>
