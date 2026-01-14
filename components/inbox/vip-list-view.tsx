"use client";

import { useEffect, useMemo, useState } from "react";
import type React from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

type VipContact = {
  id: string;
  displayName: string;
  vipNumber?: string;
  phone?: string;
  isTemp?: boolean;
  note?: string;

  // 下面这些是从 DB 里同步出来，在中间表单用
  firstName?: string;
  lastName?: string;
  preferredName?: string;
  contactEmail?: string;
  birthdayMd?: string;
  preference?: string;
  restriction?: string;
  qrCode?: string; // ✅ 新增：专属 qrCode token
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
  isNew: boolean; // 新建还未保存到 DB
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

  // 拿到当前站点地址，比如 http://localhost:3000 或 https://yl.mo-happy-go.top
  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
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

          const qrCode = (g.qrCode as string | undefined) || ""; // ✅ 从后端拿 qrCode

          return {
            id:
              (g.id as string | undefined) ||
              vipNumber ||
              `vip_${index}_${Date.now()}`,
            displayName,
            vipNumber,
            phone,
            isTemp: !vipNumber,
            note: segment || statusLabel || undefined,

            firstName,
            lastName,
            preferredName,
            contactEmail,
            birthdayMd,
            preference,
            restriction,
            qrCode,
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

  // 同步当前选中联系人 → 中间表单
  useEffect(() => {
    if (!activeContact) {
      setForm(null);
      return;
    }

    setSaveError(null);
    setSaveSuccess(null);

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
      note: "待保存",
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
      isNew: true,
    });
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

  const canSaveNew = isCreateMode && hasAnyName && hasVipNumber && !saving;

  const handleSave = async () => {
    if (!form || !isCreateMode || !canSaveNew) return;

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(null);

    try {
      const fullName =
        `${form.lastName} ${form.firstName}`.trim() ||
        form.preferredName ||
        form.firstName ||
        form.lastName;

      const res = await fetch("/api/vip/guests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
        }),
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
      };

      const newDisplayName =
        (g.preferredName as string | undefined) ||
        (g.fullName as string | undefined) ||
        `VIP ${g.vipNumber}`;

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
        qrCode: g.qrCode ?? undefined, // ✅ 把后端生成的 qrCode 也放进来
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
            }
          : prev
      );

      setSaveSuccess("已更新资料并生成专属二维码。");
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
      ? `${origin}/vip-entry?qrCode=${encodeURIComponent(
          activeContact.qrCode
        )}`
      : null;

  return (
    <div
      className="flex flex-1 overflow-hidden"
      style={{ backgroundColor: "#F9F8F6" }}
    >
      {/* 左侧列表：宽度和 Inbox 的 ConversationListPanel 对齐 */}
      <div
        className="w-96 flex flex-col relative z-10"
        style={{
          backgroundColor: "#F9F8F6",
          borderRight: "1px solid var(--divider)",
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
              className="flex-1 h-9 rounded-full text-xs font-medium shadow-sm"
              style={{
                backgroundColor: "#111111",
                color: "#FFFFFF",
              }}
              onClick={handleAddContact}
            >
              + 新建联系人
            </button>
            <button
              className="h-9 px-3 rounded-full text-xs"
              style={{
                backgroundColor: "#FFF7E8",
                color: "#7A5A22",
                border: "1px solid #E5CFA2",
              }}
              onClick={() => alert("临时码 / 通用二维码流程稍后再接。")}
            >
              临时码
            </button>
            <div className="relative">
              <button
                className="w-9 h-9 rounded-full flex items-center justify-center text-[#9B8773] hover:bg-black/5"
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
                onClick={() => setActiveId(c.id)}
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

      {/* 中间详情区：和 ChatPanel 同一块，中间不再有 margin / 圆角 */}
      <div
        className="flex-1 flex flex-col"
        style={{ backgroundColor: "#FFFFFF" }}
      >
        {activeContact && form ? (
          <>
            {/* 顶部标题条 */}
            <div
              className="flex items-center justify-between px-8 pt-6 pb-4 border-b"
              style={{ borderColor: "var(--divider)" }}
            >
              <div className="flex items-center gap-4">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-[13px] font-medium"
                  style={{
                    backgroundColor: "var(--avatar-bg)",
                    color: "var(--accent)",
                  }}
                >
                  {getInitials(headerName || activeContact.displayName)}
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span
                      className="text-base font-semibold"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {headerName || activeContact.displayName}
                    </span>
                    {form.vipNumber && (
                      <span
                        className="px-2 py-0.5 rounded-full text-[11px]"
                        style={{
                          backgroundColor: "#F6E4BD",
                          color: "#7A5A22",
                        }}
                      >
                        VIP {form.vipNumber}
                      </span>
                    )}
                  </div>
                  <div
                    className="text-[11px]"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {isCreateMode
                      ? "新建 VIP 客户 · 填写资料后点击更新即可写入档案并生成二维码"
                      : "来自 VIP 档案 · 可在此查看喜好与基本信息"}
                  </div>
                </div>
              </div>

              <button
                className="px-4 py-2 rounded-full text-[12px]"
                style={{
                  backgroundColor: "#FFFFFF",
                  color: "var(--text-primary)",
                  border: "1px solid var(--divider)",
                }}
              >
                发送消息
              </button>
            </div>

            {/* 内容 + 底部操作条 */}
            <div className="flex-1 flex flex-col">
              {/* 滚动内容 */}
              <div className="flex-1 overflow-y-auto px-8 py-6">
                {/* 标签 + 二维码区域 */}
                <div className="mb-6">
                  <div className="flex flex-wrap gap-2 mb-3">
                    <button
                      type="button"
                      className="px-3 py-1 rounded-full text-[11px]"
                      style={{
                        border: "1px dashed #E1D0B6",
                        backgroundColor: "#FFF9EF",
                        color: "#8A7254",
                      }}
                    >
                      + Add Tag
                    </button>

                    {prefTags.map((tag, idx) => (
                      <span
                        key={`pref-${idx}`}
                        className="px-3 py-1 rounded-full text-[11px]"
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
                        className="px-3 py-1 rounded-full text-[11px]"
                        style={{
                          backgroundColor: "#FDE5E5",
                          color: "#B91C1C",
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div>
                    <div
                      className="text-[13px] mb-2 font-medium"
                      style={{ color: "var(--text-primary)" }}
                    >
                      二维码
                    </div>

                    {entryUrl ? (
                      <div className="flex items-start gap-4">
                        <div className="flex-1">
                          <div
                            className="text-[11px] mb-1"
                            style={{ color: "var(--text-secondary)" }}
                          >
                            VIP 专属链接
                          </div>
                          <div className="flex items-center gap-2">
                            <code
                              className="text-[11px] px-2 py-1 rounded border break-all"
                              style={{
                                backgroundColor: "#F5F5F5",
                                borderColor: "var(--divider)",
                                color: "var(--text-primary)",
                              }}
                            >
                              {entryUrl}
                            </code>
                            <button
                              type="button"
                              className="px-3 py-1 rounded-full text-[11px]"
                              style={{
                                backgroundColor: "#111111",
                                color: "#FFFFFF",
                              }}
                              onClick={async () => {
                                try {
                                  if (
                                    typeof navigator !== "undefined" &&
                                    navigator.clipboard?.writeText
                                  ) {
                                    await navigator.clipboard.writeText(
                                      entryUrl
                                    );
                                    setSaveError(null);
                                    setSaveSuccess(
                                      "已复制专属链接，可用于生成或发送二维码。"
                                    );
                                  } else {
                                    window.prompt(
                                      "请复制以下链接：",
                                      entryUrl
                                    );
                                  }
                                } catch (e) {
                                  console.error("copy failed:", e);
                                  setSaveError("复制链接失败，请稍后重试。");
                                }
                              }}
                            >
                              复制链接
                            </button>
                          </div>
                          <div
                            className="mt-2 text-[11px]"
                            style={{ color: "var(--text-secondary)" }}
                          >
                            可以将此链接生成二维码，供客人扫码进入专属会话。
                          </div>
                        </div>

                        {/* 简单二维码预览（使用在线二维码服务，仅供 POC 测试） */}
                        <div className="w-[96px] h-[96px] rounded-md border flex items-center justify-center overflow-hidden bg-white">
                          <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                              entryUrl
                            )}`}
                            alt="VIP 专属二维码"
                            className="w-full h-full object-contain"
                          />
                        </div>
                      </div>
                    ) : (
                      <div
                        className="text-[11px]"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        当前联系人尚未生成专属二维码，请先填写必填信息并点击「更新资料」。
                      </div>
                    )}
                  </div>
                </div>

                {/* 编辑表单 */}
                <div className="max-w-3xl">
                  <div
                    className="text-[13px] font-medium mb-4"
                    style={{ color: "var(--text-primary)" }}
                  >
                    编辑联系人详情
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-[13px]">
                    <Field label="Preferred name（称呼）（三项姓名至少填一项）">
                      <input
                        value={form.preferredName}
                        onChange={(e) =>
                          updateForm("preferredName", e.target.value)
                        }
                        className={inputClass}
                        placeholder="例如：Jayvion / 小王 / Mr. Chen"
                      />
                    </Field>
                    <Field label="VIP number *">
                      <input
                        value={form.vipNumber}
                        onChange={(e) =>
                          updateForm("vipNumber", e.target.value)
                        }
                        className={inputClass}
                        placeholder="例如：10001"
                      />
                    </Field>

                    <Field label="First name（姓或名至少填一项）">
                      <input
                        value={form.firstName}
                        onChange={(e) =>
                          updateForm("firstName", e.target.value)
                        }
                        className={inputClass}
                        placeholder="Rong"
                      />
                    </Field>
                    <Field label="Last name（姓或名至少填一项）">
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
                        placeholder="0323"
                      />
                    </Field>
                  </div>
                </div>
              </div>

              {/* 底部固定操作条：删除联系人 + 更新资料 */}
              <div
                className="px-8 py-4 border-t flex items-center justify之间"
                style={{
                  borderColor: "var(--divider)",
                  backgroundColor: "#FFFFFF",
                }}
              >
                <button
                  type="button"
                  onClick={handleDelete}
                  className="px-5 py-2 rounded-full text-[13px] font-medium"
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
                      disabled={!canSaveNew}
                      onClick={handleSave}
                      className={cn(
                        "px-6 py-2.5 rounded-full text-[13px] font-medium text-white disabled:opacity-60 disabled:cursor-not-allowed"
                      )}
                      style={{ backgroundColor: "#111111" }}
                    >
                      {saving ? "更新中…" : "更新资料"}
                    </button>

                    {!hasAnyName && (
                      <span
                        className="text-[11px]"
                        style={{ color: "#B91C1C" }}
                      >
                        请至少填写 Preferred name / First name / Last name
                        中的一项。
                      </span>
                    )}
                    {!hasVipNumber && (
                      <span
                        className="text-[11px]"
                        style={{ color: "#B91C1C" }}
                      >
                        请填写 VIP number。
                      </span>
                    )}
                    {!isCreateMode && (
                      <span
                        className="text-[11px]"
                        style={{ color: "#9B8773" }}
                      >
                        目前仅支持「新建联系人」点击“更新资料”后写入数据库；已有
                        VIP 的修改我们下一步再接更新接口。
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

      {/* 右侧历史记录：和 Inbox 的右侧 panel 对齐 */}
      <div
        className="w-80 flex flex-col"
        style={{
          borderLeft: "1px solid var(--divider)",
          backgroundColor: "#FFFFFF",
        }}
      >
        <div
          className="px-4 pt-4 pb-2 border-b"
          style={{ borderColor: "var(--divider)" }}
        >
          <div className="flex items-center gap-4 text-[12px]">
            <button
              className="pb-1 border-b-2"
              style={{
                borderColor: "#F0C88C",
                color: "var(--text-primary)",
              }}
            >
              历史记录
            </button>
            <button
              className="pb-1"
              style={{ color: "var(--text-secondary)" }}
            >
              备注
            </button>
            <button
              className="pb-1"
              style={{ color: "var(--text-secondary)" }}
            >
              合并
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 text-[12px]">
          <HistoryItem
            channel="微信渠道"
            time="10:30 AM"
            content="客人询问是否可以延迟退房到下午 2 点。"
          />
          <HistoryItem
            channel="WhatsApp"
            time="昨天"
            content="发送了酒店位置定位。"
          />

          <button
            className="mt-3 text-[12px]"
            style={{ color: "#DAB76E" }}
          >
            查看更多历史对话
          </button>
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
                  backgroundColor: "var(--divider)",
                  color: "var(--text-secondary)",
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
            {contact.phone ? maskPhone(contact.phone) : "未填写手机号"}
          </p>
        </div>
      </div>
    </button>
  );
}

/* 小组件 & 工具函数 */

function Field({
  label,
  children,
}: {
  label: string;
  children: any;
}) {
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

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) return phone;
  const head = digits.slice(0, 3);
  const tail = digits.slice(-4);
  return `${head}*****${tail}`;
}
