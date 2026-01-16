"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

type VipRequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";

interface VipGuestLite {
  fullName: string;
  preferredName?: string | null;
  birthdayMd?: string | null;
  tier?: string | null;
  room?: string | null;
  segment?: string | null;
  statusLabel?: string | null;
  checkInDate?: string | null;
  checkOutDate?: string | null;
}

interface VipRequestItem {
  id: string;
  status: VipRequestStatus;
  vipNumber: string;
  inputPreferredName?: string | null;
  inputBirthdayMd?: string | null;
  version: string;
  entryMode: string;
  scanChannel: string;
  createdAt: string;

  // 這兩個字段暫時後端未必有，但先留著
  inputChannelIdentifier?: string | null;
  nicknameFromChannel?: string | null;

  // ⭐ 後端 PendingApproval.reason，當作客服備註使用
  reason?: string | null;

  vipGuest?: VipGuestLite | null;
}

interface VipApprovalsApiResponse {
  ok: boolean;
  items?: VipRequestItem[];
  approvals?: VipRequestItem[];
  error?: string;
}

type StatusTab = "ALL" | "PENDING" | "APPROVED" | "REJECTED";
type ChannelFilter = "ALL" | "wechat" | "browser";

interface VipRequestsViewProps {
  onPendingCountChange?: (count: number) => void;
}

// ------ helpers ------

const formatDateTime = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.toISOString().slice(0, 10)} ${d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
};

const formatTime = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getStatusChipStyle = (status: VipRequestStatus) => {
  switch (status) {
    case "PENDING":
      return {
        label: "Pending",
        className: "bg-[#F6E4BD] text-[#7A5A22]",
      };
    case "APPROVED":
      return {
        label: "Approved",
        className: "bg-[#D5F3CC] text-[#296526]",
      };
    case "REJECTED":
      return {
        label: "Rejected",
        className: "bg-[#FDE2E0] text-[#B91C1C]",
      };
    case "EXPIRED":
      return {
        label: "Expired",
        className: "bg-gray-200 text-gray-600",
      };
    default:
      return {
        label: status,
        className: "bg-gray-200 text-gray-600",
      };
  }
};

export function VipRequestsView({ onPendingCountChange }: VipRequestsViewProps) {
  const [requests, setRequests] = useState<VipRequestItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const [statusTab, setStatusTab] = useState<StatusTab>("PENDING");
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>("ALL");
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ⭐ 每一條 request 的備註
  const [remarkById, setRemarkById] = useState<Record<string, string>>({});

  // ⭐ 手機端列表 / 詳情視圖切換，只影響 < md
  const [mobileView, setMobileView] = useState<"list" | "detail">("list");

  // ------- data fetching -------

  const refresh = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = opts?.silent ?? false;
      if (!silent) {
        setLoading(true);
        setError(null);
      }

      try {
        const res = await fetch("/api/vip/approvals");
        const data: VipApprovalsApiResponse = await res.json();

        if (!data?.ok) {
          throw new Error(data?.error ?? "REQUEST_FAILED");
        }

        const list: VipRequestItem[] =
          (Array.isArray(data.items) ? data.items : data.approvals) ?? [];

        // 最新在上
        list.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        setRequests(list);

        // 把已有的 reason 同步到備註裡（第一次打開時可以看到歷史備註）
        setRemarkById((prev) => {
          const next = { ...prev };
          for (const r of list) {
            if (r.reason && !next[r.id]) {
              next[r.id] = r.reason;
            }
          }
          return next;
        });

        const pendingCount = list.filter((r) => r.status === "PENDING").length;
        onPendingCountChange?.(pendingCount);

        return list;
      } catch (e) {
        console.error("load vip approvals failed:", e);
        if (!opts?.silent) {
          setError("Failed to load VIP requests.");
        }
        return [];
      } finally {
        if (!opts?.silent) {
          setLoading(false);
        }
        setActionLoadingId(null);
      }
    },
    [onPendingCountChange]
  );

  // 首次加载
  useEffect(() => {
    void refresh();
  }, [refresh]);

  // 每 5 秒靜默刷新一次列表（不打斷當前選中）
  useEffect(() => {
    const timer = setInterval(() => {
      void refresh({ silent: true });
    }, 5000);

    return () => clearInterval(timer);
  }, [refresh]);

  // ------- filters & derived state -------

  const stats = useMemo(() => {
    const pending = requests.filter((r) => r.status === "PENDING").length;
    const approved = requests.filter((r) => r.status === "APPROVED").length;
    const rejected = requests.filter((r) => r.status === "REJECTED").length;
    const all = requests.length;
    return { all, pending, approved, rejected };
  }, [requests]);

  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      if (statusTab !== "ALL" && r.status !== statusTab) return false;
      if (channelFilter !== "ALL" && r.scanChannel !== channelFilter)
        return false;

      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const pool = [
          r.vipNumber,
          r.inputPreferredName,
          r.vipGuest?.fullName,
          r.vipGuest?.preferredName,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!pool.includes(q)) return false;
      }

      return true;
    });
  }, [requests, statusTab, channelFilter, search]);

  // 根據「當前過濾後的列表」來決定 activeId
  useEffect(() => {
    if (!filteredRequests.length) {
      if (activeId !== null) setActiveId(null);
      return;
    }

    const existsInFiltered = activeId
      ? filteredRequests.some((r) => r.id === activeId)
      : false;

    if (!existsInFiltered) {
      setActiveId(filteredRequests[0].id);
    }
  }, [filteredRequests, activeId]);

  const activeRequest: VipRequestItem | null = useMemo(() => {
    if (!activeId) return null;
    return requests.find((r) => r.id === activeId) ?? null;
  }, [requests, activeId]);

  // 當前這條 request 對應的備註內容
  const remark =
    activeRequest && remarkById[activeRequest.id]
      ? remarkById[activeRequest.id]
      : "";

  // ------- actions -------

  const runAction = async (
    request: VipRequestItem,
    action: "APPROVE" | "REJECT"
  ) => {
    setActionLoadingId(request.id);
    setError(null);

    // 取這條 request 對應的備註
    const currentRemark = remarkById[request.id] ?? "";

    try {
      const res = await fetch(
        `/api/vip/approvals/${encodeURIComponent(request.id)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            // 把備註傳給後端，後端用 PendingApproval.reason 存起來
            reason: currentRemark || undefined,
          }),
        }
      );
      const data = await res.json();
      if (!data?.ok) {
        throw new Error(data?.error ?? "ACTION_FAILED");
      }

      // 完成後刷新列表，會觸發上面的 useEffect 自動跳到下一條 PENDING
      await refresh();
    } catch (e) {
      console.error("update approval failed:", e);
      setError("Failed to update approval status.");
      setActionLoadingId(null);
    }
  };

  // ------- render helpers -------

  const renderChannelLabel = (scanChannel: string) => {
    if (scanChannel === "wechat") return "WeChat";
    if (scanChannel === "browser") return "Web";
    return scanChannel;
  };

  const renderStatusTab = (
    key: StatusTab,
    label: string,
    count: number
  ): JSX.Element => {
    const isActive = statusTab === key;
    return (
      <button
        key={key}
        type="button"
        onClick={() => setStatusTab(key)}
        className={cn(
          "px-2.5 py-1 text-[11px] rounded-full transition-colors whitespace-nowrap",
          isActive
            ? "bg-black text-white"
            : "text-[#7d6b5c] hover:bg-black/5"
        )}
      >
        {label}{" "}
        <span className="text-[10px] opacity-70">{`(${count})`}</span>
      </button>
    );
  };

  const displayName =
    activeRequest &&
    (activeRequest.inputPreferredName ||
      activeRequest.vipGuest?.preferredName ||
      activeRequest.vipGuest?.fullName ||
      `VIP ${activeRequest.vipNumber}`);

  const statusChip =
    activeRequest && getStatusChipStyle(activeRequest.status);

  // 列表點擊行為：PC 只改 activeId；手機端會切到「詳情」頁
  const handleSelectRequest = (id: string) => {
    setActiveId(id);
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setMobileView("detail");
    }
  };

  // ------- UI -------

  return (
    <div
      className="flex flex-1 overflow-hidden"
      style={{ backgroundColor: "#ffffffff" }}
    >
      {/* --------- Desktop ≥ md：左右布局，詳情底部有按鈕條 --------- */}
      <div className="hidden md:flex flex-1 overflow-hidden">
        {/* 左側列表 */}
        <div
          className="relative z-10 w-96 flex flex-col border-r"
          style={{
            backgroundColor: "#F9F8F6",
            borderRightColor: "var(--divider)",
          }}
        >
          {/* header */}
          <div
            className="px-4 pt-4 pb-3 border-b"
            style={{ borderBottomColor: "var(--divider)" }}
          >
            <div className="flex items-center justify-between mb-2">
              <p
                className="text-xs font-semibold tracking-[0.18em] uppercase"
                style={{ color: "#b28a4a" }}
              >
                VIP Requests
              </p>
            </div>

            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                {renderStatusTab("PENDING", "Pending", stats.pending)}
                {renderStatusTab("ALL", "All", stats.all)}
                {renderStatusTab("APPROVED", "Approved", stats.approved)}
                {renderStatusTab("REJECTED", "Rejected", stats.rejected)}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <select
                className="w-full px-3 py-1.5 rounded-md text-[11px] border bg-white"
                style={{ borderColor: "var(--divider)", color: "#4b3a2b" }}
                value={channelFilter}
                onChange={(e) =>
                  setChannelFilter(e.target.value as ChannelFilter)
                }
              >
                <option value="ALL">All Channel</option>
                <option value="wechat">WeChat</option>
                <option value="browser">Web</option>
              </select>
            </div>

            {/* 搜索框 */}
            <div className="mt-2">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or VIP number..."
                className="w-full px-3 py-1.5 rounded-md text-[11px] border bg-white focus:outline-none focus:ring-1"
                style={{
                  borderColor: "var(--divider)",
                  // @ts-expect-error: css var
                  "--tw-ring-color": "var(--accent)",
                }}
              />
            </div>
          </div>

          {/* 列表區域 */}
          <div className="flex-1 overflow-y-auto">
            {loading && !requests.length ? (
              <div className="h-full flex items-center justify-center text-xs text-gray-500">
                Loading...
              </div>
            ) : filteredRequests.length === 0 ? (
              <div className="p-4 text-xs text-gray-500">
                No VIP requests under this filter.
              </div>
            ) : (
              filteredRequests.map((req) => {
                const guestName =
                  req.inputPreferredName ||
                  req.vipGuest?.preferredName ||
                  req.vipGuest?.fullName ||
                  `VIP ${req.vipNumber || "—"}`;
                const initials = guestName
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2);

                const chip = getStatusChipStyle(req.status);

                return (
                  <button
                    key={req.id}
                    type="button"
                    onClick={() => handleSelectRequest(req.id)}
                    className={cn(
                      "w-full px-4 py-3 flex items-center gap-3 text-left transition-colors min-h-[92px]",
                      activeId === req.id ? "bg-white" : "hover:bg-black/5"
                    )}
                  >
                    <div className="flex-shrink-0">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-medium"
                        style={{
                          backgroundColor: "var(--avatar-bg)",
                          color: "var(--accent)",
                        }}
                      >
                        {initials}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span
                          className="text-sm font-medium truncate"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {guestName}
                        </span>
                        <span className="text-[10px] text-gray-500 ml-2 flex-shrink-0">
                          {formatTime(req.createdAt)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-gray-500 truncate">
                          {renderChannelLabel(
                            req.scanChannel
                          )}{" "}
                          ·{" "}
                          {req.vipNumber
                            ? `VIP ${req.vipNumber}`
                            : "New Guest"}
                        </span>
                        <span
                          className={cn(
                            "ml-2 px-2 py-0.5 rounded-full text-[9px] font-medium flex-shrink-0",
                            chip.className
                          )}
                        >
                          {chip.label}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* 右側詳情 */}
        <div className="flex-1 flex flex-col">
          {activeRequest ? (
            <>
              {/* 上半部分內容可滾動 */}
              <div className="flex-1 overflow-y-auto px-16 pt-8 pb-8">
                {/* 頂部：名字 + 狀態 + 時間 */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-semibold text-[#3a3023]">
                      {displayName}
                    </h2>
                    {statusChip && (
                      <span
                        className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-medium",
                          statusChip.className
                        )}
                      >
                        {statusChip.label}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-[#9b8773]">
                    Request Time:{" "}
                    {formatDateTime(activeRequest.createdAt)}
                  </div>
                </div>

                {/* avatar + VIP tag */}
                <div className="flex flex-col items-center mb-10">
                  <div
                    className="w-20 h-20 rounded-full flex items-center justify-center text-xl font-medium mb-3"
                    style={{ backgroundColor: "#F4E7D4", color: "#7A5A22" }}
                  >
                    {(displayName ?? "VIP")
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2)}
                  </div>
                  <div className="px-3 py-1 rounded-full text-[11px] font-medium bg-[#F6E4BD] text-[#7A5A22]">
                    {activeRequest.vipNumber
                      ? `VIP | ${activeRequest.vipNumber}`
                      : "New Guest"}
                  </div>
                </div>

                {/* Request Info */}
                <section className="mb-8">
                  <div className="text-[11px] font-semibold tracking-[0.18em] text-[#b28a4a] uppercase mb-3">
                    Request Info
                  </div>

                  <div className="space-y-1.5 text-[13px] text-[#4b3a2b]">
                    <Row
                      label="Guest Name"
                      value={activeRequest.inputPreferredName ?? "—"}
                    />
                    <Row
                      label="Channel"
                      value={renderChannelLabel(
                        activeRequest.scanChannel
                      )}
                    />
                    <Row
                      label="Channel ID"
                      value={activeRequest.inputChannelIdentifier ?? "—"}
                    />
                    <Row
                      label="Request Time"
                      value={formatDateTime(activeRequest.createdAt)}
                    />
                  </div>
                </section>

                {/* Remark */}
                <section className="mt-6">
                  <div className="text-[11px] font-semibold tracking-[0.18em] text-[#b28a4a] uppercase mb-3">
                    Remark
                  </div>
                  <textarea
                    className="w-full min-h-[80px] rounded-lg border border-[#e4d4bd] bg-white px-3 py-2 text-[12px] text-[#4b3a2b] outline-none focus:ring-1 focus:ring-[#d3a65b]"
                    value={remark}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (!activeRequest) return;
                      setRemarkById((prev) => ({
                        ...prev,
                        [activeRequest.id]: v,
                      }));
                    }}
                    placeholder="Notes for acceptance / rejection (optional)"
                  />
                </section>

                {/* 錯誤信息：顯示在內容區底部 */}
                {error && (
                  <div className="mt-4 px-3 py-2 text-[11px] text-red-600 bg-red-50 border border-red-100 rounded-lg">
                    {error}
                  </div>
                )}
              </div>

              {/* 底部行動按鈕：跟隨詳情區底部 */}
              <div
                className="px-16 py-4 border-t bg-white shrink-0"
                style={{ borderTopColor: "var(--divider)" }}
              >
                <div className="flex justify-end gap-4">
                  <button
                    type="button"
                    onClick={() =>
                      activeRequest && runAction(activeRequest, "REJECT")
                    }
                    disabled={
                      !!activeRequest &&
                      actionLoadingId === activeRequest.id
                    }
                    className="px-8 py-2.5 rounded-full border text-sm font-medium disabled:opacity-60"
                    style={{
                      borderColor: "#f97373",
                      color: "#b91c1c",
                      backgroundColor: "white",
                    }}
                  >
                    {activeRequest &&
                    actionLoadingId === activeRequest.id
                      ? "Processing..."
                      : "Reject"}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      activeRequest && runAction(activeRequest, "APPROVE")
                    }
                    disabled={
                      !!activeRequest &&
                      actionLoadingId === activeRequest.id
                    }
                    className="px-8 py-2.5 rounded-full text-sm font-medium text-white disabled:opacity-60"
                    style={{ backgroundColor: "#111111" }}
                  >
                    {activeRequest &&
                    actionLoadingId === activeRequest.id
                      ? "Processing..."
                      : "Approve"}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex-1 flex items-center justify-center text-sm text-gray-500">
                No VIP request selected.
              </div>
              {error && (
                <div className="px-4 py-2 text-[11px] text-red-600 bg-red-50 border-t border-red-100">
                  {error}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* --------- Mobile < md：列表 / 詳情 全屏切換 --------- */}
      <div className="flex flex-1 flex-col md:hidden overflow-hidden">
        {mobileView === "detail" && activeRequest ? (
          <>
            {/* 頂部：返回 + 名字 + 狀態 */}
            <div
              className="flex items-center px-4 pt-4 pb-3 bg-white border-b"
              style={{ borderBottomColor: "var(--divider)" }}
            >
              <button
                type="button"
                onClick={() => setMobileView("list")}
                className="mr-3 flex h-8 w-8 items-center justify-center rounded-full border border-[#e4d4bd]"
              >
                <span className="text-lg text-[#4b3a2b]">‹</span>
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-[#3a3023] truncate">
                    {displayName}
                  </span>
                  {statusChip && (
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0",
                        statusChip.className
                      )}
                    >
                      {statusChip.label}
                    </span>
                  )}
                </div>
                <div className="mt-1 text-[10px] text-[#9b8773]">
                  Request Time:{" "}
                  {formatDateTime(activeRequest.createdAt)}
                </div>
              </div>
            </div>

            {/* 內容區：可滾動，底部預留給固定按鈕條 */}
            <div className="flex-1 overflow-y-auto bg-[#F9F8F6] px-6 pt-6 pb-28">
              {/* Avatar + VIP tag */}
              <div className="flex flex-col items-center mb-6">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center text-lg font-medium mb-3"
                  style={{ backgroundColor: "#F4E7D4", color: "#7A5A22" }}
                >
                  {(displayName ?? "VIP")
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2)}
                </div>
                <div className="px-3 py-1 rounded-full text-[11px] font-medium bg-[#F6E4BD] text-[#7A5A22]">
                  {activeRequest.vipNumber
                    ? `VIP | ${activeRequest.vipNumber}`
                    : "New Guest"}
                </div>
              </div>

              {/* Guest Detail / Request Info */}
              <section className="mb-6">
                <div className="text-[11px] font-semibold tracking-[0.18em] text-[#b28a4a] uppercase mb-3">
                  Guest Detail
                </div>
                <div className="space-y-1.5 text-[13px] text-[#4b3a2b]">
                  <Row
                    label="Channel"
                    value={renderChannelLabel(activeRequest.scanChannel)}
                  />
                  <Row
                    label="Open ID"
                    value={activeRequest.inputChannelIdentifier ?? "—"}
                  />
                  <Row
                    label="Nick Name"
                    value={
                      activeRequest.inputPreferredName ||
                      activeRequest.vipGuest?.preferredName ||
                      activeRequest.vipGuest?.fullName ||
                      displayName ||
                      "—"
                    }
                  />
                  <Row
                    label="Request Time"
                    value={formatDateTime(activeRequest.createdAt)}
                  />
                </div>
              </section>

              {/* Remark */}
              <section className="mb-4">
                <div className="text-[11px] font-semibold tracking-[0.18em] text-[#b28a4a] uppercase mb-3">
                  Note
                </div>
                <textarea
                  className="w-full min-h-[80px] rounded-lg border border-[#e4d4bd] bg-white px-3 py-2 text-[12px] text-[#4b3a2b] outline-none focus:ring-1 focus:ring-[#d3a65b]"
                  value={remark}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (!activeRequest) return;
                    setRemarkById((prev) => ({
                      ...prev,
                      [activeRequest.id]: v,
                    }));
                  }}
                  placeholder="Notes for acceptance / rejection (optional)"
                />
              </section>

              {/* 錯誤信息：在內容區內部顯示 */}
              {error && (
                <div className="mt-3 px-3 py-2 text-[11px] text-red-600 bg-red-50 border border-red-100 rounded-lg">
                  {error}
                </div>
              )}
            </div>

            {/* 底部行動按鈕（手機端固定在視口底部） */}
            <div
              className="fixed inset-x-0 bottom-0 z-20 flex gap-3 px-4 py-3 bg-white border-t"
              style={{ borderTopColor: "var(--divider)" }}
            >
              <button
                type="button"
                onClick={() =>
                  activeRequest && runAction(activeRequest, "REJECT")
                }
                disabled={
                  !!activeRequest && actionLoadingId === activeRequest.id
                }
                className="flex-1 px-4 py-2.5 rounded-full border text-sm font-medium disabled:opacity-60"
                style={{
                  borderColor: "#f97373",
                  color: "#b91c1c",
                  backgroundColor: "white",
                }}
              >
                {activeRequest && actionLoadingId === activeRequest.id
                  ? "Processing..."
                  : "Reject"}
              </button>
              <button
                type="button"
                onClick={() =>
                  activeRequest && runAction(activeRequest, "APPROVE")
                }
                disabled={
                  !!activeRequest && actionLoadingId === activeRequest.id
                }
                className="flex-1 px-4 py-2.5 rounded-full text-sm font-medium text-white disabled:opacity-60"
                style={{ backgroundColor: "#111111" }}
              >
                {activeRequest && actionLoadingId === activeRequest.id
                  ? "Processing..."
                  : "Approve"}
              </button>
            </div>
          </>
        ) : (
          <>
            {/* 列表視圖（手機） */}
            <div
              className="bg-[#F9F8F6] border-b"
              style={{ borderBottomColor: "var(--divider)" }}
            >
              <div className="px-4 pt-4 pb-3">
                {/* Tabs */}
                <div className="flex items-center mb-3">
                  <div className="flex items-center gap-4 overflow-x-auto no-scrollbar">
                    {renderStatusTab("PENDING", "Pending", stats.pending)}
                    {renderStatusTab("ALL", "All", stats.all)}
                    {renderStatusTab("APPROVED", "Approved", stats.approved)}
                    {renderStatusTab("REJECTED", "Rejected", stats.rejected)}
                  </div>
                </div>

                {/* Search */}
                <div className="mb-2">
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by name or VIP number..."
                    className="w-full px-3 py-2 rounded-md text-[12px] border bg-white focus:outline-none focus:ring-1"
                    style={{
                      borderColor: "var(--divider)",
                      // @ts-expect-error: css var
                      "--tw-ring-color": "var(--accent)",
                    }}
                  />
                </div>

                {/* Channel filter */}
                <div className="flex items-center gap-2">
                  <select
                    className="w-full px-3 py-1.5 rounded-md text-[11px] border bg-white"
                    style={{
                      borderColor: "var(--divider)",
                      color: "#4b3a2b",
                    }}
                    value={channelFilter}
                    onChange={(e) =>
                      setChannelFilter(e.target.value as ChannelFilter)
                    }
                  >
                    <option value="ALL">All Channel</option>
                    <option value="wechat">WeChat</option>
                    <option value="browser">Web</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 列表 */}
            <div className="flex-1 overflow-y-auto bg-[#F9F8F6]">
              {loading && !requests.length ? (
                <div className="h-full flex items-center justify-center text-xs text-gray-500">
                  Loading...
                </div>
              ) : filteredRequests.length === 0 ? (
                <div className="p-4 text-xs text-gray-500">
                  No VIP requests under this filter.
                </div>
              ) : (
                filteredRequests.map((req) => {
                  const guestName =
                    req.inputPreferredName ||
                    req.vipGuest?.preferredName ||
                    req.vipGuest?.fullName ||
                    `VIP ${req.vipNumber || "—"}`;
                  const initials = guestName
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2);

                  const chip = getStatusChipStyle(req.status);

                  return (
                    <button
                      key={req.id}
                      type="button"
                      onClick={() => handleSelectRequest(req.id)}
                      className={cn(
                        // ✅ 手機列表：高度統一、無分隔線
                        "w-full px-4 py-3 flex items-center gap-3 text-left transition-colors min-h-[92px]",
                        activeId === req.id
                          ? "bg-white"
                          : "bg-[#F9F8F6] hover:bg-black/5"
                      )}
                    >
                      <div className="flex-shrink-0">
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-medium"
                          style={{
                            backgroundColor: "var(--avatar-bg)",
                            color: "var(--accent)",
                          }}
                        >
                          {initials}
                        </div>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span
                            className="text-sm font-medium truncate"
                            style={{ color: "var(--text-primary)" }}
                          >
                            {guestName}
                          </span>
                          <span className="text-[10px] text-gray-500 ml-2 flex-shrink-0">
                            {formatTime(req.createdAt)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-gray-500 truncate">
                            {renderChannelLabel(
                              req.scanChannel
                            )}{" "}
                            ·{" "}
                            {req.vipNumber
                              ? `VIP ${req.vipNumber}`
                              : "New Guest"}
                          </span>
                          <span
                            className={cn(
                              "ml-2 px-2 py-0.5 rounded-full text-[9px] font-medium flex-shrink-0",
                              chip.className
                            )}
                          >
                            {chip.label}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {error && (
              <div className="px-4 py-2 text-[11px] text-red-600 bg-red-50 border-t border-red-100">
                {error}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// --------- 小行 Row ---------
interface RowProps {
  label: string;
  value?: string | null;
  alignRight?: boolean;
}

function Row({ label, value, alignRight }: RowProps) {
  const display = value && value !== "" ? value : "—";
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-[12px] text-[#9b8773]">{label}</span>
      <span
        className={cn(
          "text-[13px] text-[#3a3023]",
          alignRight ? "text-right" : ""
        )}
      >
        {display}
      </span>
    </div>
  );
}
