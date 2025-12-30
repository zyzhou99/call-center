// lib/vipBindingState.ts

type PendingVipBinding = {
  vipGuestId: string;
  vipNumber: string;
  createdAt: number;
};

const pendingByOpenKfid = new Map<string, PendingVipBinding>();

// 挂起 10 分钟还没用就当作过期
const EXPIRE_MS = 10 * 60 * 1000;

/**
 * 在 /api/vip/verify 那里调用：
 * 表示：这个 openKfid 「下一位刚来聊天的客人」
 * 要和哪个 VIP 绑定。
 */
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

/**
 * 在 /api/wecom/callback 那里调用：
 * 拿出并消费这个「待绑定 VIP」记录。
 */
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
