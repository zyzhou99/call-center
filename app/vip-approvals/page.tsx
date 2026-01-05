"use client";

import { useEffect, useState } from "react";

type ApprovalItem = {
  id: string;
  vipNumber: string;
  preferredName: string | null;
  birthday: string | null;
  mode: string;
  platform: string | null;
  status: string;
  createdAt: string;
  vipGuest: {
    fullName: string;
    tier: string | null;
    room: string | null;
    statusLabel: string | null;
    segment: string | null;
  } | null;
};

export default function VipApprovalsPage() {
  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchApprovals() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/vip/approvals");
        const data = await res.json();
        if (!data.ok) {
          setError("无法加载待审批列表，请稍后重试。");
          setLoading(false);
          return;
        }
        setItems(data.items || []);
        if (data.items && data.items.length > 0) {
          setSelectedId(data.items[0].id);
        }
        setLoading(false);
      } catch (err) {
        console.error(err);
        setError("网络异常，请稍后再试。");
        setLoading(false);
      }
    }

    fetchApprovals();
  }, []);

  const selected = items.find((it) => it.id === selectedId) || null;

  async function approve(id: string) {
    setActionLoadingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/vip/approvals/${id}/approve`, {
        method: "POST",
      });
      const data = await res.json();
      if (!data.ok) {
        setError("审批失败，请稍后重试。");
        setActionLoadingId(null);
        return;
      }
      // 从列表里移除已审批的这一条
      setItems((prev) => prev.filter((it) => it.id !== id));
      setActionLoadingId(null);

      // 如果当前选中的是这个，更新选中
      if (selectedId === id) {
        const remaining = items.filter((it) => it.id !== id);
        setSelectedId(remaining[0]?.id ?? null);
      }
    } catch (err) {
      console.error(err);
      setError("网络异常，审批失败。");
      setActionLoadingId(null);
    }
  }

  async function reject(id: string) {
    setActionLoadingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/vip/approvals/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Rejected from demo UI" }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError("拒绝失败，请稍后重试。");
        setActionLoadingId(null);
        return;
      }
      setItems((prev) => prev.filter((it) => it.id !== id));
      setActionLoadingId(null);

      if (selectedId === id) {
        const remaining = items.filter((it) => it.id !== id);
        setSelectedId(remaining[0]?.id ?? null);
      }
    } catch (err) {
      console.error(err);
      setError("网络异常，拒绝失败。");
      setActionLoadingId(null);
    }
  }

  const formatTime = (iso: string | null | undefined) => {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatBirthday = (iso: string | null) => {
    if (!iso) return "-";
    const d = new Date(iso);
    return d.toLocaleDateString("en-CA"); // yyyy-mm-dd
  };

  const isEmpty = !loading && items.length === 0;

  return (
    <div className="min-h-screen bg-[#f5f2eb] flex justify-center px-4 py-6 sm:px-6 lg:px-8">
      <div className="w-full max-w-6xl flex flex-col gap-6">
        {/* 顶部标题区域 */}
        <header className="space-y-2">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-[0.18em] text-[#8c6b32] uppercase">
            VIP APPROVALS
          </h1>
          <p className="text-sm text-[#6b5a3a]">
            礼宾人员在此核验 VIP 卡号、姓名和生日后，再为贵宾开启专属对话。
          </p>
        </header>

        {/* 错误提示 */}
        {error && (
          <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-[12px] text-red-700">
            {error}
          </div>
        )}

        {/* 主体布局：PC 两列，Mobile 一列 */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2.2fr),minmax(0,1.6fr)] gap-6">
          {/* 左侧：列表区域（在手机上就是全部内容） */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold tracking-[0.18em] text-[#b0883f] uppercase">
                PENDING REQUESTS
              </h2>
              {!loading && (
                <span className="text-xs text-[#7b6a52]">
                  {items.length} request{items.length === 1 ? "" : "s"}
                </span>
              )}
            </div>

            <div className="rounded-2xl bg-[#fffaf2] border border-[#ead8b8] shadow-sm">
              {loading ? (
                <div className="px-4 py-8 flex items-center justify-center text-sm text-[#7b6a52]">
                  正在加载待审批列表…
                </div>
              ) : isEmpty ? (
                <div className="px-4 py-8 flex flex-col items-center justify-center gap-2 text-sm text-[#7b6a52]">
                  <span>目前没有待审批的 VIP 请求。</span>
                  <span className="text-xs">
                    当客人通过二维码填写信息后，请求会显示在这里。
                  </span>
                </div>
              ) : (
                <ul className="divide-y divide-[#f0e0c7]">
                  {items.map((item) => {
                    const isSelected = item.id === selectedId;
                    const displayName =
                      item.preferredName ||
                      item.vipGuest?.fullName ||
                      item.vipNumber;
                    const room = item.vipGuest?.room;
                    const tier = item.vipGuest?.tier;
                    const modeLabel =
                      item.mode === "wecom"
                        ? "WeCom Entry"
                        : item.mode === "h5"
                        ? "H5 Entry"
                        : item.mode;
                    return (
                      <li
                        key={item.id}
                        className={`px-4 py-3 sm:px-5 sm:py-4 cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-[#fff2dd]"
                            : "bg-[#fffaf2] hover:bg-[#fff3e1]"
                        }`}
                        onClick={() => setSelectedId(item.id)}
                      >
                        {/* 上半部分：主信息 */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-[#3a3023] truncate">
                                {displayName}
                              </span>
                              {tier && (
                                <span className="inline-flex items-center rounded-full border border-[#d4b27b] bg-[#fdf3dd] px-2 py-[2px] text-[10px] uppercase tracking-[0.16em] text-[#8c6b32]">
                                  {tier}
                                </span>
                              )}
                            </div>

                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#7b6a52]">
                              <span>VIP #{item.vipNumber}</span>
                              {room && <span>Room {room}</span>}
                              {item.vipGuest?.statusLabel && (
                                <span>{item.vipGuest.statusLabel}</span>
                              )}
                            </div>

                            <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] text-[#a08759]">
                              <span>{modeLabel}</span>
                              {item.platform && (
                                <span className="before:content-['·'] before:mx-1">
                                  {item.platform}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* 时间 */}
                          <div className="ml-2 shrink-0 text-right">
                            <div className="text-[11px] text-[#8b7a5a]">
                              {formatTime(item.createdAt)}
                            </div>
                            {item.birthday && (
                              <div className="mt-0.5 text-[10px] text-[#b39a71]">
                                DOB {formatBirthday(item.birthday)}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* 下半部分：操作按钮（手机端直接用，PC 端也保留，方便单屏操作） */}
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              approve(item.id);
                            }}
                            disabled={actionLoadingId === item.id}
                            className="flex-1 sm:flex-none sm:min-w-[110px] inline-flex justify-center items-center rounded-[999px] px-3 py-2 text-[12px] font-semibold tracking-[0.16em] uppercase disabled:opacity-60 disabled:cursor-not-allowed"
                            style={{
                              background:
                                "linear-gradient(91deg, #F3DBAB 3.63%, #D6BB87 100%)",
                              color: "#3a3023",
                            }}
                          >
                            {actionLoadingId === item.id
                              ? "APPROVING..."
                              : "APPROVE"}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              reject(item.id);
                            }}
                            disabled={actionLoadingId === item.id}
                            className="flex-1 sm:flex-none sm:min-w-[110px] inline-flex justify-center items-center rounded-[999px] px-3 py-2 text-[12px] font-semibold tracking-[0.16em] uppercase border border-[#d8c3a0] text-[#7b6a52] bg-[#fffaf2] disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {actionLoadingId === item.id
                              ? "PROCESSING..."
                              : "REJECT"}
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>

          {/* 右侧：详情区域（只在 lg 及以上显示，手机就用上面的卡片信息） */}
          <section className="hidden lg:block">
            <div className="rounded-2xl bg-[#fffaf2] border border-[#ead8b8] shadow-sm h-full p-5">
              <h2 className="text-sm font-semibold tracking-[0.18em] text-[#b0883f] uppercase mb-3">
                GUEST DETAILS
              </h2>

              {!selected ? (
                <p className="text-sm text-[#7b6a52]">
                  在左侧选择一位贵宾，即可查看详细资料。
                </p>
              ) : (
                <div className="space-y-4">
                  {/* 姓名 & 等级 */}
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="text-base font-semibold text-[#3a3023]">
                        {selected.preferredName ||
                          selected.vipGuest?.fullName ||
                          selected.vipNumber}
                      </div>
                      {selected.vipGuest?.tier && (
                        <span className="inline-flex items-center rounded-full border border-[#d4b27b] bg-[#fdf3dd] px-2 py-[2px] text-[10px] uppercase tracking-[0.16em] text-[#8c6b32]">
                          {selected.vipGuest.tier}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-[12px] text-[#7b6a52]">
                      VIP #{selected.vipNumber}
                    </div>
                  </div>

                  {/* 房号 / 状态 */}
                  <div className="grid grid-cols-2 gap-3 text-[12px] text-[#5b4b34]">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.14em] text-[#b0883f]">
                        ROOM
                      </div>
                      <div className="mt-1">
                        {selected.vipGuest?.room ?? "-"}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.14em] text-[#b0883f]">
                        STATUS
                      </div>
                      <div className="mt-1">
                        {selected.vipGuest?.statusLabel ?? "-"}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.14em] text-[#b0883f]">
                        SEGMENT
                      </div>
                      <div className="mt-1">
                        {selected.vipGuest?.segment ?? "-"}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.14em] text-[#b0883f]">
                        BIRTHDAY
                      </div>
                      <div className="mt-1">
                        {formatBirthday(selected.birthday)}
                      </div>
                    </div>
                  </div>

                  {/* 入口与平台 */}
                  <div className="mt-2 rounded-xl border border-[#ecd7b6] bg-[#fff7ea] px-4 py-3 text-[12px] text-[#5b4b34] space-y-1">
                    <div>
                      入口模式：{" "}
                      <span className="font-semibold uppercase">
                        {selected.mode === "wecom"
                          ? "WeCom"
                          : selected.mode === "h5"
                          ? "H5"
                          : selected.mode}
                      </span>
                    </div>
                    {selected.platform && (
                      <div>浏览器平台：{selected.platform}</div>
                    )}
                    <div className="text-[11px] text-[#8f7c5e]">
                      提交时间：{formatTime(selected.createdAt)}
                    </div>
                  </div>

                  {/* 操作按钮（PC 端也保留一套，方便右侧直接操作） */}
                  <div className="mt-4 flex gap-3">
                    <button
                      type="button"
                      onClick={() => approve(selected.id)}
                      disabled={actionLoadingId === selected.id}
                      className="flex-1 inline-flex justify-center items-center rounded-[999px] px-3 py-2.5 text-[12px] font-semibold tracking-[0.16em] uppercase disabled:opacity-60 disabled:cursor-not-allowed"
                      style={{
                        background:
                          "linear-gradient(91deg, #F3DBAB 3.63%, #D6BB87 100%)",
                        color: "#3a3023",
                      }}
                    >
                      {actionLoadingId === selected.id
                        ? "APPROVING..."
                        : "APPROVE"}
                    </button>
                    <button
                      type="button"
                      onClick={() => reject(selected.id)}
                      disabled={actionLoadingId === selected.id}
                      className="flex-1 inline-flex justify-center items-center rounded-[999px] px-3 py-2.5 text-[12px] font-semibold tracking-[0.16em] uppercase border border-[#d8c3a0] text-[#7b6a52] bg-[#fffaf2] disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {actionLoadingId === selected.id
                        ? "PROCESSING..."
                        : "REJECT"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
