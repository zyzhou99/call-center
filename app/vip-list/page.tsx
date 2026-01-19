// app/vip-list/page.tsx
"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

type VipContact = {
  id: string;
  displayName: string;
  vipNumber?: string;
  phone?: string;
  isTemp?: boolean;
  tagText?: string; // 比如 "VIP 7007222" 或 "临时"
  tagColor?: string;
  tagBg?: string;
  note?: string;
};

const MOCK_CONTACTS: VipContact[] = [
  {
    id: "guest_698",
    displayName: "Guest_698",
    phone: "待补录资料",
    isTemp: true,
    tagText: "临时",
    tagBg: "#F6E4BD",
    tagColor: "#7A5A22",
  },
  {
    id: "vip_888639",
    displayName: "滇滇滇",
    phone: "15698376707",
    vipNumber: "888639",
    tagText: "VIP 888639",
    tagBg: "#F6E4BD",
    tagColor: "#7A5A22",
  },
  {
    id: "vip_7007127",
    displayName: "Jayvion Simon",
    phone: "13800138000",
    vipNumber: "7007127",
    tagText: "VIP 7007127",
    tagBg: "#F6E4BD",
    tagColor: "#7A5A22",
  },
  {
    id: "vip_7007222",
    displayName: "Lucian Obrien",
    phone: "13912345678",
    vipNumber: "7007222",
    tagText: "VIP 7007222",
    tagBg: "#F6E4BD",
    tagColor: "#7A5A22",
  },
  {
    id: "guest_9921",
    displayName: "Guest_9921",
    phone: "待补录资料",
    isTemp: true,
    tagText: "临时",
    tagBg: "#F6E4BD",
    tagColor: "#7A5A22",
  },
];

export default function VipListPage() {
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState<string>("vip_7007222"); // 默认选中 Lucian
  const activeContact = useMemo(
    () => MOCK_CONTACTS.find((c) => c.id === activeId) ?? MOCK_CONTACTS[0],
    [activeId]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return MOCK_CONTACTS;
    return MOCK_CONTACTS.filter((c) => {
      const pool = [
        c.displayName,
        c.phone,
        c.vipNumber ? `VIP ${c.vipNumber}` : "",
      ]
        .join(" ")
        .toLowerCase();
      return pool.includes(q);
    });
  }, [search]);

  return (
    <div className="flex h-[calc(100vh-32px)] bg-[#F3F4F6]">
      {/* 左侧联系人列表 */}
      <div className="w-80 flex flex-col border-r border-[#E3E3E3] bg-[#F9F8F6]">
        {/* 顶部导入导出 */}
        <div className="px-4 pt-4 pb-2 flex items-center justify-between gap-2">
          <button className="px-3 py-1.5 rounded-md border border-[#E0DFDD] text-[11px] text-[#4B3A2B] bg-white">
            导入联系人
          </button>
          <button className="px-3 py-1.5 rounded-md border border-[#E0DFDD] text-[11px] text-[#4B3A2B] bg-white">
            导出
          </button>
        </div>

        {/* 搜索框 */}
        <div className="px-4 pb-2">
          <input
            placeholder="搜索姓名、手机号或VIP号..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-2 rounded-md border border-[#E0DFDD] bg-white text-[12px] text-[#3A3023] placeholder:text-[#B3A89B] focus:outline-none focus:ring-1 focus:ring-[#D6B56A]"
          />
        </div>

        {/* 新建 + 临时 */}
        <div className="px-4 pb-3 flex items-center gap-2">
          <button className="flex-1 h-9 rounded-md bg-[#DAB76E] text-[12px] text-white font-medium shadow-sm">
            + 新建联系人
          </button>
          <button className="h-9 px-3 rounded-md border border-[#DAB76E] text-[12px] text-[#7A5A22] bg-white">
            临时码
          </button>
        </div>

        {/* 联系人列表 */}
        <div className="flex-1 overflow-y-auto">
          {filtered.map((c) => {
            const isActive = c.id === activeId;
            const initials = getInitials(c.displayName);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setActiveId(c.id)}
                className={cn(
                  "w-full px-4 py-3 flex items-center gap-3 text-left text-[12px] border-l-4 border-transparent transition-colors",
                  isActive ? "bg-white border-[#DAB76E]" : "hover:bg-[#F2ECE4]"
                )}
              >
                {/* 头像 */}
                <div className="w-8 h-8 rounded-full bg-[#E4E0DA] flex items-center justify-center text-[11px] text-[#4B3A2B] font-medium">
                  {c.isTemp ? "?" : initials}
                </div>
                {/* 文案 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="truncate text-[#3A3023]">
                      {c.displayName}
                    </span>
                    {c.tagText && (
                      <span
                        className="px-1.5 py-0.5 rounded-full text-[10px] font-medium"
                        style={{
                          backgroundColor: c.tagBg ?? "#F6E4BD",
                          color: c.tagColor ?? "#7A5A22",
                        }}
                      >
                        {c.tagText}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-[#9B8773] truncate">
                    {c.phone || "—"}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 中间详情编辑区 */}
      <div className="flex-1 flex flex-col bg-[#F7F8FA]">
        {activeContact ? (
          <>
            {/* 顶部标题 */}
            <div className="px-12 pt-8 pb-4 border-b border-[#E6E6E6] flex items-center justify-between bg-[#FDFDFD]">
              <div>
                <div className="text-[11px] text-[#9B8773] mb-1">
                  联系人 /{" "}
                  <span className="font-medium text-[#4B3A2B]">
                    {activeContact.displayName}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-xl font-semibold text-[#3A3023]">
                    {activeContact.displayName}
                  </div>
                  {activeContact.vipNumber && (
                    <span className="px-2 py-0.5 rounded-full text-[11px] bg-[#F6E4BD] text-[#7A5A22]">
                      VIP {activeContact.vipNumber}
                    </span>
                  )}
                </div>
                <div className="mt-1 text-[11px] text-[#9B8773]">
                  创建于 10 分钟前 · 在线状态：活跃 · 喜欢硬枕头
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button className="px-3 py-1.5 rounded-md border border-[#E0DFDD] text-[12px] text-[#4B3A2B] bg-white">
                  屏蔽
                </button>
                <button className="px-3 py-1.5 rounded-md bg-[#DAB76E] text-[12px] text-white font-medium">
                  发送消息
                </button>
              </div>
            </div>

            {/* 编辑表单 */}
            <div className="px-12 py-8 flex-1 flex flex-col gap-10 overflow-y-auto">
              {/* 编辑联系人资料 */}
              <section>
                <div className="text-[11px] font-semibold tracking-[0.18em] uppercase text-[#B28A4A] mb-3">
                  编辑联系人资料
                </div>

                <div className="grid grid-cols-2 gap-4 max-w-3xl text-[13px]">
                  <Field label="姓名">
                    <input
                      defaultValue={activeContact.displayName}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="VIP 号">
                    <input
                      defaultValue={activeContact.vipNumber ?? ""}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="手机号">
                    <input
                      defaultValue={activeContact.phone ?? ""}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="邮箱">
                    <input
                      defaultValue={
                        activeContact.vipNumber
                          ? "j.simon@wynn.com"
                          : ""
                      }
                      className={inputClass}
                    />
                  </Field>
                  <Field label="房号">
                    <input
                      defaultValue={
                        activeContact.id === "vip_7007222"
                          ? "Room 306"
                          : ""
                      }
                      className={inputClass}
                    />
                  </Field>
                  <Field label="生日">
                    <input
                      defaultValue={
                        activeContact.id === "vip_7007222"
                          ? "1990/01/21"
                          : ""
                      }
                      className={inputClass}
                    />
                  </Field>
                </div>

                <div className="mt-6">
                  <button className="px-5 py-2 rounded-md bg-[#DAB76E] text-[12px] text-white font-medium">
                    保存修改
                  </button>
                </div>
              </section>

              {/* 渠道与二维码 */}
              <section>
                <div className="text-[11px] font-semibold tracking-[0.18em] uppercase text-[#B28A4A] mb-3">
                  渠道与二维码
                </div>

                <div className="flex flex-wrap gap-3 text-[12px]">
                  <button className="px-4 py-2 rounded-md border border-dashed border-[#DAB76E] bg-[#FFF9EB] text-[#7A5A22]">
                    生成二维码
                  </button>
                  <button className="px-4 py-2 rounded-md border border-[#E0DFDD] bg-white text-[#4B3A2B]">
                    绑定微信
                  </button>
                  <button className="px-4 py-2 rounded-md border border-[#E0DFDD] bg-white text-[#4B3A2B]">
                    绑定 WhatsApp
                  </button>
                  <button className="px-4 py-2 rounded-md border border-[#E0DFDD] bg-white text-[#4B3A2B]">
                    发送邮件
                  </button>
                </div>
              </section>
            </div>
          </>
        ) : null}
      </div>

      {/* 右侧历史记录 */}
      <div className="w-80 flex flex-col border-l border-[#E3E3E3] bg-white">
        {/* tabs */}
        <div className="px-4 pt-4 pb-2 border-b border-[#E6E6E6] flex items-center gap-4 text-[12px]">
          <button className="pb-1 border-b-2 border-[#DAB76E] text-[#3A3023]">
            历史记录
          </button>
          <button className="pb-1 text-[#9B8773]">属性</button>
          <button className="pb-1 text-[#9B8773]">备注</button>
          <button className="pb-1 text-[#9B8773]">合并</button>
        </div>

        {/* History list（静态示例） */}
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

          <button className="mt-3 text-[12px] text-[#DAB76E]">
            查看更多历史对话
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-[#4B3A2B] text-[13px]">
      <span className="text-[11px] text-[#9B8773]">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  "h-9 px-3 rounded-md border border-[#E0DFDD] bg-white text-[13px] text-[#3A3023] placeholder:text-[#B3A89B] focus:outline-none focus:ring-1 focus:ring-[#D6B56A]";

function HistoryItem(props: { channel: string; time: string; content: string }) {
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-[#E4F6E8] flex items-center justify-center text-[11px] text-[#2F7D32]">
            {/* 简单图标占位 */}
            {props.channel === "微信渠道" ? "微" : "W"}
          </div>
          <div className="text-[11px] text-[#4B3A2B]">{props.channel}</div>
        </div>
        <div className="text-[10px] text-[#9B8773]">{props.time}</div>
      </div>
      <div className="text-[12px] text-[#4B3A2B]">{props.content}</div>
    </div>
  );
}

function getInitials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
