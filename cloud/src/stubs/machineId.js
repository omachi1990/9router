const MACHINE_ID_SEED =
  typeof crypto?.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;

function toHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256Hex(value) {
  if (crypto?.subtle) {
    const bytes = new TextEncoder().encode(value);
    return toHex(await crypto.subtle.digest("SHA-256", bytes));
  }

  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(16).padStart(16, "0");
}

export async function getConsistentMachineId(salt = null) {
  const saltValue = salt || "endpoint-proxy-salt";
  return (await sha256Hex(`${MACHINE_ID_SEED}:${saltValue}`)).substring(0, 16);
}

export async function getRawMachineId() {
  return MACHINE_ID_SEED;
}

export function isBrowser() {
  return false;
}
