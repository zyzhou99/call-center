// lib/vipBindingState.ts

export type VipBinding = {
  vipGuestId: string;
  vipNumber: string;
  expiresAt: number;
};

// 最近一次从 /vip-access 验证成功的 VIP
let lastVipBinding: VipBinding | null = null;

// 在 /api/vip/verify 里调用：记录这次 VIP 验证
export function setLastVipBinding(vipGuestId: string, vipNumber: string) {
  lastVipBinding = {
    vipGuestId,
    vipNumber,
    // 有效期 5 分钟，防止被之后乱绑定
    expiresAt: Date.now() + 5 * 60 * 1000,
  };
  console.log(
    "[vip-binding] setLastVipBinding",
    vipNumber,
    "expires at",
    new Date(lastVipBinding.expiresAt).toISOString()
  );
}

// 在 /api/wecom/callback 里调用：只消费一次，然后清空
export function consumeLastVipBinding(): VipBinding | null {
  if (!lastVipBinding) return null;

  if (Date.now() > lastVipBinding.expiresAt) {
    console.log(
      "[vip-binding] expired, drop binding for",
      lastVipBinding.vipNumber
    );
    lastVipBinding = null;
    return null;
  }

  const v = lastVipBinding;
  lastVipBinding = null;
  console.log("[vip-binding] consumeLastVipBinding", v.vipNumber);
  return v;
}
