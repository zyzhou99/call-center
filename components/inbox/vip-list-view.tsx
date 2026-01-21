"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import type React from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

type VipContact = {
  id: string;
  displayName: string;
  vipNumber?: string;
  phone?: string;
  isTemp?: boolean;
  remark?: string;
  createdAt?: string | null; // ✅ 用于展示「用户创建时间」

  // 下面这些是从 DB 里同步出来，在中间表单用
  firstName?: string;
  lastName?: string;
  preferredName?: string;
  contactEmail?: string;
  birthdayMd?: string;
  preference?: string;
  restriction?: string;
  qrCode?: string; // ✅ 专属 qrCode token
  sessions?: VipSessionSummary[];
};

type VipForm = {
  id: string | null;
  firstName: string;
  lastName: string;
  preferredName: string;
  vipNumber: string;
  contactPhone: string;
  contactEmail: string;
  birthdayMd: string;
  preference: string;
  restriction: string;
  remark: string; // ✅ 新增：内部备注（映射到 vipGuest.remark）
  isNew: boolean; // 新建还未保存到 DB
};

type VipSessionSummary = {
  id: string;
  channel: string;
  lastMsgAt: string | null;
  lastMsgPreview: string;
};

const MOCK_CONTACTS: VipContact[] = [
  {
    id: "guest_698",
    displayName: "Guest_698",
    phone: "待补录资料",
    isTemp: true,
  },
];

export function VipListView() {
  const [search, setSearch] = useState("");
  const [contacts, setContacts] = useState<VipContact[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<VipForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const [showMenu, setShowMenu] = useState(false);
  const [origin, setOrigin] = useState<string | null>(null); // ✅ 当前页面 origin，用来拼 entry 链接

  const [showGenericQr, setShowGenericQr] = useState(false);
  const [showTagModal, setShowTagModal] = useState(false); // 这个是给第 3 步用的

  const [showPersonalQr, setShowPersonalQr] = useState(false); // 专属二维码弹窗
  const [isRemarkEditing, setIsRemarkEditing] = useState(false); // 备注是否处于编辑模式
  const remarkTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const [rightTab, setRightTab] = useState<"history" | "remark" | "merge">(
    "history"
  );
  const [mergeSelection, setMergeSelection] = useState<string[]>([]);
  const [showMergeList, setShowMergeList] = useState(false); // ✅ 控制「展开全部」后的列表展示

  // ✅ 手机端 UI 状态（不影响 PC）
  const [isMobile, setIsMobile] = useState(false);
  const [mobileView, setMobileView] = useState<"list" | "detail">("list");
  const [mobileRightPanelOpen, setMobileRightPanelOpen] = useState(false);

  // 拿到当前站点地址，比如 http://localhost:3000 或 https://yl.mo-happy-go.top
  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  // 监听窗口宽度，区分手机 / PC，仅用于 UI
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // 🔄 拉取 DB 里的 VipGuest 列表
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        let res = await fetch("/api/vip/guest", { cache: "no-store" });

        // 保险：如果是 /api/vip/guests
        if (!res.ok && res.status === 404) {
          res = await fetch("/api/vip/guests", { cache: "no-store" });
        }

        if (!res.ok) {
          console.error("load vip guests failed: HTTP", res.status);
          setContacts(MOCK_CONTACTS);
          setActiveId((prev) => prev ?? MOCK_CONTACTS[0]?.id ?? null);
          return;
        }

        const data: any = await res.json();
        let raw: any[] = [];

        if (Array.isArray(data)) raw = data;
        else if (Array.isArray(data.guests)) raw = data.guests;
        else if (Array.isArray(data.list)) raw = data.list;
        else if (Array.isArray(data.items)) raw = data.items;
        else if (Array.isArray(data.data)) raw = data.data;

        if (!Array.isArray(raw) || raw.length === 0) {
          setContacts([]);
          setActiveId(null);
          return;
        }

        const mapped: VipContact[] = raw.map((g: any, index: number) => {
          const vipNumber =
            g.vipNumber != null ? String(g.vipNumber) : undefined;

          const preferredName = (g.preferredName as string | undefined) || "";
          const fullName = (g.fullName as string | undefined) || "";
          const firstName = (g.firstName as string | undefined) || "";
          const lastName = (g.lastName as string | undefined) || "";

          const displayName =
            preferredName ||
            fullName ||
            [firstName, lastName].filter(Boolean).join(" ") ||
            (vipNumber ? `VIP ${vipNumber}` : `Guest_${index + 1}`);

          const phone =
            (g.contactPhone as string | undefined) ||
            (g.phone as string | undefined) ||
            "";

          const contactEmail =
            (g.contactEmail as string | undefined) ||
            (g.email as string | undefined) ||
            "";

          const birthdayMd =
            (g.birthdayMd as string | undefined) ||
            (g.birthday as string | undefined) ||
            "";

          const preference = (g.preference as string | undefined) || "";
          const restriction = (g.restriction as string | undefined) || "";

          const segment = (g.segment as string | undefined) || "";
          const statusLabel = (g.statusLabel as string | undefined) || "";

          const remarkFromDb = ((g.remark as string | undefined) ?? "").trim();

          const qrCode = (g.qrCode as string | undefined) || ""; // ✅ 从后端拿 qrCode

          const createdAtRaw =
            (g.createdAt as any) ?? (g.created_at as any) ?? null;
          const createdAt =
            createdAtRaw instanceof Date
              ? createdAtRaw.toISOString()
              : createdAtRaw
              ? new Date(createdAtRaw).toISOString()
              : null;

          // ✅ 这里尝试从后端拿 sessions，如果暂时没 include，也不会报错，只是空数组
          const sessionsRaw = Array.isArray(g.sessions) ? g.sessions : [];
          const sessions: VipSessionSummary[] = sessionsRaw.map(
            (s: any, idx2: number) => {
              const idFromApi =
                (s.id as string | undefined) ||
                `${index}-${idx2}-${String(s.openKfid ?? "")}-${String(
                  s.externalUserId ?? ""
                )}`;

              const channel =
                (s.channel as string | undefined) ||
                (s.openKfid ? "wechat" : "webchat");

              const lastMsgAt =
                (s.lastMsgAt as string | undefined) ||
                (s.updatedAt as string | undefined) ||
                (s.createdAt as string | undefined) ||
                null;

              const lastMsgPreview =
                (s.lastMsgPreview as string | undefined) ||
                (s.lastMessage as string | undefined) ||
                "";

              return {
                id: idFromApi,
                channel,
                lastMsgAt,
                lastMsgPreview,
              };
            }
          );

          return {
            id:
              (g.id as string | undefined) ||
              vipNumber ||
              `vip_${index}_${Date.now()}`,
            displayName,
            vipNumber,
            phone,
            isTemp: !vipNumber,
            // ✅ remark 优先用 remark，其次 fallback 到 segment/statusLabel
            remark: remarkFromDb || segment || statusLabel || undefined,
            createdAt,

            firstName,
            lastName,
            preferredName,
            contactEmail,
            birthdayMd,
            preference,
            restriction,
            qrCode,
            sessions,
          };
        });

        setContacts(mapped);
        setActiveId((prev) => prev ?? mapped[0]?.id ?? null);
      } catch (e: any) {
        console.error("load vip guests exception:", e);
        setError(e?.message || "加载失败");
        setContacts(MOCK_CONTACTS);
        setActiveId((prev) => prev ?? MOCK_CONTACTS[0]?.id ?? null);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const sourceContacts = contacts.length ? contacts : MOCK_CONTACTS;

  const activeContact = useMemo(() => {
    if (!sourceContacts.length) return undefined;
    if (!activeId) return sourceContacts[0];
    return sourceContacts.find((c) => c.id === activeId) ?? sourceContacts[0];
  }, [activeId, sourceContacts]);

  // ✅ 排好序的历史会话（最新在前）
  const historySessions = useMemo(() => {
    if (!activeContact?.sessions || activeContact.sessions.length === 0) {
      return [];
    }
    return [...activeContact.sessions].sort((a, b) => {
      const ta = a.lastMsgAt ? new Date(a.lastMsgAt).getTime() : 0;
      const tb = b.lastMsgAt ? new Date(b.lastMsgAt).getTime() : 0;
      return tb - ta;
    });
  }, [activeContact]);

  // ✅ 合并候选：同一联系人以外的所有记录（后续可以按 VIP 号 / 手机号过滤）
  const mergeCandidates = useMemo(() => {
    if (!activeContact) return [];
    return contacts.filter((c) => c.id !== activeContact.id);
  }, [contacts, activeContact]);

  useEffect(() => {
    setMergeSelection([]);
    setShowMergeList(false);
  }, [activeId]);

  // 同步当前选中联系人 → 中间表单
  useEffect(() => {
    if (!activeContact) {
      setForm(null);
      return;
    }

    setSaveError(null);
    setSaveSuccess(null);
    setIsRemarkEditing(false); // 每次换联系人时退出编辑模式

    setForm((prev) => {
      // 新建这一条时，不要因为 activeId 变化把用户已经输入的内容清掉
      if (prev && prev.isNew && prev.id === activeContact.id) {
        return prev;
      }

      let firstName = activeContact.firstName || "";
      let lastName = activeContact.lastName || "";
      const preferredName = activeContact.preferredName || "";

      // 如果 DB 里没有拆开 first/last，就从 displayName 猜一下
      if (!firstName && !lastName) {
        const parts = (activeContact.displayName || "")
          .split(/\s+/)
          .filter(Boolean);
        if (parts.length === 1) firstName = parts[0];
        else if (parts.length >= 2) {
          lastName = parts[0];
          firstName = parts.slice(1).join(" ");
        }
      }

      return {
        id: activeContact.id,
        firstName,
        lastName,
        preferredName,
        vipNumber: activeContact.vipNumber ?? "",
        contactPhone: activeContact.phone ?? "",
        contactEmail: activeContact.contactEmail ?? "",
        birthdayMd: activeContact.birthdayMd ?? "",
        preference: activeContact.preference ?? "",
        restriction: activeContact.restriction ?? "",
        remark: activeContact.remark ?? "", // ✅ 把 vipGuest.remark 同步进表单
        isNew: !!activeContact.isTemp && !activeContact.vipNumber,
      };
    });
  }, [activeContact]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sourceContacts;
    return sourceContacts.filter((c) => {
      const pool = [
        c.displayName,
        c.phone,
        c.vipNumber ? `VIP ${c.vipNumber}` : "",
        c.remark || "",
      ]
        .join(" ")
        .toLowerCase();
      return pool.includes(q);
    });
  }, [search, sourceContacts]);

  // 点击「新建联系人」
  const handleAddContact = () => {
    setSaveError(null);
    setSaveSuccess(null);

    const newId = `new-${Date.now()}`;

    const newContact: VipContact = {
      id: newId,
      displayName: "Guest10001",
      phone: "待补录资料",
      isTemp: true,
      remark: "待保存",
    };

    setContacts((prev) => [newContact, ...prev]);
    setActiveId(newId);

    setForm({
      id: newId,
      firstName: "",
      lastName: "",
      preferredName: "",
      vipNumber: "",
      contactPhone: "",
      contactEmail: "",
      birthdayMd: "",
      preference: "",
      restriction: "",
      remark: "",
      isNew: true,
    });

    if (isMobile) {
      setMobileView("detail");
    }
  };

  const updateForm = <K extends keyof VipForm>(key: K, value: VipForm[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const isCreateMode = !!form?.isNew;

  // ✅ 必填规则：三项姓名里至少一个 + VIP number
  const hasAnyName =
    !!form &&
    (form.firstName.trim().length > 0 ||
      form.lastName.trim().length > 0 ||
      form.preferredName.trim().length > 0);

  const hasVipNumber = !!form && form.vipNumber.trim().length > 0;

  // ✅ 无论新建还是修改，都用同一套规则控制按钮可用
  const canSave = !!form && hasAnyName && hasVipNumber && !saving;

  const handleSave = async () => {
    if (!form || !canSave) return;

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(null);

    try {
      const fullName =
        `${form.lastName} ${form.firstName}`.trim() ||
        form.preferredName ||
        form.firstName ||
        form.lastName;

      const payload = {
        vipNumber: form.vipNumber.trim(),
        fullName,
        firstName: form.firstName.trim() || null,
        lastName: form.lastName.trim() || null,
        preferredName: form.preferredName.trim() || null,
        birthdayMd: form.birthdayMd.trim() || null,
        contactPhone: form.contactPhone.trim() || null,
        contactEmail: form.contactEmail.trim() || null,
        preference: form.preference.trim() || "",
        restriction: form.restriction.trim() || "",
        remark: form.remark.trim() || "", // ✅ 把备注写到 vipGuest.remark
      };

      if (isCreateMode) {
        // -------- 新建 VIP --------
        const res = await fetch("/api/vip/guests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data: any = await res.json();

        if (!res.ok || !data?.ok) {
          throw new Error(data?.message || data?.error || "保存失败");
        }

        const g = data.guest as {
          id: string;
          vipNumber: string;
          fullName?: string | null;
          preferredName?: string | null;
          qrCode?: string | null;
          remark?: string | null;
        };

        const newDisplayName =
          (g.preferredName as string | undefined) ||
          (g.fullName as string | undefined) ||
          `VIP ${g.vipNumber}`;

        const remarkFromApi =
          (g.remark as string | undefined) ?? payload.remark;

        const newContact: VipContact = {
          id: g.id,
          displayName: newDisplayName,
          vipNumber: g.vipNumber,
          phone: form.contactPhone || undefined,
          isTemp: false,
          firstName: form.firstName,
          lastName: form.lastName,
          preferredName: form.preferredName,
          contactEmail: form.contactEmail,
          birthdayMd: form.birthdayMd,
          preference: form.preference,
          restriction: form.restriction,
          remark: remarkFromApi || undefined,
          qrCode: g.qrCode ?? undefined,
        };

        setContacts((prev) => {
          const withoutTemp = prev.filter((c) => c.id !== form.id);
          return [newContact, ...withoutTemp];
        });

        setActiveId(g.id);
        setForm((prev) =>
          prev
            ? {
                ...prev,
                id: g.id,
                isNew: false,
                remark: remarkFromApi,
              }
            : prev
        );

        setSaveSuccess("已更新资料并生成专属二维码。");
      } else {
        // -------- 修改已有 VIP --------
        if (!form.id) {
          throw new Error("缺少 VIP id");
        }

        const res = await fetch(
          `/api/vip/guests/${encodeURIComponent(form.id)}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }
        );

        const data: any = await res.json();

        if (!res.ok || !data?.ok) {
          throw new Error(data?.message || data?.error || "更新失败");
        }

        const g = data.guest as {
          id: string;
          vipNumber: string;
          fullName?: string | null;
          preferredName?: string | null;
          qrCode?: string | null;
          remark?: string | null;
        };

        const newDisplayName =
          (g.preferredName as string | undefined) ||
          (g.fullName as string | undefined) ||
          `VIP ${g.vipNumber}`;

        const remarkFromApi =
          (g.remark as string | undefined) ?? payload.remark;

        setContacts((prev) =>
          prev.map((c) =>
            c.id === form.id
              ? {
                  ...c,
                  id: g.id,
                  displayName: newDisplayName,
                  vipNumber: g.vipNumber,
                  phone: form.contactPhone || undefined,
                  firstName: form.firstName,
                  lastName: form.lastName,
                  preferredName: form.preferredName,
                  contactEmail: form.contactEmail,
                  birthdayMd: form.birthdayMd,
                  preference: form.preference,
                  restriction: form.restriction,
                  remark: remarkFromApi || undefined,
                  qrCode: g.qrCode ?? c.qrCode,
                }
              : c
          )
        );

        setActiveId(g.id);
        setForm((prev) =>
          prev
            ? {
                ...prev,
                id: g.id,
                isNew: false,
                remark: remarkFromApi,
              }
            : prev
        );

        setSaveSuccess("已更新 VIP 资料。");
      }
    } catch (e: any) {
      console.error("save vip failed:", e);
      setSaveError(e?.message || "保存失败，请稍后重试。");
    } finally {
      setSaving(false);
    }
  };

  const headerName =
    form &&
    (form.preferredName.trim() ||
      `${form.firstName} ${form.lastName}`.trim() ||
      activeContact?.displayName ||
      "");

  const prefTags = form ? splitTags(form.preference) : [];
  const restrictTags = form ? splitTags(form.restriction) : [];

  const handleDelete = () => {
    if (!activeContact) return;
    const confirmed = window.confirm(
      "确定要在当前界面删除这个联系人吗？（目前仅前端示意，后端删除接口稍后接入）"
    );
    if (!confirmed) return;

    setContacts((prev) => prev.filter((c) => c.id !== activeContact.id));

    setActiveId((prev) => {
      if (prev !== activeContact.id) return prev;
      const remaining = sourceContacts.filter(
        (c) => c.id !== activeContact.id
      );
      return remaining[0]?.id ?? null;
    });

    setForm(null);
  };

  // ✅ 当前联系人专属 entry 链接，用来生成二维码
  const entryUrl =
    origin && activeContact && activeContact.qrCode
      ? `${origin}/q?mode=vip&qrCode=${encodeURIComponent(activeContact.qrCode)}`
      : null;

  return (
    <div
      className="flex flex-1 overflow-hidden min-h-0"
      style={{ backgroundColor: "#F9F8F6" }}
    >
      {origin && (
        <GenericQrModal
          open={showGenericQr}
          onClose={() => setShowGenericQr(false)}
          entryUrl={`${origin}/q?mode=general`}
        />
      )}
      {entryUrl && (
        <VipQrModal
          open={showPersonalQr}
          onClose={() => setShowPersonalQr(false)}
          entryUrl={entryUrl}
        />
      )}

      {/* 左侧列表：PC 固定 96，手机 list 模式全宽 */}
      <div
        className={cn(
          "flex flex-col relative z-10",
          isMobile
            ? mobileView === "list"
              ? "w-full"
              : "hidden"
            : "w-96"
        )}
        style={{
          backgroundColor: "#F9F8F6",
          borderRight: isMobile ? undefined : "1px solid var(--divider)",
        }}
      >
        <div
          className="p-4"
          style={{
            backgroundColor: "#F9F8F6",
          }}
        >
          {/* 搜索框 */}
          <div className="relative mb-3">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
              style={{ color: "var(--text-secondary)" }}
            />
            <input
              type="text"
              placeholder="Search by name or VIP number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-opacity-20"
              style={{
                backgroundColor: "#FFFFFF",
                border: "1px solid var(--divider)",
                color: "var(--text-primary)",
                "--tw-ring-color": "var(--accent)",
              } as React.CSSProperties}
            />
          </div>

          {/* 新建 / 临时码 / 导入导出菜单 */}
          <div className="flex items-center gap-2">
            <button
              className="flex-1 h-9 rounded-lg text-xs font-medium shadow-sm"
              style={{
                backgroundColor: "#111111",
                color: "#FFFFFF",
              }}
              onClick={handleAddContact}
            >
              + 新建联系人
            </button>
            <button
              className="h-9 px-3 rounded-lg text-xs"
              style={{
                backgroundColor: "#F5E0B6",
                color: "#000000ff",
              }}
              onClick={() => setShowGenericQr(true)}
            >
              临时码
            </button>
            <div className="relative">
              <button
                className="w-9 h-9 rounded-lg flex items-center justify-center text-[#9B8773] hover:bg-black/5"
                onClick={() => setShowMenu((v) => !v)}
              >
                ⋮
              </button>
              {showMenu && (
                <div className="absolute right-0 mt-1 w-28 rounded-md bg白 border border-[var(--divider)] shadow-md text-[12px] text-[#3A3023] z-20">
                  <button className="w-full px-3 py-2 text-left hover:bg黑/5">
                    导入
                  </button>
                  <button className="w-full px-3 py-2 text-left hover:bg黑/5">
                    导出
                  </button>
                </div>
              )}
            </div>
          </div>

          {(loading || error) && (
            <div className="mt-2 text-[11px]" style={{ color: "#9B8773" }}>
              {loading && <span>正在加载 VIP 通讯录…</span>}
              {!loading && error && (
                <span>加载失败（已使用示例数据展示）：{error}</span>
              )}
            </div>
          )}
        </div>

        {/* 左侧联系人列表：行高、hover 效果和 ConversationRow 对齐 */}
        <div className="flex-1 overflow-y-auto">
          {filtered.map((c) => {
            const isActive = activeContact && c.id === activeContact.id;
            return (
              <VipContactRow
                key={c.id}
                contact={c}
                isActive={!!isActive}
                onClick={() => {
                  setActiveId(c.id);
                  if (isMobile) {
                    setMobileView("detail");
                  }
                }}
              />
            );
          })}

          {!filtered.length && !loading && (
            <div className="px-4 py-4 text-[12px]" style={{ color: "#9B8773" }}>
              当前没有匹配的联系人。
            </div>
          )}
        </div>
      </div>

      {/* 中间详情区：PC 占剩余空间，手机 detail 模式全屏 */}
      <div
        className={cn(
          "flex flex-col min-h-0",
          isMobile
            ? mobileView === "detail"
              ? "flex w-full"
              : "hidden"
            : "flex-1"
        )}
        style={{ backgroundColor: "#FFFFFF" }}
      >
        {activeContact && form ? (
          <>
            {isMobile ? (
            // ====== 手机端 Header ======
            <div
              className="border-b"
              style={{ borderColor: "var(--divider)" }}
            >
              {/* 顶部导航条：返回 + 标题居中 */}
              <div className="h-12 flex items-center px-4">
                <button
                  type="button"
                  onClick={() => setMobileView("list")}
                  className="mr-2 flex h-8 w-8 items-center justify-center rounded-full border border-[#E4D4BD]"
                >
                  <span className="text-lg text-[#4B3A2B]">‹</span>
                </button>
                <div
                  className="flex-1 text-center text-[15px] font-medium truncate"
                  style={{ color: "var(--text-primary)" }}
                >
                  {headerName || activeContact.displayName}
                </div>
                {/* 占位，用來讓中間標題真正居中 */}
                <div className="w-8" />
              </div>

              {/* 主信息块：头像 + 名字 + VIP + 时间 + Tag */}
              <div className="relative px-6 pt-4 pb-4 flex flex-col items-center">
                {/* 头像 */}
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center text-[18px] font-medium"
                  style={{
                    backgroundColor: "var(--avatar-bg)",
                    color: "var(--accent)",
                  }}
                >
                  {getInitials(headerName || activeContact.displayName)}
                </div>

                {/* 姓名 */}
                <div
                  className="mt-3 text-[17px] font-semibold"
                  style={{ color: "var(--text-primary)" }}
                >
                  {headerName || activeContact.displayName}
                </div>

                {/* VIP badge */}
                {form.vipNumber && (
                  <div
                    className="mt-1 inline-flex items-center px-3 py-1 rounded-md text-[11px] font-medium"
                    style={{
                      backgroundColor: "#F6E4BD",
                      color: "#7A5A22",
                    }}
                  >
                    VIP&nbsp;|&nbsp;{form.vipNumber}
                  </div>
                )}

                {/* 创建时间 + 上次对话时间 */}
                <div
                  className="mt-2 text-[11px]"
                  style={{ color: "var(--text-secondary)" }}
                >
                  创建于&nbsp;
                  {activeContact.createdAt
                    ? formatTimeFromIso(activeContact.createdAt)
                    : "未知"}
                  &nbsp;·&nbsp;上次对话时间&nbsp;
                  {historySessions.length > 0 &&
                  historySessions[0].lastMsgAt
                    ? formatTimeFromIso(historySessions[0].lastMsgAt)
                    : "暂无对话记录"}
                </div>

                {/* Tag 行：左对齐，但整体在 w-full 里 */}
                <div className="mt-4 w-full flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="px-3 py-1 rounded-md text-[11px] border border-dashed"
                    style={{
                      borderColor: "#E1D0B6",
                      backgroundColor: "#FFF9EF",
                      color: "#8A7254",
                    }}
                    onClick={() => setShowTagModal(true)}
                  >
                    + Add Tag
                  </button>

                  {prefTags.map((tag, idx) => (
                    <span
                      key={`pref-${idx}`}
                      className="px-3 py-1 rounded-md text-[11px]"
                      style={{
                        backgroundColor: "#F5E3C7",
                        color: "#7A5A22",
                      }}
                    >
                      {tag}
                    </span>
                  ))}

                  {restrictTags.map((tag, idx) => (
                    <span
                      key={`res-${idx}`}
                      className="px-3 py-1 rounded-md text-[11px]"
                      style={{
                        backgroundColor: "#FDE5E5",
                        color: "#B91C1C",
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {/* 右侧悬浮入口按钮：左侧圆角大，右侧无圆角 */}
                <button
                  type="button"
                  onClick={() => setMobileRightPanelOpen(true)}
                  className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center justify-center"
                >
                  <div
                    className="w-9 h-16 flex items-center justify-center shadow-md rounded-l-2xl rounded-r-none"
                    style={{ backgroundColor: "#111111" }}
                  >
                    {/* 这里随便用一个简单图标，后面可以换成你喜欢的 */}
                    <span className="text-white text-xs">≡</span>
                  </div>
                </button>
              </div>
            </div>
          ) : (
            // ====== PC 端 Header（保持左右排版，只稍微减小圆角）======
            <div
              className="flex items-start justify-between px-8 pt-6 pb-4 border-b"
              style={{ borderColor: "var(--divider)" }}
            >
              <div className="flex items-start gap-4">
                {/* avatar */}
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-[15px] font-medium mt-0.5"
                  style={{
                    backgroundColor: "var(--avatar-bg)",
                    color: "var(--accent)",
                  }}
                >
                  {getInitials(headerName || activeContact.displayName)}
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-3">
                    <span
                      className="text-[18px] font-semibold"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {headerName || activeContact.displayName}
                    </span>

                    {form.vipNumber && (
                      <span
                        className="px-2 py-0.5 rounded-md text-[11px] font-medium"
                        style={{
                          backgroundColor: "#F6E4BD",
                          color: "#7A5A22",
                        }}
                      >
                        VIP&nbsp;|&nbsp;{form.vipNumber}
                      </span>
                    )}
                  </div>

                  <div
                    className="text-[11px]"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    创建于&nbsp;
                    {activeContact.createdAt
                      ? formatTimeFromIso(activeContact.createdAt)
                      : "未知"}
                    &nbsp;·&nbsp;上次对话时间&nbsp;
                    {historySessions.length > 0 &&
                    historySessions[0].lastMsgAt
                      ? formatTimeFromIso(historySessions[0].lastMsgAt)
                      : "暂无对话记录"}
                  </div>

                  <div className="flex flex-wrap gap-2 mt-2">
                    <button
                      type="button"
                      className="px-3 py-1 rounded-md text-[11px] border border-dashed"
                      style={{
                        borderColor: "#E1D0B6",
                        backgroundColor: "#FFF9EF",
                        color: "#8A7254",
                      }}
                      onClick={() => setShowTagModal(true)}
                    >
                      + Add Tag
                    </button>

                    {prefTags.map((tag, idx) => (
                      <span
                        key={`pref-desktop-${idx}`}
                        className="px-3 py-1 rounded-md text-[11px]"
                        style={{
                          backgroundColor: "#F5E3C7",
                          color: "#7A5A22",
                        }}
                      >
                        {tag}
                      </span>
                    ))}

                    {restrictTags.map((tag, idx) => (
                      <span
                        key={`res-desktop-${idx}`}
                        className="px-3 py-1 rounded-md text-[11px]"
                        style={{
                          backgroundColor: "#FDE5E5",
                          color: "#B91C1C",
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

            {/* 内容 + 底部操作条 */}
            <div className="flex-1 flex flex-col min-h-0">
              {/* 滚动内容 */}
              <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6">
                {/* 二维码区域 */}
                <div className="mb-8">
                  <div
                    className="text-[13px] font-medium mb-2"
                    style={{ color: "var(--text-primary)" }}
                  >
                    二维码
                  </div>

                  {entryUrl ? (
                    <>
                      <button
                        type="button"
                        className="inline-flex items-center justify-center px-4 py-2 mt-2 rounded-lg text-[12px] font-medium"
                        style={{
                          backgroundColor: "#F5E0B6",
                          color: "#000000ff",
                        }}
                        onClick={() => setShowPersonalQr(true)}
                      >
                        VIP 专属二维码
                      </button>
                    </>
                  ) : (
                    <div
                      className="text-[11px]"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      当前联系人尚未生成专属二维码，请先填写必填信息并点击下方「更新资料」。
                    </div>
                  )}
                </div>

                {/* 编辑联系人详情表单 */}
                <div className="max-w-3xl">
                  <div className="flex items-center justify-between mb-3">
                    <div
                      className="text-[13px] font-medium"
                      style={{ color: "var(--text-primary)" }}
                    >
                      编辑联系人详情
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[13px]">
                    <Field label="* Preferred name（称呼）（三项姓名至少填一项）">
                      <input
                        value={form.preferredName}
                        onChange={(e) =>
                          updateForm("preferredName", e.target.value)
                        }
                        className={inputClass}
                        placeholder="例如：Jayvion / 小王 / Mr. Chen"
                      />
                    </Field>

                    <Field label="* VIP number">
                      <input
                        value={form.vipNumber}
                        onChange={(e) =>
                          updateForm("vipNumber", e.target.value)
                        }
                        className={inputClass}
                        placeholder="例如：10001"
                      />
                    </Field>

                    <Field label="First name">
                      <input
                        value={form.firstName}
                        onChange={(e) =>
                          updateForm("firstName", e.target.value)
                        }
                        className={inputClass}
                        placeholder="Rong"
                      />
                    </Field>

                    <Field label="Last name">
                      <input
                        value={form.lastName}
                        onChange={(e) =>
                          updateForm("lastName", e.target.value)
                        }
                        className={inputClass}
                        placeholder="Chen"
                      />
                    </Field>

                    <Field label="Phone number">
                      <input
                        value={form.contactPhone}
                        onChange={(e) =>
                          updateForm("contactPhone", e.target.value)
                        }
                        className={inputClass}
                        placeholder="+853 ..."
                      />
                    </Field>

                    <Field label="E-mail">
                      <input
                        value={form.contactEmail}
                        onChange={(e) =>
                          updateForm("contactEmail", e.target.value)
                        }
                        className={inputClass}
                        placeholder="guest@example.com"
                      />
                    </Field>

                    <Field label="Birthday（MMDD）">
                      <input
                        value={form.birthdayMd}
                        onChange={(e) =>
                          updateForm("birthdayMd", e.target.value)
                        }
                        className={inputClass}
                        placeholder="0816"
                      />
                    </Field>
                  </div>
                </div>
              </div>

              {/* 底部固定操作条：删除联系人 + 更新资料（逻辑不变，只改排版和圆角） */}
              <div
                className="px-4 md:px-8 py-4 border-t flex items-center justify-end gap-6"
                style={{
                  borderColor: "var(--divider)",
                  backgroundColor: "#FFFFFF",
                }}
              >
                <button
                  type="button"
                  onClick={handleDelete}
                  className="px-5 py-2 rounded-md text-[13px] font-medium"
                  style={{
                    backgroundColor: "#FFFFFF",
                    color: "#B91C1C",
                    border: "1px solid #FCA5A5",
                  }}
                >
                  删除联系人
                </button>

                <div className="flex flex-col items-end gap-2">
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      disabled={!canSave}
                      onClick={handleSave}
                      className={cn(
                        "px-6 py-2.5 rounded-md text-[13px] font-medium text-white disabled:opacity-60 disabled:cursor-not-allowed"
                      )}
                      style={{ backgroundColor: "#111111" }}
                    >
                      {saving ? "更新中…" : "更新资料"}
                    </button>

                    {!hasVipNumber && (
                      <span
                        className="text-[11px]"
                        style={{ color: "#B91C1C" }}
                      >
                        请填写 VIP number。
                      </span>
                    )}
                  </div>

                  {saveError && (
                    <div
                      className="text-[11px] px-3 py-2 rounded"
                      style={{
                        color: "#B91C1C",
                        backgroundColor: "#FEE2E2",
                        border: "1px solid #FECACA",
                      }}
                    >
                      {saveError}
                    </div>
                  )}
                  {saveSuccess && (
                    <div
                      className="text-[11px] px-3 py-2 rounded"
                      style={{
                        color: "#166534",
                        backgroundColor: "#DCFCE7",
                        border: "1px solid #BBF7D0",
                      }}
                    >
                      {saveSuccess}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>

      {form && (
        <ManageTagsModal
          open={showTagModal}
          onClose={() => setShowTagModal(false)}
          initialPreference={form.preference}
          initialRestriction={form.restriction}
          onSave={(newPref, newRes) => {
            updateForm("preference", newPref);
            updateForm("restriction", newRes);
            setShowTagModal(false);
          }}
        />
      )}

      {/* Mobile：右侧 panel 的遮罩层 */}
      {isMobile && mobileRightPanelOpen && (
        <div
          className="fixed inset-0 z-30"
          style={{ backgroundColor: "rgba(0,0,0,0.35)" }}
          onClick={() => setMobileRightPanelOpen(false)}
        />
      )}

      {/* 右侧 panel：历史记录 / 备注 / 合并 */}
      <div
        className={cn(
          "flex flex-col bg-white transition-transform duration-300 min-h-0",
          isMobile
            ? "fixed inset-y-0 right-0 w-[75%] max-w-sm z-40 shadow-xl"
            : "w-80",
          isMobile &&
            (mobileRightPanelOpen
              ? "translate-x-0 pointer-events-auto"
              : "translate-x-full pointer-events-none")
        )}
        style={
          isMobile
            ? undefined
            : {
                borderLeft: "1px solid var(--divider)",
                backgroundColor: "#FFFFFF",
              }
        }
      >
        {/* tabs */}
        <div
          className="px-4 pt-4 pb-2 border-b"
          style={{ borderColor: "var(--divider)" }}
        >
          <div className="flex items-center">
            <div className="flex w-full bg-[#F9F8F6] rounded-lg p-1 text-[12px]">
              <button
                className="flex-1 px-3 py-1.5 rounded-md font-medium text-center"
                style={{
                  backgroundColor:
                    rightTab === "history" ? "#FFFFFF" : "transparent",
                  color:
                    rightTab === "history"
                      ? "var(--text-primary)"
                      : "var(--text-secondary)",
                }}
                onClick={() => setRightTab("history")}
              >
                历史记录
              </button>
              <button
                className="flex-1 px-3 py-1.5 rounded-md font-medium text-center"
                style={{
                  backgroundColor:
                    rightTab === "remark" ? "#FFFFFF" : "transparent",
                  color:
                    rightTab === "remark"
                      ? "var(--text-primary)"
                      : "var(--text-secondary)",
                }}
                onClick={() => setRightTab("remark")}
              >
                备注
              </button>
              <button
                className="flex-1 px-3 py-1.5 rounded-md font-medium text-center"
                style={{
                  backgroundColor:
                    rightTab === "merge" ? "#FFFFFF" : "transparent",
                  color:
                    rightTab === "merge"
                      ? "var(--text-primary)"
                      : "var(--text-secondary)",
                }}
                onClick={() => setRightTab("merge")}
              >
                合并
              </button>
            </div>
          </div>
        </div>

        {/* tab 内容 */}
        <div className="flex-1 overflow-y-auto px-4 py-4 text-[12px]">
          {/* 历史记录 tab */}
          {rightTab === "history" && (
            <>
              {historySessions.length === 0 ? (
                <div
                  className="text-[11px]"
                  style={{ color: "var(--text-secondary)" }}
                >
                  当前联系人暂无历史对话记录。
                </div>
              ) : (
                <>
                  {historySessions.map((s) => (
                    <HistoryItem
                      key={s.id}
                      channel={formatChannelLabel(s.channel)}
                      time={formatTimeFromIso(s.lastMsgAt)}
                      content={
                        s.lastMsgPreview || "（无消息内容预览）"
                      }
                    />
                  ))}
                </>
              )}
            </>
          )}

          {/* 备注 tab */}
          {rightTab === "remark" && (
            <div className="flex flex-col gap-3">
              <div
                className="text-[11px]"
                style={{ color: "var(--text-secondary)" }}
              >
                备注仅内部可见，不会展示给客人。
              </div>

              {/* 大块备注气泡区域 */}
              <div className="relative rounded-2xl px-4 pt-3 pb-10 bg-[#F5F5F5]">
                <textarea
                  ref={remarkTextareaRef}
                  value={form?.remark ?? ""}
                  onChange={(e) => updateForm("remark", e.target.value)}
                  className="w-full min-h-[96px] bg-transparent border-none outline-none resize-none text-[13px] leading-relaxed"
                  placeholder="请输入备注信息"
                />

                {/* 右下角「保存备注」按钮：只改样式，不改任何原来的保存逻辑 */}
                <button
                  type="button"
                  className="absolute right-4 bottom-3 px-3 py-1.5 rounded-full text-[12px] shadow-sm"
                  style={{
                    backgroundColor: "#FFFFFF",
                    color: "#4b3a2b",
                  }}
                >
                  保存备注
                </button>
              </div>

              <div
                className="text-[11px]"
                style={{ color: "var(--text-secondary)" }}
              >
                修改备注后，请点击面板下方「更新资料」按钮，将备注写入 VIP 档案。
              </div>
            </div>
          )}

          {/* 合并 tab */}
          {rightTab === "merge" && (
            <div className="flex flex-col gap-3">
              <div
                className="text-[11px]"
                style={{ color: "var(--text-secondary)" }}
              >
                当同一位 VIP 有多个联系人记录（例如：一个是正式 VIP 档案，一个来自通用二维码），可以在此将对话与档案合并。
              </div>

              {/* 当前主账号 */}
              {activeContact && (
                <div
                  className="border rounded-md p-3 text-[12px]"
                  style={{ borderColor: "var(--divider)" }}
                >
                  <div
                    className="text-[11px] mb-1"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    当前主账号
                  </div>
                  <div
                    className="font-medium mb-1"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {activeContact.displayName}
                  </div>
                  <div
                    className="text-[11px]"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {activeContact.vipNumber
                      ? `VIP ${activeContact.vipNumber}`
                      : "暂无 VIP 号 · 可在中间编辑区补录"}
                  </div>
                </div>
              )}

              {/* 可合并账号列表 */}
              <div
                className="text-[11px]"
                style={{ color: "var(--text-secondary)" }}
              >
                请选择需要合并到当前主账号下的其他联系人：
              </div>

              {mergeCandidates.length === 0 ? (
                <div
                  className="text-[11px]"
                  style={{ color: "var(--text-secondary)" }}
                >
                  当前没有可合并的其他联系人。
                </div>
              ) : (
                <div className="space-y-3">
                  <button
                    type="button"
                    className="px-3 py-1.5 rounded-lg text-[11px] self-start"
                    style={{
                      backgroundColor: "#F9F8F6",
                      color: "#7A5A22",
                      border: "1px solid #E4D4BD",
                    }}
                    onClick={() =>
                      setShowMergeList((prev) => !prev)
                    }
                  >
                    {showMergeList
                      ? "收起可合并联系人"
                      : `展开全部可合并联系人（${mergeCandidates.length}）`}
                  </button>

                  {showMergeList && (
                    <div className="space-y-2">
                      {mergeCandidates.map((c) => {
                        const checked = mergeSelection.includes(c.id);
                        const sameVip =
                          !!c.vipNumber &&
                          !!activeContact?.vipNumber &&
                          c.vipNumber === activeContact.vipNumber;

                        return (
                          <label
                            key={c.id}
                            className="flex items-start gap-2 p-2 rounded-md cursor-pointer hover:bg-black/5"
                          >
                            <input
                              type="radio"
                              name="merge-target"
                              className="mt-[3px]"
                              checked={checked}
                              onChange={() => {
                                setMergeSelection(
                                  checked ? [] : [c.id]
                                );
                              }}
                            />
                            <div className="flex-1 min-w-0">
                              <div
                                className="flex items-center gap-2 text-[12px]"
                                style={{ color: "var(--text-primary)" }}
                              >
                                <span className="truncate">
                                  {c.displayName}
                                </span>
                                {c.vipNumber && (
                                  <span
                                    className="px-1.5 py-0.5 rounded-full text-[10px]"
                                    style={{
                                      backgroundColor: "#F6E4BD",
                                      color: "#7A5B22",
                                    }}
                                  >
                                    VIP {c.vipNumber}
                                  </span>
                                )}
                                {sameVip && (
                                  <span
                                    className="px-1.5 py-0.5 rounded-full text-[10px]"
                                    style={{
                                      backgroundColor: "#DCFCE7",
                                      color: "#166534",
                                    }}
                                  >
                                    同一 VIP 号
                                  </span>
                                )}
                              </div>
                              <div
                                className="text-[11px] mt-0.5 truncate"
                                style={{ color: "var(--text-secondary)" }}
                              >
                                {c.phone
                                  ? maskPhone(c.phone)
                                  : "未填写手机号"}
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <button
                type="button"
                disabled={mergeSelection.length === 0}
                className={cn(
                  "mt-2 px-4 py-2 rounded-lg text-[12px] font-medium disabled:opacity-60 disabled:cursor-not-allowed text-white"
                )}
                style={{ backgroundColor: "#111111" }}
              >
                合并所选联系人
              </button>

              <div
                className="text-[11px] mt-1"
                style={{ color: "var(--text-secondary)" }}
              >
                建议：确定主账号后，再将临时账号（通用二维码创建的）合并进来，以保证 VIP
                档案与历史对话集中到同一条记录。
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* 左侧单行联系人：行高 / hover 跟 ConversationRow 对齐 */
interface VipContactRowProps {
  contact: VipContact;
  isActive: boolean;
  onClick: () => void;
}

function VipContactRow({ contact, isActive, onClick }: VipContactRowProps) {
  const initials = getInitials(contact.displayName);

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full px-4 py-3.5 flex items-center space-x-3 transition-colors text-left focus:outline-none",
        isActive ? "" : "hover:bg-black/5"
      )}
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
              {contact.displayName}
            </span>
            {contact.vipNumber && (
              <span
                className="inline-block px-1.5 py-0.5 text-[10px] font-medium rounded"
                style={{
                  backgroundColor: "#F6E4BD",
                  color: "#7A5B22",
                }}
              >
                VIP {contact.vipNumber}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <p
            className="text-sm truncate"
            style={{ color: "var(--text-secondary)" }}
          >
            {/* ✅ 统一只展示手机号，没有手机号则提示「未填写手机号」 */}
            {contact.phone
              ? maskPhone(contact.phone)
              : "未填写手机号"}
          </p>
        </div>
      </div>
    </button>
  );
}

/* 小组件 & 工具函数 */

function Field({ label, children }: { label: string; children: any }) {
  return (
    <label className="flex flex-col gap-1 text-[13px]">
      <span
        className="text-[11px]"
        style={{ color: "var(--text-secondary)" }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  "px-3 py-2 rounded-md border bg-white text-[13px] text-[#3A3023] placeholder:text-[#B3A89B] focus:outline-none focus:ring-1 focus:ring-[#D6B56A]";

function HistoryItem(props: {
  channel: string;
  time: string;
  content: string;
}) {
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-[#E4F6E8] flex items-center justify-center text-[11px] text-[#2F7D32]">
            {props.channel === "微信渠道" ? "微" : "W"}
          </div>
          <div className="text-[11px]" style={{ color: "var(--text-primary)" }}>
            {props.channel}
          </div>
        </div>
        <div className="text-[10px]" style={{ color: "var(--text-secondary)" }}>
          {props.time}
        </div>
      </div>
      <div className="text-[12px]" style={{ color: "var(--text-primary)" }}>
        {props.content}
      </div>
    </div>
  );
}

function formatChannelLabel(channel: string): string {
  const c = (channel || "").toLowerCase();
  if (c === "wechat") return "微信渠道";
  if (c === "webchat" || c === "h5") return "H5 / Web";
  if (c === "whatsapp") return "WhatsApp";
  if (c === "email") return "Email";
  if (c === "phone") return "电话";
  return channel || "其他";
}

function formatTimeFromIso(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getInitials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function splitTags(raw: string): string[] {
  if (!raw) return [];
  return raw
    .split(/[,，、;；]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

interface GenericQrModalProps {
  open: boolean;
  onClose: () => void;
  entryUrl: string;
}

function GenericQrModal({ open, onClose, entryUrl }: GenericQrModalProps) {
  if (!open) return null;

  const handleCopy = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(entryUrl);
        alert("已复制通用入口链接。");
      } else {
        window.prompt("请复制以下链接：", entryUrl);
      }
    } catch (e) {
      console.error("copy generic link failed:", e);
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.35)" }}
    >
      <div className="w-[320px] rounded-3xl overflow-hidden shadow-2xl">
        {/* 上半部分：金色卡片（跟专属二维码统一风格） */}
        <div
          className="px-6 pt-6 pb-5 text-center relative"
          style={{
            background:
              "linear-gradient(151deg, #F9EBBE 0.78%, #E7D3AC 56.83%, #D6BB9A 89.1%)",
          }}
        >
          {/* 右上角关闭按钮 */}
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 text-[14px] leading-none px-1"
            style={{ color: "#7A5A22" }}
          >
            ×
          </button>

          <div
            className="text-[11px] font-medium"
            style={{ color: "#7A5A22" }}
          >
            澳門永利皇宮酒店
          </div>
          <div
            className="text-[11px] mb-3"
            style={{ color: "#7A5A22" }}
          >
            Wynn Palace Cotai
          </div>

          <div
            className="h-px w-full mb-4"
            style={{ backgroundColor: "rgba(0,0,0,0.08)" }}
          />

          <div
            className="text-lg font-semibold"
            style={{ color: "#5B4029" }}
          >
            VIP Customer Service
          </div>
          <div
            className="mt-1 text-[11px]"
            style={{ color: "#7A5A22" }}
          >
            Generic access for VIP registration
          </div>

          <div className="mt-5 mx-auto w-[210px] h-[210px] rounded-2xl bg-white flex items-center justify-center overflow-hidden">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(
                entryUrl
              )}`}
              alt="通用二维码"
              className="w-full h-full object-contain"
            />
          </div>

          <div
            className="mt-4 text-[8px] break-all px-3 py-2 rounded-md"
            style={{ color: "#7A5A22" }}
          >
            {entryUrl}
          </div>
        </div>

        {/* 下半部分：复制链接 + 关闭 */}
        <div className="flex">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 text-[13px] font-medium"
            style={{
              backgroundColor: "#211C16",
              color: "#FDF3DE",
            }}
          >
            保存二维码
          </button>
        </div>
      </div>
    </div>
  );
}

interface VipQrModalProps {
  open: boolean;
  onClose: () => void;
  entryUrl: string;
}

function VipQrModal({ open, onClose, entryUrl }: VipQrModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.35)" }}
    >
      <div className="w-[360px] rounded-3xl overflow-hidden shadow-2xl">
        {/* 上半部分：金色卡片 */}
        <div
          className="px-6 pt-6 pb-5 text-center relative"
          style={{
            background:
              "linear-gradient(151deg, #F9EBBE 0.78%, #E7D3AC 56.83%, #D6BB9A 89.1%)",
          }}
        >
          {/* 右上角关闭按钮 */}
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 text-[14px] leading-none px-1"
            style={{ color: "#7A5A22" }}
          >
            ×
          </button>
          <div
            className="text-[11px] font-medium"
            style={{ color: "#7A5A22" }}
          >
            澳門永利皇宮酒店
          </div>
          <div
            className="text-[11px] mb-3"
            style={{ color: "#7A5A22" }}
          >
            Wynn Palace Cotai
          </div>

          <div
            className="h-px w-full mb-4"
            style={{ backgroundColor: "rgba(0,0,0,0.08)" }}
          />

          <div
            className="text-lg font-semibold"
            style={{ color: "#5B4029" }}
          >
            VIP Customer Service
          </div>
          <div
            className="mt-1 text-[11px]"
            style={{ color: "#7A5A22" }}
          >
            Connect to our customer service system
          </div>

          <div className="mt-5 mx-auto w-[210px] h-[210px] rounded-2xl bg-white flex items-center justify-center overflow-hidden">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(
                entryUrl
              )}`}
              alt="VIP 专属二维码"
              className="w-full h-full object-contain"
            />
          </div>

          <div
            className="mt-4 text-[10px] break-all px-3 py-2 rounded-md bg白/70"
            style={{ color: "#7A5A22" }}
          >
            {entryUrl}
          </div>
        </div>

        {/* 下半部分：按钮条 */}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-3 text-[13px] font-medium"
          style={{
            backgroundColor: "#211C16",
            color: "#FDF3DE",
          }}
        >
          保存二维码
        </button>
      </div>
    </div>
  );
}

interface ManageTagsModalProps {
  open: boolean;
  onClose: () => void;
  initialPreference: string;
  initialRestriction: string;
  onSave: (preference: string, restriction: string) => void;
}

function ManageTagsModal({
  open,
  onClose,
  initialPreference,
  initialRestriction,
  onSave,
}: ManageTagsModalProps) {
  const [prefTags, setPrefTags] = useState<string[]>([]);
  const [alertTags, setAlertTags] = useState<string[]>([]);
  const [prefInput, setPrefInput] = useState("");
  const [alertInput, setAlertInput] = useState("");

  // 打开时同步当前表单里的值
  useEffect(() => {
    if (!open) return;
    setPrefTags(splitTags(initialPreference || ""));
    setAlertTags(splitTags(initialRestriction || ""));
    setPrefInput("");
    setAlertInput("");
  }, [open, initialPreference, initialRestriction]);

  if (!open) return null;

  const handleAddPref = () => {
    const v = prefInput.trim();
    if (!v) return;
    if (!prefTags.includes(v)) {
      setPrefTags([...prefTags, v]);
    }
    setPrefInput("");
  };

  const handleAddAlert = () => {
    const v = alertInput.trim();
    if (!v) return;
    if (!alertTags.includes(v)) {
      setAlertTags([...alertTags, v]);
    }
    setAlertInput("");
  };

  const handleSave = () => {
    const prefStr = prefTags.join(", ");
    const alertStr = alertTags.join(", ");
    onSave(prefStr, alertStr);
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.35)" }}
    >
      <div
        className="w-[560px] rounded-2xl overflow-hidden shadow-xl"
        style={{ backgroundColor: "#FFFFFF" }}
      >
        <div
          className="px-6 py-4 border-b"
          style={{ borderColor: "var(--divider)" }}
        >
          <div
            className="text-base font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            Manage Tags
          </div>
        </div>

        <div className="px-6 py-5 space-y-6 text-[12px]">
          {/* Preferences */}
          <TagEditorSection
            title="Preferences"
            placeholder="请输入偏好标签，例如 Whisky / Coffee / Soft Bedding"
            inputValue={prefInput}
            onInputChange={setPrefInput}
            onAdd={handleAddPref}
            tags={prefTags}
            onRemoveTag={(tag) =>
              setPrefTags(prefTags.filter((t) => t !== tag))
            }
            tagStyle="pref"
          />

          {/* Alerts / Restrictions */}
          <TagEditorSection
            title="Alerts"
            placeholder="请输入提醒/禁忌标签，例如 Allergy、忌辣…"
            inputValue={alertInput}
            onInputChange={setAlertInput}
            onAdd={handleAddAlert}
            tags={alertTags}
            onRemoveTag={(tag) =>
              setAlertTags(alertTags.filter((t) => t !== tag))
            }
            tagStyle="alert"
          />
        </div>

        <div
          className="px-6 py-3 border-t flex justify-end gap-3"
          style={{ borderColor: "var(--divider)" }}
        >
          <button
            type="button"
            className="px-4 py-1.5 rounded-full text-[13px]"
            style={{
              backgroundColor: "#FFFFFF",
              color: "var(--text-primary)",
              border: "1px solid var(--divider)",
            }}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="px-5 py-1.5 rounded-full text-[13px] text-white"
            style={{ backgroundColor: "#111111" }}
            onClick={handleSave}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

interface TagEditorSectionProps {
  title: string;
  placeholder: string;
  inputValue: string;
  onInputChange: (v: string) => void;
  onAdd: () => void;
  tags: string[];
  onRemoveTag: (tag: string) => void;
  tagStyle: "pref" | "alert";
}

function TagEditorSection({
  title,
  placeholder,
  inputValue,
  onInputChange,
  onAdd,
  tags,
  onRemoveTag,
  tagStyle,
}: TagEditorSectionProps) {
  const isPref = tagStyle === "pref";

  return (
    <div>
      <div
        className="mb-2 text-[13px] font-medium"
        style={{ color: "var(--text-primary)" }}
      >
        {title}
      </div>

      <div
        className="flex items-center gap-2 px-3 py-2 rounded-md border mb-2"
        style={{
          borderColor: "var(--divider)",
          backgroundColor: "#FAFAFA",
        }}
      >
        <input
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onAdd();
            }
          }}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-[12px] focus:outline-none"
        />
        <button
          type="button"
          className="text-[12px]"
          style={{ color: "var(--accent)" }}
          onClick={onAdd}
        >
          添加
        </button>
      </div>

      <div
        className="text-[11px] mb-1"
        style={{ color: "var(--text-secondary)" }}
      >
        Active {title} ({tags.length})
      </div>

      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <button
            key={tag}
            type="button"
            className="px-3 py-1 rounded-full text-[11px] flex items-center gap-1"
            style={{
              backgroundColor: isPref ? "#F5E3C7" : "#FDE5E5",
              color: isPref ? "#7A5A22" : "#B91C1C",
            }}
            onClick={() => onRemoveTag(tag)}
          >
            <span>{tag}</span>
            <span>×</span>
          </button>
        ))}
        {!tags.length && (
          <span
            className="text-[11px]"
            style={{ color: "var(--text-secondary)" }}
          >
            暂无标签。
          </span>
        )}
      </div>
    </div>
  );
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) return phone;
  const head = digits.slice(0, 3);
  const tail = digits.slice(-4);
  return `${head}*****${tail}`;
}
