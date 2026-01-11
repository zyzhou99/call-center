"use client";

import { useState, useEffect, ReactNode } from "react";
import type { GuestProfile } from "@/types";
import { useLanguage } from "@/contexts/language-context";
import { ChevronDown } from "lucide-react";

interface GuestProfilePanelProps {
  profile: GuestProfile | null;
  onCloseConversation: () => void;
}

// 统一格式化日期：ISO 字符串 -> "21 Jan 2021"
function formatDateValue(raw?: string | null): string {
  if (!raw) return "-";

  const d = new Date(raw);
  if (!isNaN(d.getTime())) {
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  return raw;
}

// 兜底转 string
function toRawString(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) return v.join(", ");
  return String(v);
}

// 拆 tag：支持中英文逗号、分号
function splitToTags(raw: string): string[] {
  return raw
    .split(/[，,;；]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// 取名字首字母
function getInitialsFromName(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return parts
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

const AGENT_LIST = ["Joye Duan", "Jennifer Lee", "Bryan Ng"];

export function GuestProfilePanel({ profile }: GuestProfilePanelProps) {
  const { t } = useLanguage();
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);

  // 从 profile 里先提取出原始字符串（即使 profile 为空也不会报错）
  const preferenceRawBase = profile
    ? toRawString(
        (profile as any).preference ?? (profile as any).preferences ?? ""
      )
    : "";
  const restrictionRawBase = profile
    ? toRawString(
        (profile as any).restriction ?? (profile as any).restrictions ?? ""
      )
    : "";

  // 本地可编辑的 tag 状态（点击 x 后只在前端消失，不写 DB）
  const [preferenceTags, setPreferenceTags] = useState<string[]>(() =>
    splitToTags(preferenceRawBase)
  );
  const [restrictionTags, setRestrictionTags] = useState<string[]>(() =>
    splitToTags(restrictionRawBase)
  );

  // 当前选中的客服代表 & 下拉开关
  const [selectedAgent, setSelectedAgent] = useState<string>(AGENT_LIST[0]);
  const [agentMenuOpen, setAgentMenuOpen] = useState(false);

  // 当 profile 换人 / 重新加载时，重置本地 tag 状态和默认客服
  useEffect(() => {
    setPreferenceTags(splitToTags(preferenceRawBase));
    setRestrictionTags(splitToTags(restrictionRawBase));
    setSelectedAgent(AGENT_LIST[0]);
    setAgentMenuOpen(false);
  }, [preferenceRawBase, restrictionRawBase]);

  if (!profile) return null;

  // 头像下面用 DB 的 fullName（缺失时退回 profile.name）
  const fullName =
    ((profile as any).fullName as string | undefined) || profile.name || "";

  const vipNumber = profile.vipNumber;
  const room = profile.room;

  const guestInitials = getInitialsFromName(fullName);
  const agentInitials = getInitialsFromName(selectedAgent);

  const guestDetailsTitle = t("guestDetails.title") || "GUEST DETAILS";
  const quickActionsTitle = t("quickActions.title") || "QUICK ACTIONS";

  return (
    <div
      className="w-80 bg-white flex flex-col overflow-y-auto border-l"
      style={{ borderColor: "var(--divider)" }}
    >
      {/* 顶部头像 + 基本信息 */}
      <div className="p-6 pb-4">
        <div className="flex flex-col items-center mb-2">
          <div
            className="w-24 h-24 rounded-full flex items-center justify-center text-2xl font-medium mb-3"
            style={{ backgroundColor: "#F5EBD8", color: "#B48A4A" }}
          >
            {guestInitials}
          </div>
          <h2
            className="text-xl font-semibold text-center"
            style={{ color: "var(--text-primary)" }}
          >
            {fullName}
          </h2>

          {vipNumber && (
            <div
              className="mt-2 px-3 py-1 rounded-full text-xs font-medium flex items-center"
              style={{ backgroundColor: "#F5E2CC", color: "#7A5A30" }}
            >
              <span className="mr-1 uppercase tracking-wide">VIP</span>
              <span className="mx-1">|</span>
              <span>{vipNumber}</span>
            </div>
          )}

          {room && (
            <p className="text-sm mt-1" style={{ color: "#9C7D47" }}>
              Room {room}
            </p>
          )}
        </div>
      </div>

      {/* Section 1: Guest Details */}
      <Section
        title={guestDetailsTitle}
        open={detailsOpen}
        onToggle={() => setDetailsOpen((o) => !o)}
      >
        <DetailsRow
          label={t("guestDetails.checkIn")}
          value={profile.checkInDate}
          isDate
        />
        <DetailsRow
          label={t("guestDetails.checkOut")}
          value={profile.checkOutDate}
          isDate
        />
        <DetailsRow
          label={t("guestDetails.segment")}
          value={profile.segment}
        />
        <DetailsRow
          label={t("guestDetails.status")}
          value={profile.statusLabel}
          isStatus
        />
      </Section>

      {/* Section 2: Preference Tags */}
      <Section
        title="PREFERENCES TAGS"
        open={prefsOpen}
        onToggle={() => setPrefsOpen((o) => !o)}
      >
        <div className="flex flex-wrap gap-2">
          {/* 预留的 + Add Tag 按钮 */}
          <button
            type="button"
            className="inline-flex items-center px-3 py-1 text-xs rounded-[10px] border border-dashed"
            style={{
              borderColor: "#C19A60",
              color: "#9C7D47",
              backgroundColor: "#ffffffff",
            }}
          >
            + Add Tag
          </button>

          {preferenceTags.map((tag, idx) => (
            <TagPill
              key={`pref-${idx}-${tag}`}
              kind="preference"
              label={tag}
              onRemove={() =>
                setPreferenceTags((prev) => prev.filter((_, i) => i !== idx))
              }
            />
          ))}

          {restrictionTags.map((tag, idx) => (
            <TagPill
              key={`rest-${idx}-${tag}`}
              kind="restriction"
              label={tag}
              onRemove={() =>
                setRestrictionTags((prev) => prev.filter((_, i) => i !== idx))
              }
            />
          ))}
        </div>
      </Section>

      {/* Section 3: Quick Actions */}
      <Section
        title={quickActionsTitle}
        open={actionsOpen}
        onToggle={() => setActionsOpen((o) => !o)}
      >
        <p
          className="text-xs mb-2"
          style={{ color: "var(--text-secondary)" }}
        >
          已分配的客服代表
        </p>

        <div className="relative">
          {/* 顶部选中客服按钮 */}
          <button
            type="button"
            onClick={() => setAgentMenuOpen((o) => !o)}
            className="w-full flex items-center px-3 py-2 rounded-2xl border text-left"
            style={{
              borderColor: "var(--divider)",
              backgroundColor: "#F9F8F6",
            }}
          >
            <div
              className="relative w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium mr-3"
              style={{ backgroundColor: "#F5EBD8", color: "#B48A4A" }}
            >
              {agentInitials}
              <span
                className="absolute bottom-0 right-0 w-2 h-2 rounded-full"
                style={{
                  backgroundColor: "#22C55E",
                  border: "2px solid #FFFFFF",
                }}
              />
            </div>
            <div className="flex flex-col flex-1">
              <span
                className="text-sm font-medium"
                style={{ color: "var(--text-primary)" }}
              >
                {selectedAgent}
              </span>
              <span
                className="text-xs"
                style={{ color: "var(--text-secondary)" }}
              >
                VIP Guest Services
              </span>
            </div>
            <ChevronDown
              className={`w-4 h-4 ml-2 transform transition-transform ${
                agentMenuOpen ? "rotate-180" : ""
              }`}
              style={{ color: "var(--text-secondary)" }}
            />
          </button>

          {/* 下拉菜单 */}
          {agentMenuOpen && (
            <div
              className="absolute z-20 mt-2 w-full rounded-2xl shadow-lg bg-white border"
              style={{ borderColor: "var(--divider)" }}
            >
              <div className="flex items-center justify-between px-3 pt-3 pb-2">
                <span
                  className="text-xs font-medium"
                  style={{ color: "var(--text-primary)" }}
                >
                  选择客服代表
                </span>
                <button
                  type="button"
                  onClick={() => setAgentMenuOpen(false)}
                  className="text-xs px-1"
                  style={{ color: "var(--text-secondary)" }}
                >
                  ×
                </button>
              </div>

              <div className="px-3 pb-2">
                <input
                  type="text"
                  placeholder="搜索客服代表"
                  className="w-full px-3 py-2 text-xs rounded-xl outline-none"
                  style={{
                    border: "1px solid #D1D5DB",
                    backgroundColor: "#F9FAFB",
                  }}
                />
              </div>

              <div className="max-h-60 overflow-y-auto pb-2">
                {/* “无” 选项 */}
                <AgentOption
                  name="无"
                  initials="无"
                  active={selectedAgent === "无"}
                  onSelect={() => {
                    setSelectedAgent("无");
                    setAgentMenuOpen(false);
                  }}
                  isNone
                />

                {AGENT_LIST.map((name) => (
                  <AgentOption
                    key={name}
                    name={name}
                    initials={getInitialsFromName(name)}
                    active={selectedAgent === name}
                    onSelect={() => {
                      setSelectedAgent(name);
                      setAgentMenuOpen(false);
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </Section>
    </div>
  );
}

/* ---------- 小组件 ---------- */

interface SectionProps {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}

function Section({ title, open, onToggle, children }: SectionProps) {
  return (
    <div className="border-t" style={{ borderColor: "var(--divider)" }}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-6 py-3 text-xs font-semibold uppercase tracking-wider"
        style={{ color: "var(--accent)", backgroundColor: "#F9F8F6" }}
      >
        <span>{title}</span>
        <ChevronDown
          className={`w-4 h-4 transform transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open && <div className="px-6 py-4 space-y-2">{children}</div>}
    </div>
  );
}

interface DetailsRowProps {
  label: string;
  value?: string | null;
  isStatus?: boolean;
  isDate?: boolean;
}

function DetailsRow({ label, value, isStatus, isDate }: DetailsRowProps) {
  const display = isDate ? formatDateValue(value) : value || "-";

  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
        {label}
      </span>
      {isStatus && value ? (
        <span
          className="px-2 rounded-full text-xs font-medium"
          style={{ backgroundColor: "#DCFCE7", color: "#16A34A" }}
        >
          {display}
        </span>
      ) : (
        <span
          className="text-sm font-medium text-right"
          style={{ color: "var(--text-primary)" }}
        >
          {display}
        </span>
      )}
    </div>
  );
}

interface TagPillProps {
  kind: "preference" | "restriction";
  label: string;
  onRemove?: () => void;
}

// 单个 Tag：小一点的圆角 + 右侧 x 按钮
function TagPill({ kind, label, onRemove }: TagPillProps) {
  const isRestriction = kind === "restriction";

  const bg = isRestriction ? "#FEF6F6" : "#F5F2ED";
  const text = isRestriction ? "#CB4744" : "#9C7D47";
  const border = isRestriction ? "#FEF6F6" : "#F5F2ED";

  return (
    <div
      className="inline-flex items-center px-3 py-1 text-xs font-medium"
      style={{
        backgroundColor: bg,
        color: text,
        border: `1px solid ${border}`,
        borderRadius: "10px", // 比原来的 pill 小一点
      }}
    >
      <span className="mr-1">{label}</span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-1 text-[11px] leading-none"
          style={{ color: text }}
        >
          ×
        </button>
      )}
    </div>
  );
}

interface AgentOptionProps {
  name: string;
  initials: string;
  active: boolean;
  onSelect: () => void;
  isNone?: boolean;
}

// 下拉里的单个客服选项
function AgentOption({
  name,
  initials,
  active,
  onSelect,
  isNone,
}: AgentOptionProps) {
  const isSelected = active;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full flex items-center justify-between px-3 py-2 text-sm ${
        isSelected ? "bg-[#F3F4F6]" : "hover:bg-[#F9FAFB]"
      }`}
    >
      <div className="flex items-center">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium mr-3"
          style={{
            backgroundColor: isNone ? "#FDEAD7" : "#E5F3F8",
            color: isNone ? "#C7823D" : "#0F766E",
          }}
        >
          {initials}
        </div>
        <span className="text-sm" style={{ color: "#111827" }}>
          {name}
        </span>
      </div>
      {isSelected && (
        <span
          className="text-xs font-medium"
          style={{ color: "#16A34A" }}
        >
          ✓
        </span>
      )}
    </button>
  );
}
