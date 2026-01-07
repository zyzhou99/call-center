"use client";

import { useEffect, useMemo, useState } from "react";
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

export function VipRequestsView({ onPendingCountChange }: VipRequestsViewProps) {
  const [requests, setRequests] = useState<VipRequestItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const [statusTab, setStatusTab] = useState<StatusTab>("PENDING");
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>("ALL");
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ------- helpers -------

  const formatDate = (iso?: string | null) => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toISOString().slice(0, 10);
  };

  const formatTime = (iso?: string | null) => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const formatBirthday = (md?: string | null) => {
    if (!md) return "—";
    const s = md.replace(/\D/g, "").padStart(4, "0");
    return `${s.slice(0, 2)}-${s.slice(2)}`;
  };

  const getStatusChipStyle = (status: VipRequestStatus) => {
    switch (status) {
      case "PENDING":
        return {
          label: "PENDING",
          className: "bg-[#F6E4BD] text-[#7A5A22]",
        };
      case "APPROVED":
        return {
          label: "APPROVED",
          className: "bg-[#D5F3CC] text-[#296526]",
        };
      case "REJECTED":
        return {
          label: "REJECTED",
          className: "bg-[#FDE2E0] text-[#B91C1C]",
        };
      case "EXPIRED":
        return {
          label: "EXPIRED",
          className: "bg-gray-200 text-gray-600",
        };
      default:
        return {
          label: status,
          className: "bg-gray-200 text-gray-600",
        };
    }
  };

  // ------- data fetching -------

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/vip/approvals");
      const data: VipApprovalsApiResponse = await res.json();

      if (!data?.ok) {
        throw new Error(data?.error ?? "REQUEST_FAILED");
      }

      const list: VipRequestItem[] =
        (Array.isArray(data.items) ? data.items : data.approvals) ?? [];

      // 最新的在上面
      list.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      setRequests(list);

      const pendingCount = list.filter((r) => r.status === "PENDING").length;
      onPendingCountChange?.(pendingCount);

      // 没有选中的时候默认选第一条
      if (!activeId && list.length > 0) {
        setActiveId(list[0].id);
      }
    } catch (e) {
      console.error("load vip approvals failed:", e);
      setError("Failed to load VIP requests.");
    } finally {
      setLoading(false);
      setActionLoadingId(null);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 如果列表本身变化了，也同步更新 pending 数
  useEffect(() => {
    const pendingCount = requests.filter((r) => r.status === "PENDING").length;
    onPendingCountChange?.(pendingCount);
  }, [requests, onPendingCountChange]);

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

  const activeRequest: VipRequestItem | null = useMemo(() => {
    if (!requests.length) return null;

    const byId =
      requests.find((r) => r.id === activeId) ??
      filteredRequests[0] ??
      requests[0];

    return byId ?? null;
  }, [requests, filteredRequests, activeId]);

  useEffect(() => {
    if (!activeRequest && filteredRequests.length > 0) {
      setActiveId(filteredRequests[0].id);
    }
  }, [activeRequest, filteredRequests]);

  // ------- actions -------

  const runAction = async (
    request: VipRequestItem,
    action: "APPROVE" | "REJECT"
  ) => {
    setActionLoadingId(request.id);
    setError(null);
    try {
      const res = await fetch(
        `/api/vip/approvals/${encodeURIComponent(request.id)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        }
      );
      const data = await res.json();
      if (!data?.ok) {
        throw new Error(data?.error ?? "ACTION_FAILED");
      }

      // 動作完成後重新拉列表（會帶動小紅點更新）
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
          "px-2.5 py-1 text-[11px] rounded-full transition-colors",
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

  // ------- UI -------

  return (
    <div
      className="flex flex-1 overflow-hidden"
      style={{ backgroundColor: "#FAF7F1" }}
    >
      {/* 左側列表 */}
      <div
        className="relative z-10 w-96 flex flex-col border-r"
        style={{
          backgroundColor: "#F9F8F6",
          borderRightColor: "var(--divider)",
        }}
      >
        {/* 頂部標題 + tabs + channel filter */}
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
              {renderStatusTab("APPROVED", "Approve", stats.approved)}
              {renderStatusTab("REJECTED", "Reject", stats.rejected)}
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
                "--tw-ring-color": "var(--accent)",
              } as React.CSSProperties}
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
                `VIP ${req.vipNumber}`;
              const initials = guestName
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2);

              const statusChip = getStatusChipStyle(req.status);

              return (
                <button
                  key={req.id}
                  type="button"
                  onClick={() => setActiveId(req.id)}
                  className={cn(
                    "w-full px-4 py-3 flex items-center gap-3 text-left transition-colors",
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
                        {renderChannelLabel(req.scanChannel)} · VIP{" "}
                        {req.vipNumber}
                      </span>
                      <span
                        className={cn(
                          "ml-2 px-2 py-0.5 rounded-full text-[9px] font-medium flex-shrink-0",
                          statusChip.className
                        )}
                      >
                        {statusChip.label}
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
            {/* 上半身：大頭像 + 名字 + 狀態 */}
            <div className="px-16 pt-10 pb-4">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold text-[#3a3023]">
                    {activeRequest.inputPreferredName ||
                      activeRequest.vipGuest?.preferredName ||
                      activeRequest.vipGuest?.fullName ||
                      `VIP ${activeRequest.vipNumber}`}
                  </h2>
                  <span
                    className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-medium",
                      getStatusChipStyle(activeRequest.status).className
                    )}
                  >
                    {getStatusChipStyle(activeRequest.status).label}
                  </span>
                </div>
              </div>

              <div className="flex flex-col items-center mt-4 mb-8">
                <div
                  className="w-20 h-20 rounded-full flex items-center justify-center text-xl font-medium mb-3"
                  style={{ backgroundColor: "#F4E7D4", color: "#7A5A22" }}
                >
                  {(
                    activeRequest.inputPreferredName ||
                    activeRequest.vipGuest?.preferredName ||
                    activeRequest.vipGuest?.fullName ||
                    "VIP"
                  )
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2)}
                </div>
                <div className="text-sm text-[#8b7561] mb-1">
                  {activeRequest.vipGuest?.statusLabel || "Not Checked In"}
                </div>
                <div className="px-3 py-1 rounded-full text-[10px] font-medium bg-[#F6E4BD] text-[#7A5A22]">
                  VIP
                </div>
              </div>

              {/* 下半：兩欄信息 */}
              <div className="grid grid-cols-2 gap-16 text-[13px] text-[#4b3a2b]">
                {/* Guest Details */}
                <div>
                  <div className="text-[11px] font-semibold tracking-[0.2em] text-[#b28a4a] uppercase mb-3">
                    Guest Details
                  </div>
                  <div className="space-y-2">
                    <Row label="VIP Number" value={activeRequest.vipNumber} />
                    <Row
                      label="Birthday (input)"
                      value={formatBirthday(activeRequest.inputBirthdayMd)}
                    />
                    <Row
                      label="Channel"
                      value={renderChannelLabel(activeRequest.scanChannel)}
                    />
                    <Row
                      label="Request Time"
                      value={formatTime(activeRequest.createdAt)}
                    />
                  </div>
                </div>

                {/* PMS Match */}
                <div>
                  <div className="text-[11px] font-semibold tracking-[0.2em] text-[#b28a4a] uppercase mb-3">
                    System Match (PMS)
                  </div>
                  <div className="space-y-2">
                    <Row
                      label="Guest Status"
                      value={activeRequest.vipGuest?.statusLabel ?? "Not Checked in"}
                      alignRight
                    />
                    <Row
                      label="Member Tier"
                      value={activeRequest.vipGuest?.tier ?? "—"}
                      alignRight
                    />
                    <Row
                      label="Room"
                      value={activeRequest.vipGuest?.room ?? "—"}
                      alignRight
                    />
                    <Row
                      label="Check-in Date"
                      value={formatDate(activeRequest.vipGuest?.checkInDate)}
                      alignRight
                    />
                    <Row
                      label="Check-out Date"
                      value={formatDate(activeRequest.vipGuest?.checkOutDate)}
                      alignRight
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 底部行動按鈕 */}
            <div
              className="mt-auto px-16 py-4 border-t bg-white"
              style={{ borderTopColor: "var(--divider)" }}
            >
              <div className="flex justify-end gap-4">
                <button
                  type="button"
                  onClick={() => runAction(activeRequest, "REJECT")}
                  disabled={actionLoadingId === activeRequest.id}
                  className="px-8 py-2.5 rounded-full border text-sm font-medium disabled:opacity-60"
                  style={{
                    borderColor: "#f97373",
                    color: "#b91c1c",
                    backgroundColor: "white",
                  }}
                >
                  {actionLoadingId === activeRequest.id
                    ? "Processing..."
                    : "Reject"}
                </button>
                <button
                  type="button"
                  onClick={() => runAction(activeRequest, "APPROVE")}
                  disabled={actionLoadingId === activeRequest.id}
                  className="px-8 py-2.5 rounded-full text-sm font-medium text-white disabled:opacity-60"
                  style={{ backgroundColor: "#111111" }}
                >
                  {actionLoadingId === activeRequest.id
                    ? "Processing..."
                    : "Approve"}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm text-gray-500">
            No VIP request selected.
          </div>
        )}

        {error && (
          <div className="px-4 py-2 text-[11px] text-red-600 bg-red-50 border-t border-red-100">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

// 小行 Row，用在右側兩欄
interface RowProps {
  label: string;
  value: string;
  alignRight?: boolean;
}

function Row({ label, value, alignRight }: RowProps) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-[12px] text-[#9b8773]">{label}</span>
      <span
        className={cn(
          "text-[13px] text-[#3a3023]",
          alignRight ? "text-right" : ""
        )}
      >
        {value}
      </span>
    </div>
  );
}
