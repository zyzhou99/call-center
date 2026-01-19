// lib/vipBindingState.ts
type PendingVipBinding = {
  vipGuestId: string;
  vipNumber: string;
  createdAt: number;
};

const pendingByOpenKfid = new Map<string, PendingVipBinding>();

const EXPIRE_MS = 10 * 60 * 1000;

export function setPendingVipBinding(
  openKfid: string,
  vipGuestId: string,
  vipNumber: string
) {
  pendingByOpenKfid.set(openKfid, {
    vipGuestId,
    vipNumber,
    createdAt: Date.now(),
  });

  console.log("[vipBinding] set pending", { openKfid, vipGuestId, vipNumber });
}

export function consumePendingVipBinding(
  openKfid: string
): PendingVipBinding | null {
  const pending = pendingByOpenKfid.get(openKfid);
  if (!pending) {
    return null;
  }

  pendingByOpenKfid.delete(openKfid);

  if (Date.now() - pending.createdAt > EXPIRE_MS) {
    console.log("[vipBinding] pending expired", { openKfid, ...pending });
    return null;
  }

  console.log("[vipBinding] consume pending", { openKfid, ...pending });
  return pending;
}
