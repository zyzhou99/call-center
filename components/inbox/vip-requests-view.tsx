"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";

type VersionType = "hybrid" | "h5";
type EntryMode = "wecom" | "h5";
type ScanChannel = "wechat" | "browser";
type VipRequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";
type SourceFilter = "all" | "wechat" | "web" | "whatsapp" | "line";
type StatusFilter = "pending" | "approved" | "rejected" | "all";

interface VipGuestInfo {
  fullName: string | null;
  preferredName: string | null;
  birthdayMd: string | null;
  tier: string | null;
  room: string | null;
  statusLabel: string | null;
}

interface VipRequestApi {
  id: string;
  vipNumber: string;
  status: VipRequestStatus;
  version: VersionType;
  entryMode: EntryMode;
  scanChannel: ScanChannel;
  createdAt: string;
  inputPreferredName: string | null;
  inputBirthdayMd: string | null;
  vipGuest: VipGuestInfo | null;
}

interface VipRequestsResponse {
  ok: boolean;
  items: VipRequestApi[];
  error?: string;
}

function getSourceFromRequest(r: VipRequestApi): "wechat" | "web" {
  if (r.entryMode === "wecom") return "wechat";
  return "web";
}

function formatTimeLabel(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatBirthday(birthdayMd: string | null) {
  if (!birthdayMd) return "—";
  const digits = birthdayMd.replace(/\D/g, "").padStart(4, "0");
  return `${digits.slice(0, 2)}-${digits.slice(2)}`;
}

function formatStatusLabel(status: VipRequestStatus) {
  if (status === "PENDING") return "PENDING";
  if (status === "APPROVED") return "APPROVED";
  if (status === "REJECTED") return "REJECTED";
  return "EXPIRED";
}

export function VipRequestsView({
  onPendingCountChange,
}: {
  onPendingCountChange?: (pending: number) => void;
}) {
  const [requests, setRequests] = useState<VipRequestApi[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [decisionLoading, setDecisionLoading] = useState(false);

  // 拉列表
  useEffect(() => {
    let cancelled = false;

    async function fetchRequests() {
      setLoading(true);
      setErrorMsg(null);
      try {
        const res = await fetch("/api/vip/approvals");
        const data: VipRequestsResponse = await res.json();

        if (!data.ok) {
          setErrorMsg("Failed to load VIP requests.");
          setLoading(false);
          return;
        }

        if (cancelled) return;

        setRequests(data.items);
        if (data.items.length > 0) {
          setActiveId(data.items[0].id);
        }
        setLoading(false);
      } catch (err) {
        console.error(err);
        if (cancelled) return;
        setErrorMsg("Network error. Please try again.");
        setLoading(false);
      }
    }

    fetchRequests();
    return () => {
      cancelled = true;
    };
  }, []);

  const pendingCount = useMemo(
    () => requests.filter((r) => r.status === "PENDING").length,
    [requests]
  );
  useEffect(() => {
    if (onPendingCountChange) {
      onPendingCountChange(pendingCount);
    }
  }, [pendingCount, onPendingCountChange]);
  const approvedCount = useMemo(
    () => requests.filter((r) => r.status === "APPROVED").length,
    [requests]
  );
  const rejectedCount = useMemo(
    () => requests.filter((r) => r.status === "REJECTED").length,
    [requests]
  );

  const filteredRequests = useMemo(() => {
    let list = requests;

    // 状态过滤
    list = list.filter((r) => {
      if (statusFilter === "pending") return r.status === "PENDING";
      if (statusFilter === "approved") return r.status === "APPROVED";
      if (statusFilter === "rejected") return r.status === "REJECTED";
      return true; // all
    });

    // 渠道过滤
    list = list.filter((r) => {
      if (sourceFilter === "all") return true;
      const src = getSourceFromRequest(r);
      if (sourceFilter === "wechat") return src === "wechat";
      if (sourceFilter === "web") return src === "web";
      // whatsapp / line 目前沒有實際數據，先全部擋掉
      if (sourceFilter === "whatsapp" || sourceFilter === "line") return false;
      return true;
    });

    // 搜索过滤：名字 / VIP 号 / 渠道
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((r) => {
        const displayName =
          r.inputPreferredName ||
          r.vipGuest?.preferredName ||
          r.vipGuest?.fullName ||
          "";
        const vipNumber = r.vipNumber || "";
        const channelLabel =
          getSourceFromRequest(r) === "wechat" ? "wechat" : "web";

        return (
          displayName.toLowerCase().includes(q) ||
          vipNumber.toLowerCase().includes(q) ||
          channelLabel.includes(q)
        );
      });
    }

    return list;
  }, [requests, statusFilter, sourceFilter, searchQuery]);

  const activeRequest =
    filteredRequests.find((r) => r.id === activeId) || filteredRequests[0];

  // 如果目前 activeId 不在 filtered 裡，跟著調整一下
  useEffect(() => {
    if (!activeRequest && filteredRequests.length > 0) {
      setActiveId(filteredRequests[0].id);
    }
  }, [activeRequest, filteredRequests]);

  async function handleDecision(action: "APPROVE" | "REJECT") {
    if (!activeRequest) return;
    setDecisionLoading(true);
    try {
      const res = await fetch(`/api/vip/approvals/${activeRequest.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      const data = (await res.json()) as {
        ok: boolean;
        item?: VipRequestApi;
        error?: string;
      };

      if (!data.ok || !data.item) {
        console.error("Decision failed:", data.error);
        setDecisionLoading(false);
        return;
      }

      setRequests((prev) =>
        prev.map((r) => (r.id === data.item!.id ? data.item! : r))
      );
      setDecisionLoading(false);
    } catch (err) {
      console.error(err);
      setDecisionLoading(false);
    }
  }

  // ====== 左侧列表 UI ======
  return (
    <div className="flex flex-1 bg-[#F6F3EE]">
      {/* 左侧 Request 列表：样式对齐 ConversationListPanel */}
      <div
        className="w-96 flex flex-col relative z-10"
        style={{
          backgroundColor: "#F9F8F6",
          borderRight: "1px solid var(--divider)",
        }}
      >
        {/* 顶部：标题 + 状态 tabs + 渠道筛选 + 搜索框 */}
        <div
          className="px-4 pt-4 pb-2"
          style={{ backgroundColor: "#F9F8F6" }}
        >
          {/* <div className="flex items-center justify-between mb-2">
            <div
              className="text-sm font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              VIP Requests
            </div>
          </div> */}

          {/* 搜索框（只搜本列表） */}
          <div className="relative mb-2">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
              style={{ color: "var(--text-secondary)" }}
            />
            <input
              type="text"
              placeholder="Search by name or VIP number"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-opacity-20"
              style={{
                backgroundColor: "#FFFFFF",
                border: "1px solid var(--divider)",
                color: "var(--text-primary)",
                "--tw-ring-color": "var(--accent)",
              } as React.CSSProperties}
            />
          </div>

          {/* 渠道筛选 */}
          <div className="mb-4">
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value as SourceFilter)}
              className="w-full rounded-lg border px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-opacity-20"
              style={{
                backgroundColor: "#FFFFFF",
                borderColor: "var(--divider)",
                color: "var(--text-primary)",
                "--tw-ring-color": "var(--accent)",
              } as React.CSSProperties}
            >
              <option value="all">All Channel</option>
              <option value="wechat">WeChat</option>
              <option value="web">Web</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="line">Line</option>
            </select>
          </div>

          {/* 状态 tabs */}
          <div className="flex text-[11px] mb-3 space-x-4">
            <button
              type="button"
              onClick={() => setStatusFilter("pending")}
              className={`pb-1 border-b-2 ${
                statusFilter === "pending"
                  ? "border-[#c99c53]"
                  : "border-transparent"
              }`}
              style={{
                color:
                  statusFilter === "pending"
                    ? "var(--text-primary)"
                    : "var(--text-secondary)",
              }}
            >
              Pending ({pendingCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={`pb-1 border-b-2 ${
                statusFilter === "all"
                  ? "border-[#c99c53]"
                  : "border-transparent"
              }`}
              style={{
                color:
                  statusFilter === "all"
                    ? "var(--text-primary)"
                    : "var(--text-secondary)",
              }}
            >
              All ({requests.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("approved")}
              className={`pb-1 border-b-2 ${
                statusFilter === "approved"
                  ? "border-[#c99c53]"
                  : "border-transparent"
              }`}
              style={{
                color:
                  statusFilter === "approved"
                    ? "var(--text-primary)"
                    : "var(--text-secondary)",
              }}
            >
              Approve ({approvedCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("rejected")}
              className={`pb-1 border-b-2 ${
                statusFilter === "rejected"
                  ? "border-[#c99c53]"
                  : "border-transparent"
              }`}
              style={{
                color:
                  statusFilter === "rejected"
                    ? "var(--text-primary)"
                    : "var(--text-secondary)",
              }}
            >
              Reject ({rejectedCount})
            </button>
          </div>
        </div>

        {/* 列表 */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div
              className="px-4 py-3 text-xs"
              style={{ color: "var(--text-secondary)" }}
            >
              Loading...
            </div>
          )}
          {errorMsg && !loading && (
            <div className="px-4 py-3 text-xs text-red-600">{errorMsg}</div>
          )}
          {!loading && !errorMsg && filteredRequests.length === 0 && (
            <div
              className="px-4 py-3 text-xs"
              style={{ color: "var(--text-secondary)" }}
            >
              No requests found.
            </div>
          )}

          {filteredRequests.map((req) => {
            const src = getSourceFromRequest(req);
            const isActive = activeRequest && req.id === activeRequest.id;

            const displayName =
              req.inputPreferredName ||
              req.vipGuest?.preferredName ||
              req.vipGuest?.fullName ||
              `VIP ${req.vipNumber}`;

            const initials = displayName
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()
              .slice(0, 2);

            return (
              <button
                key={req.id}
                type="button"
                onClick={() => setActiveId(req.id)}
                className="w-full px-4 py-3.5 flex items-center space-x-3 transition-colors text-left focus:outline-none hover:bg-black/5"
                style={{
                  backgroundColor: isActive ? "#FFFFFF" : "transparent",
                }}
              >
                <div className="flex-shrink-0">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-medium"
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
                    <div className="flex items-center space-x-1.5 flex-1 min-w-0">
                      <span
                        className="font-medium truncate"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {displayName}
                      </span>
                    </div>
                    <span
                      className="text-xs flex-shrink-0 ml-2"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {formatTimeLabel(req.createdAt)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <p
                      className="text-xs truncate"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {src === "wechat" ? "WeChat" : "Web"} · VIP {req.vipNumber}
                    </p>
                    <span className="flex-shrink-0 ml-2 inline-flex items-center rounded-full bg-[#F3E1B8] text-[#7b5e34] text-[10px] px-2 py-0.5">
                      {formatStatusLabel(req.status)}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 右侧详情视图：对齐你的设计稿 */}
      <div className="flex-1 flex flex-col bg-white">
        {!activeRequest ? (
          <div
            className="flex-1 flex items-center justify-center text-sm"
            style={{ color: "var(--text-secondary)" }}
          >
            No request selected.
          </div>
        ) : (
          <>
            {/* 顶部：名字 + 状态 pill */}
            <div className="px-10 pt-8 pb-4 border-b border-[#F1E4D7]">
              <div className="flex items-center justify-between">
                <div
                  className="text-base font-medium"
                  style={{ color: "var(--text-primary)" }}
                >
                  {activeRequest.inputPreferredName ||
                    activeRequest.vipGuest?.preferredName ||
                    activeRequest.vipGuest?.fullName ||
                    `VIP ${activeRequest.vipNumber}`}
                </div>
                <span className="inline-flex items-center rounded-full bg-[#F3E1B8] text-[#7b5e34] text-[11px] px-3 py-1">
                  {formatStatusLabel(activeRequest.status)}
                </span>
              </div>
            </div>

            {/* 中间：头像 + 名字 + 状态 + VIP tag */}
            <div className="pt-10 pb-6 flex flex-col items-center">
              <div
                className="w-24 h-24 rounded-full flex items-center justify-center text-2xl font-semibold"
                style={{ backgroundColor: "#F5E7CF", color: "#7b5e34" }}
              >
                {(activeRequest.inputPreferredName ||
                  activeRequest.vipGuest?.preferredName ||
                  activeRequest.vipGuest?.fullName ||
                  `VIP ${activeRequest.vipNumber}`)
                  .charAt(0)
                  .toUpperCase()}
              </div>

              <div
                className="mt-4 text-xl font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                {activeRequest.inputPreferredName ||
                  activeRequest.vipGuest?.preferredName ||
                  activeRequest.vipGuest?.fullName ||
                  `VIP ${activeRequest.vipNumber}`}
              </div>

              <div
                className="mt-1 text-sm"
                style={{ color: "var(--text-secondary)" }}
              >
                {activeRequest.vipGuest?.statusLabel || "Not Checked In"}
              </div>

              <span className="mt-3 inline-flex items-center rounded-full bg-[#F3E1B8] text-[#7b5e34] text-[11px] px-3 py-1">
                VIP
              </span>
            </div>

            {/* 下半部分：两列详情 */}
            <div className="flex-1 px-16 pb-6 flex">
              {/* 左：GUEST DETAILS */}
              <div className="w-1/2 pr-10">
                <h3 className="text-[12px] font-semibold tracking-[0.18em] text-[#B2873C] mb-4 uppercase">
                  GUEST DETAILS
                </h3>
                <div className="border-t border-[#F1E4D7] pt-4 space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span style={{ color: "var(--text-secondary)" }}>
                      VIP Number
                    </span>
                    <span style={{ color: "var(--text-primary)" }}>
                      {activeRequest.vipNumber}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: "var(--text-secondary)" }}>
                      Birthday (input)
                    </span>
                    <span style={{ color: "var(--text-primary)" }}>
                      {formatBirthday(activeRequest.inputBirthdayMd)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: "var(--text-secondary)" }}>
                      Channel
                    </span>
                    <span style={{ color: "var(--text-primary)" }}>
                      {getSourceFromRequest(activeRequest) === "wechat"
                        ? "WeChat"
                        : "Web"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: "var(--text-secondary)" }}>
                      Request Time
                    </span>
                    <span style={{ color: "var(--text-primary)" }}>
                      {formatTimeLabel(activeRequest.createdAt)}
                    </span>
                  </div>
                </div>
              </div>

              {/* 右：SYSTEM MATCH (PMS) */}
              <div className="w-1/2 pl-10">
                <h3 className="text-[12px] font-semibold tracking-[0.18em] text-[#B2873C] mb-4 uppercase">
                  SYSTEM MATCH (PMS)
                </h3>
                <div className="border-t border-[#F1E4D7] pt-4 space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span style={{ color: "var(--text-secondary)" }}>
                      Guest Status
                    </span>
                    <span style={{ color: "var(--text-primary)" }}>
                      {activeRequest.vipGuest?.statusLabel || "Not Checked In"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: "var(--text-secondary)" }}>
                      Member Tier
                    </span>
                    <span style={{ color: "var(--accent)" }}>
                      {activeRequest.vipGuest?.tier || "—"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: "var(--text-secondary)" }}>Room</span>
                    <span style={{ color: "var(--text-primary)" }}>
                      {activeRequest.vipGuest?.room || "—"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: "var(--text-secondary)" }}>
                      Birthday (PMS)
                    </span>
                    <span style={{ color: "var(--text-primary)" }}>
                      {formatBirthday(
                        activeRequest.vipGuest?.birthdayMd ?? null
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 底部按钮条：Reject / Approve */}
            <div className="px-16 py-5 border-t border-[#F1E4D7] flex justify-center space-x-6 bg-white">
              <button
                type="button"
                onClick={() => handleDecision("REJECT")}
                disabled={
                  decisionLoading || activeRequest.status !== "PENDING"
                }
                className="min-w-[160px] h-11 rounded-full border text-sm font-medium disabled:opacity-50"
                style={{
                  borderColor: "#F0B1A5",
                  color: "#C95747",
                  backgroundColor: "transparent",
                }}
              >
                Reject
              </button>
              <button
                type="button"
                onClick={() => handleDecision("APPROVE")}
                disabled={
                  decisionLoading || activeRequest.status !== "PENDING"
                }
                className="min-w-[160px] h-11 rounded-full text-sm font-medium disabled:opacity-50"
                style={{
                  backgroundColor: "#25211F",
                  color: "#FFFFFF",
                }}
              >
                Approve
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
