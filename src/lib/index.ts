export const SERVICE_UUID = '5b27f7a0-4c52-4c80-ae0b-8b3e8c1e0001';
export const CHAR_TEXT_UUID = '5b27f7a0-4c52-4c80-ae0b-8b3e8c1e0002';

export async function connectCore2Glass() {
  const device = await navigator.bluetooth.requestDevice({
    filters: [{ name: 'Core2Glass' }],
    optionalServices: [SERVICE_UUID]
  });

  const server = await device.gatt?.connect();
  if (!server) throw new Error('GATT connect failed');

  const service = await server.getPrimaryService(SERVICE_UUID);
  const charText = await service.getCharacteristic(CHAR_TEXT_UUID);

  return { device, server, charText };
}

export async function writeText(
  charText: BluetoothRemoteGATTCharacteristic,
  text: string
) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  // 長すぎる場合は分割した方が安全（ここではそのまま送る）
  await charText.writeValue(data);
}
