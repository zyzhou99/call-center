"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react"; // ⭐ 新增 useRef
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

  // ⭐ 後端 PendingApproval.reason，當作客服備註使用（目前 UI 不再編輯，只保留）
  reason?: string | null;

  vipGuest?: VipGuestLite | null;

  // ⭐ 决策时间（后端如果有 updatedAt 就会带上）
  updatedAt?: string | null;

  // ⭐ 新增：PendingApproval.inputPhoneNumber（後端已有）
  inputPhoneNumber?: string | null;
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
  // ⭐ 新增：當偵測到「有新的 Pending request」時，通知外層（比如 inbox 彈窗）
  onNewPendingRequest?: (latestPending: VipRequestItem) => void;
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

// ⭐ Decision Time 展示用：現在 UI 不再用，但邏輯先保留
const getDecisionTimeText = (req?: VipRequestItem | null) => {
  if (!req) return "—";
  if (req.status === "PENDING") return "Pending";
  if (req.updatedAt) return formatDateTime(req.updatedAt);
  return "—";
};

export function VipRequestsView({
  onPendingCountChange,
  onNewPendingRequest, // ⭐ 新增
}: VipRequestsViewProps) {
  const [requests, setRequests] = useState<VipRequestItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const [statusTab, setStatusTab] = useState<StatusTab>("PENDING");
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>("ALL");
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ⭐ 已存在：每一條 request 的備註（現在 UI 不再輸入，只用來讀後端歷史 reason）
  const [remarkById, setRemarkById] = useState<Record<string, string>>({});

  // ⭐ 新增：每條 request 的 Preferred Name / VIP Number 編輯值
  const [editPreferredNameById, setEditPreferredNameById] = useState<
    Record<string, string>
  >({});
  const [editVipNumberById, setEditVipNumberById] = useState<
    Record<string, string>
  >({});

  // ⭐ 手機端列表 / 詳情視圖切換，只影響 < md
  const [mobileView, setMobileView] = useState<"list" | "detail">("list");

  // ⭐ 新增：記錄「目前已知的最新 Pending request 的 createdAt」
  const lastPendingCreatedAtRef = useRef<number | null>(null);

  // ⭐ UI：尽量减少“跳动”——静默刷新前后保留列表滚动位置（只影响 UI）
  const desktopListRef = useRef<HTMLDivElement | null>(null);
  const mobileListRef = useRef<HTMLDivElement | null>(null);
  const preserveScrollTopRef = useRef<number | null>(null);

  // ------- data fetching -------

  const refresh = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = opts?.silent ?? false;

      // ✅ 仅 UI：静默刷新前记录当前列表 scrollTop，刷新后恢复
      if (silent) {
        const el =
          (desktopListRef.current as HTMLDivElement | null) ??
          (mobileListRef.current as HTMLDivElement | null);
        if (el) preserveScrollTopRef.current = el.scrollTop;
      }

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

        // ✅ 仅 UI：恢复 scrollTop（在 DOM 更新后）
        if (silent) {
          const top = preserveScrollTopRef.current;
          if (typeof top === "number") {
            requestAnimationFrame(() => {
              const el =
                (desktopListRef.current as HTMLDivElement | null) ??
                (mobileListRef.current as HTMLDivElement | null);
              if (el) el.scrollTop = top;
            });
          }
        }

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

        // ⭐ 1) 更新 Pending 數量（原有邏輯）
        const pendingList = list.filter((r) => r.status === "PENDING");
        const pendingCount = pendingList.length;
        onPendingCountChange?.(pendingCount);

        // ⭐ 2) 檢測是否有「新的 Pending request」
        // list 已經按 createdAt desc 排序，所以 pendingList[0] 就是最新
        if (pendingList.length > 0) {
          const latest = pendingList[0];
          const latestTs = new Date(latest.createdAt).getTime();
          if (!Number.isNaN(latestTs)) {
            const prev = lastPendingCreatedAtRef.current;

            if (prev === null) {
              // 第一次有數據：只做 baseline，不觸發彈窗（避免一打開頁面就被舊數據轟炸）
              lastPendingCreatedAtRef.current = latestTs;
            } else if (latestTs > prev) {
              // 出現了時間更晚的 Pending，代表有新申請
              lastPendingCreatedAtRef.current = latestTs;
              // 通知外層（inbox）可以彈出提示窗
              onNewPendingRequest?.(latest);
            }
          }
        } else {
          // 沒有 Pending 了，重置 baseline
          lastPendingCreatedAtRef.current = null;
        }

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
    [onPendingCountChange, onNewPendingRequest]
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

  // 當前這條 request 對應的備註內容（現在 UI 不再編輯，只用來保留原數據）
  const remark =
    activeRequest && remarkById[activeRequest.id]
      ? remarkById[activeRequest.id]
      : "";

  // ⭐ 當前條目的 Preferred Name / VIP Number 編輯值（帶 fallback）
  const activePreferredNameInput =
    activeRequest && activeRequest.id
      ? editPreferredNameById[activeRequest.id] ??
        activeRequest.inputPreferredName ??
        activeRequest.vipGuest?.preferredName ??
        ""
      : "";

  const activeVipNumberInput =
    activeRequest && activeRequest.id
      ? editVipNumberById[activeRequest.id] ?? activeRequest.vipNumber ?? ""
      : "";

  // ------- actions -------

    const runAction = async (
    request: VipRequestItem,
    action: "APPROVE" | "REJECT"
  ) => {
    setActionLoadingId(request.id);
    setError(null);

    // 舊的備註（目前不再在 UI 編輯，只保留給後端兼容）
    const currentRemark = remarkById[request.id] ?? "";

    // ⭐ 準備這條 request 的最終 Preferred Name / VIP Number
    const finalPreferredName = (
      editPreferredNameById[request.id] ??
      request.inputPreferredName ??
      request.vipGuest?.preferredName ??
      ""
    ).trim();

    const finalVipNumber = (
      editVipNumberById[request.id] ?? request.vipNumber ?? ""
    ).trim();

    // ⭐ 手機號暫時不在這裡編輯，就用 PendingApproval 上的 inputPhoneNumber
    const finalPhoneNumber = (request.inputPhoneNumber ?? "").trim();

    try {
      const res = await fetch(
        `/api/vip/approvals/${encodeURIComponent(request.id)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            // 保留原來的 reason 傳遞（若為空就不寫）
            reason: currentRemark || undefined,
            // ✅ 用我們後端新加的三個字段名字
            inputVipNumber: finalVipNumber || undefined,
            inputPreferredName: finalPreferredName || undefined,
            inputPhoneNumber: finalPhoneNumber || undefined,
          }),
        }
      );
      const data = await res.json();
      if (!data?.ok) {
        throw new Error(data?.error ?? "ACTION_FAILED");
      }

      // ⭐ 如果是 APPROVE：跳轉到 vip-list-view 裡對應用戶
      if (action === "APPROVE") {
        const vipToOpen =
          finalVipNumber ||
          request.vipNumber ||
          (request.vipGuest?.fullName ?? "");

        try {
          // 讓 Inbox 重載後直接切到 vipContacts
          if (typeof window !== "undefined") {
            window.localStorage.setItem("cc_active_channel", "vipContacts");
          }
        } catch {
          // 忽略 localStorage 異常
        }

        if (typeof window !== "undefined") {
          const params = new URLSearchParams();
          if (vipToOpen) {
            params.set("vipNumber", vipToOpen);
          }
          const qs = params.toString();
          window.location.href = qs ? `/inbox?${qs}` : "/inbox";
          return; // 不再留在當前頁面
        }
      }

      // ⭐ 其他情況（例如 REJECT）：仍然刷新列表
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

  const getPhoneLabelValue = (req: VipRequestItem | null) => {
    if (!req) return "—";
    // 優先用 inputPhoneNumber（來自 PendingApproval）
    if (req.inputPhoneNumber && req.inputPhoneNumber.trim()) {
      return req.inputPhoneNumber.trim();
    }
    return "—";
  };

  // ⭐ Tabs：选中时文字变深+底下金色横线
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
        className="relative flex flex-col items-center px-1 pb-1 text-[12px] font-medium whitespace-nowrap"
      >
        <span
          className={cn(
            isActive
              ? "text-[#3a3023]"
              : "text-[#b49b7b] hover:text-[#3a3023]"
          )}
        >
          {label}{" "}
          <span className="text-[10px] opacity-70">{`(${count})`}</span>
        </span>
        <span
          className={cn(
            "mt-1 h-[2px] rounded-full transition-all",
            isActive ? "w-6" : "w-0"
          )}
          style={isActive ? { backgroundColor: "#d6ae5a" } : {}}
        />
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

  // ⭐ UI：已处理就隐藏按钮（不改任何业务逻辑）
  const isDecided = !!activeRequest && activeRequest.status !== "PENDING";

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
      {/* --------- Desktop ≥ md：左右布局 --------- */}
      <div className="hidden md:flex flex-1 overflow-hidden">
        {/* 左側列表（宽度 w-96 对齐其他页面） */}
        <div
          className="relative z-10 w-96 flex flex-col"
          style={{
            backgroundColor: "#F9F8F6",
            borderRight: "1px solid var(--divider)",
          }}
        >
          {/* header：对齐 vip-list-view 风格 */}
          <div className="p-4" style={{ backgroundColor: "#F9F8F6" }}>
            {/* 搜索框 */}
            <div className="mb-3">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or VIP number..."
                className="w-full px-4 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-opacity-20"
                style={{
                  backgroundColor: "#FFFFFF",
                  border: "1px solid var(--divider)",
                  color: "var(--text-primary)",
                  // @ts-expect-error: css var
                  "--tw-ring-color": "var(--accent)",
                }}
              />
            </div>

            {/* Channel filter */}
            <div className="flex items-center gap-2 mb-3">
              <select
                className="w-full px-3 py-2.5 rounded-lg text-sm border bg-white focus:outline-none focus:ring-2 focus:ring-opacity-20"
                style={{
                  borderColor: "var(--divider)",
                  color: "var(--text-primary)",
                  // @ts-expect-error: css var
                  "--tw-ring-color": "var(--accent)",
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

            {/* Tabs */}
            <div className="flex items-center gap-4 overflow-x-auto no-scrollbar">
              {renderStatusTab("PENDING", "Pending", stats.pending)}
              {renderStatusTab("ALL", "All", stats.all)}
              {renderStatusTab("APPROVED", "Approve", stats.approved)}
              {renderStatusTab("REJECTED", "Reject", stats.rejected)}
            </div>

            {(loading || error) && (
              <div className="mt-2 text-[11px]" style={{ color: "#9B8773" }}>
                {loading && !requests.length && <span>Loading...</span>}
                {!loading && error && <span>{error}</span>}
              </div>
            )}
          </div>

          {/* 列表區域 */}
          <div ref={desktopListRef} className="flex-1 overflow-y-auto">
            {loading && !requests.length ? (
              <div className="h-full flex items-center justify-center text-xs text-gray-500">
                Loading...
              </div>
            ) : filteredRequests.length === 0 ? (
              <div
                className="px-4 py-4 text-[12px]"
                style={{ color: "#9B8773" }}
              >
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
                const isActive = activeId === req.id;

                return (
                  <button
                    key={req.id}
                    type="button"
                    onClick={() => handleSelectRequest(req.id)}
                    className={cn(
                      "w-full px-4 flex items-center gap-3 text-left transition-colors",
                      "h-[76px]",
                      isActive ? "bg-white" : "hover:bg:black/5 hover:bg-black/5"
                    )}
                  >
                    <div className="flex-shrink-0">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-[12px] font-medium"
                        style={{
                          backgroundColor: "var(--avatar-bg)",
                          color: "var(--accent)",
                        }}
                      >
                        {initials}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span
                          className="text-[14px] font-medium truncate"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {guestName}
                        </span>
                        <span className="text-[10px] text-gray-500 ml-2 flex-shrink-0">
                          {formatTime(req.createdAt)}
                        </span>
                      </div>

                      {/* ⭐ 第二行只展示来源 Channel */}
                      <div className="mt-1 flex items-center justify-between">
                        <span className="text-[12px] text-gray-500 truncate">
                          {renderChannelLabel(req.scanChannel)}
                        </span>
                        <span
                          className={cn(
                            "ml-2 px-2 py-0.5 rounded-md text-[9px] font-medium flex-shrink-0",
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
              {/* 顶部栏 */}
              <div
                className="px-8 py-5 bg-white border-b"
                style={{ borderBottomColor: "var(--divider)" }}
              >
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold text-[#3a3023]">
                    {displayName}
                  </h2>
                  {statusChip && (
                    <span
                      className={cn(
                        "px-3 py-1 rounded-md text-[11px] font-medium",
                        statusChip.className
                      )}
                    >
                      {statusChip.label}
                    </span>
                  )}
                </div>
              </div>

              {/* 内容滚动区 */}
              <div className="flex-1 overflow-y-auto">
                {/* 中央 avatar + 名字 */}
                <div className="pt-14 pb-8">
                  <div className="flex flex-col items-center">
                    <div
                      className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-semibold"
                      style={{ backgroundColor: "#F4E7D4", color: "#7A5A22" }}
                    >
                      {(displayName ?? "VIP")
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2) || "?"}
                    </div>
                    <div className="mt-4 text-[22px] font-semibold text-[#3a3023]">
                      {displayName}
                    </div>

                    <div className="mt-2 px-10 py-2 rounded-md text-[12px] text-[#9b8773] bg-[#F3F2EF]">
                      {activeRequest.vipNumber
                        ? `VIP ${activeRequest.vipNumber}`
                        : "none"}
                    </div>
                  </div>
                </div>

                {/* GUEST DETAIL 表格 */}
                <div className="px-16">
                  <div className="text-[11px] font-semibold tracking-[0.18em] text-[#b28a4a] uppercase mb-3">
                    Request Detail
                  </div>

                  {/* ⭐ 桌面表格：Channel / Phone Number / Open ID / Request Time */}
                  <DetailTable>
                    <DetailCell
                      label="Channel"
                      value={renderChannelLabel(activeRequest.scanChannel)}
                    />
                    <DetailCell
                      label="Phone Number"
                      value={getPhoneLabelValue(activeRequest)}
                    />
                    <DetailCell
                      label="Channel Identifier"
                      value={activeRequest.inputChannelIdentifier ?? "—"}
                    />
                    <DetailCell
                      label="Request Time"
                      value={formatDateTime(activeRequest.createdAt)}
                    />
                  </DetailTable>

                  {/* ⭐ 新區塊：讓客服填 Preferred Name / VIP Number */}
                  <div className="mt-10 text-[11px] font-semibold tracking-[0.18em] text-[#b28a4a] uppercase mb-3">
                    VIP Info
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="w-40 text-[12px] text-[#9b8773]">
                        Preferred Name
                      </div>
                      <input
                        className="flex-1 px-4 py-2.5 rounded-md border bg-white text-[13px] text-[#3a3023] outline-none focus:ring-2 focus:ring-opacity-20"
                        style={{
                          borderColor: "var(--divider)",
                          // @ts-expect-error: css var
                          "--tw-ring-color": "var(--accent)",
                        }}
                        value={activePreferredNameInput}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (!activeRequest) return;
                          setEditPreferredNameById((prev) => ({
                            ...prev,
                            [activeRequest.id]: v,
                          }));
                        }}
                        placeholder="e.g. Joye"
                      />
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="w-40 text-[12px] text-[#9b8773]">
                        VIP Number
                      </div>
                      <input
                        className="flex-1 px-4 py-2.5 rounded-md border bg-white text-[13px] text-[#3a3023] outline-none focus:ring-2 focus:ring-opacity-20"
                        style={{
                          borderColor: "var(--divider)",
                          // @ts-expect-error: css var
                          "--tw-ring-color": "var(--accent)",
                        }}
                        value={activeVipNumberInput}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (!activeRequest) return;
                          setEditVipNumberById((prev) => ({
                            ...prev,
                            [activeRequest.id]: v,
                          }));
                        }}
                        placeholder="e.g. 10001"
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="mt-4 px-3 py-2 text-[11px] text-red-600 bg-red-50 border border-red-100 rounded-lg">
                      {error}
                    </div>
                  )}
                </div>

                <div className="h-16" />
              </div>

              {/* ✅ 已处理就隐藏按钮条 */}
              {!isDecided && (
                <div
                  className="px-16 py-5 bg-white border-t shrink-0"
                  style={{ borderTopColor: "var(--divider)" }}
                >
                  <div className="flex justify-end gap-6">
                    <button
                      type="button"
                      onClick={() =>
                        activeRequest && runAction(activeRequest, "REJECT")
                      }
                      disabled={
                        !!activeRequest && actionLoadingId === activeRequest.id
                      }
                      className="w-52 h-11 rounded-md border text-[15px] font-medium disabled:opacity-50"
                      style={{
                        borderColor: "#f97373",
                        color: "#b91c1c",
                        backgroundColor: "white",
                      }}
                    >
                      {!!activeRequest && actionLoadingId === activeRequest.id
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
                      className="w-52 h-11 rounded-md text-[15px] font-medium text-white disabled:opacity-50"
                      style={{ backgroundColor: "#111111" }}
                    >
                      {!!activeRequest && actionLoadingId === activeRequest.id
                        ? "Processing..."
                        : "Approve"}
                    </button>
                  </div>
                </div>
              )}
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
                  Request Time: {formatDateTime(activeRequest.createdAt)}
                </div>
              </div>
            </div>

            {/* 內容區 */}
            <div className="flex-1 overflow-y-auto bg-[#FFFFFF] px-4 pt-6 pb-28">
              {/* 中央 avatar + 名字 */}
              <div className="flex flex-col items-center mb-6">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-semibold mb-3"
                  style={{ backgroundColor: "#F4E7D4", color: "#7A5A22" }}
                >
                  {(displayName ?? "VIP")
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2) || "?"}
                </div>
                <div className="text-[18px] font-semibold text-[#3a3023]">
                  {displayName}
                </div>
                <div className="mt-2 px-6 py-2 rounded-md text-[12px] text-[#9b8773] bg-[#F3F2EF]">
                  {activeRequest.vipNumber
                    ? `VIP ${activeRequest.vipNumber}`
                    : "none"}
                </div>
              </div>

              {/* ✅ Mobile：字段一行一个（Channel / Phone / Channel Id / Request Time） */}
              <div className="text-[11px] font-semibold tracking-[0.18em] text-[#b28a4a] uppercase mb-3">
                Guest Detail
              </div>

              <MobileDetailList>
                <MobileDetailRow
                  label="Channel"
                  value={renderChannelLabel(activeRequest.scanChannel)}
                />
                <MobileDetailRow
                  label="Phone Number"
                  value={getPhoneLabelValue(activeRequest)}
                />
                <MobileDetailRow
                  label="Channel Identifier"
                  value={activeRequest.inputChannelIdentifier ?? "—"}
                />
                <MobileDetailRow
                  label="Request Time"
                  value={formatDateTime(activeRequest.createdAt)}
                />
              </MobileDetailList>

              {/* ⭐ Mobile：Preferred Name / VIP Number 編輯 */}
              <div className="mt-8 text-[11px] font-semibold tracking-[0.18em] text-[#b28a4a] uppercase mb-3">
                VIP Info (for confirmation)
              </div>

              <div className="space-y-4">
                <div className="flex flex-col gap-1">
                  <span className="text-[12px] text-[#9b8773]">
                    Preferred Name
                  </span>
                  <input
                    className="w-full px-4 py-2.5 rounded-md border bg-white text-[13px] text-[#3a3023] outline-none focus:ring-2 focus:ring-opacity-20"
                    style={{
                      borderColor: "var(--divider)",
                      // @ts-expect-error: css var
                      "--tw-ring-color": "var(--accent)",
                    }}
                    value={activePreferredNameInput}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (!activeRequest) return;
                      setEditPreferredNameById((prev) => ({
                        ...prev,
                        [activeRequest.id]: v,
                      }));
                    }}
                    placeholder="e.g. Joye"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[12px] text-[#9b8773]">
                    VIP Number
                  </span>
                  <input
                    className="w-full px-4 py-2.5 rounded-md border bg-white text-[13px] text-[#3a3023] outline-none focus:ring-2 focus:ring-opacity-20"
                    style={{
                      borderColor: "var(--divider)",
                      // @ts-expect-error: css var
                      "--tw-ring-color": "var(--accent)",
                    }}
                    value={activeVipNumberInput}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (!activeRequest) return;
                      setEditVipNumberById((prev) => ({
                        ...prev,
                        [activeRequest.id]: v,
                      }));
                    }}
                    placeholder="e.g. 10001"
                  />
                </div>
              </div>

              {error && (
                <div className="mt-3 px-3 py-2 text-[11px] text-red-600 bg-red-50 border border-red-100 rounded-lg">
                  {error}
                </div>
              )}
            </div>

            {/* ✅ Mobile：已处理就隐藏底部按钮 */}
            {!isDecided && (
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
                  className="flex-1 h-11 rounded-md border text-[15px] font-medium disabled:opacity-50"
                  style={{
                    borderColor: "#f97373",
                    color: "#b91c1c",
                    backgroundColor: "white",
                  }}
                >
                  {!!activeRequest && actionLoadingId === activeRequest.id
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
                  className="flex-1 h-11 rounded-md text-[15px] font-medium text-white disabled:opacity-50"
                  style={{ backgroundColor: "#111111" }}
                >
                  {!!activeRequest && actionLoadingId === activeRequest.id
                    ? "Processing..."
                    : "Approve"}
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            {/* 列表視圖（手機） */}
            <div className="p-4" style={{ backgroundColor: "#F9F8F6" }}>
              {/* 搜索 */}
              <div className="mb-3">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or VIP number..."
                  className="w-full px-4 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-opacity-20"
                  style={{
                    backgroundColor: "#FFFFFF",
                    border: "1px solid var(--divider)",
                    color: "var(--text-primary)",
                    // @ts-expect-error: css var
                    "--tw-ring-color": "var(--accent)",
                  }}
                />
              </div>

              {/* filter */}
              <div className="mb-3">
                <select
                  className="w-full px-3 py-2.5 rounded-lg text-sm border bg-white focus:outline-none focus:ring-2 focus:ring-opacity-20"
                  style={{
                    borderColor: "var(--divider)",
                    color: "var(--text-primary)",
                    // @ts-expect-error: css var
                    "--tw-ring-color": "var(--accent)",
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

              {/* Tabs */}
              <div className="flex items-center gap-4 overflow-x-auto no-scrollbar">
                {renderStatusTab("PENDING", "Pending", stats.pending)}
                {renderStatusTab("ALL", "All", stats.all)}
                {renderStatusTab("APPROVED", "Approve", stats.approved)}
                {renderStatusTab("REJECTED", "Reject", stats.rejected)}
              </div>
            </div>

            {/* 列表 */}
            <div
              ref={mobileListRef}
              className="flex-1 overflow-y-auto"
              style={{ backgroundColor: "#F9F8F6" }}
            >
              {loading && !requests.length ? (
                <div className="h-full flex items-center justify-center text-xs text-gray-500">
                  Loading...
                </div>
              ) : filteredRequests.length === 0 ? (
                <div
                  className="px-4 py-4 text-[12px]"
                  style={{ color: "#9B8773" }}
                >
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
                  const isActive = activeId === req.id;

                  return (
                    <button
                      key={req.id}
                      type="button"
                      onClick={() => handleSelectRequest(req.id)}
                      className={cn(
                        "w-full px-4 flex items-center gap-3 text-left transition-colors",
                        "h-[76px]",
                        isActive ? "bg-white" : "hover:bg-black/5"
                      )}
                    >
                      <div className="flex-shrink-0">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-[12px] font-medium"
                          style={{
                            backgroundColor: "var(--avatar-bg)",
                            color: "var(--accent)",
                          }}
                        >
                          {initials}
                        </div>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span
                            className="text-[14px] font-medium truncate"
                            style={{ color: "var(--text-primary)" }}
                          >
                            {guestName}
                          </span>
                          <span className="text-[10px] text-gray-500 ml-2 flex-shrink-0">
                            {formatTime(req.createdAt)}
                          </span>
                        </div>

                        {/* ⭐ 第二行只展示来源 Channel */}
                        <div className="mt-1 flex items-center justify-between">
                          <span className="text-[12px] text-gray-500 truncate">
                            {renderChannelLabel(req.scanChannel)}
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

              {error && (
                <div className="px-4 py-2 text-[11px] text-red-600 bg-red-50 border-t border-red-100">
                  {error}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** --------- Desktop 表格 UI（只做展示，不改字段/逻辑） --------- */
function DetailTable({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="grid grid-cols-4 border rounded-md overflow-hidden"
      style={{ borderColor: "var(--divider)", backgroundColor: "#FFFFFF" }}
    >
      {children}
    </div>
  );
}

function DetailCell({ label, value }: { label: string; value?: string | null }) {
  const display = value && value !== "" ? value : "—";
  return (
    <>
      <div
        className="px-4 py-3 text-[13px] font-medium border-r border-b"
        style={{
          borderColor: "var(--divider)",
          backgroundColor: "#FAF9F7",
          color: "#3a3023",
        }}
      >
        {label}
      </div>
      <div
        className="px-4 py-3 text-[13px] border-b"
        style={{
          borderColor: "var(--divider)",
          color: "#3a3023",
          backgroundColor: "#FFFFFF",
        }}
      >
        {display}
      </div>
    </>
  );
}

/** --------- Mobile：一行一个字段 --------- */
function MobileDetailList({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-md border overflow-hidden bg-white"
      style={{ borderColor: "var(--divider)" }}
    >
      {children}
    </div>
  );
}

function MobileDetailRow({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  const display = value && value !== "" ? value : "—";
  return (
    <div
      className="flex items-center justify-between px-4 py-3 border-b"
      style={{ borderBottomColor: "var(--divider)" }}
    >
      <span className="text-[12px] font-medium text-[#3a3023]">{label}</span>
      <span className="text-[12px] text-[#6b5a4a] ml-4 truncate max-w-[60%] text-right">
        {display}
      </span>
    </div>
  );
}

// --------- 小行 Row（保留，当前文件里其他地方也可能复用） ---------
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
