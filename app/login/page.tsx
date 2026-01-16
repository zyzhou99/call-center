"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import Image from "next/image";
import loginImg from "@/assets/login.png";
import wynnWater from "@/assets/wynn-water.png";
import loginMobile from "@/assets/login-mobile.png";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const { user, login, isLoading } = useAuth();
  const router = useRouter();

  // ✅ 只用來判斷手機端 / PC 端，不動任何業務邏輯
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!isLoading && user) {
      router.push("/inbox");
    }
  }, [user, isLoading, router]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Please enter both email and password");
      return;
    }

    const success = login(email, password);
    if (success) {
      router.push("/inbox");
    } else {
      setError("Invalid email or password");
    }
  };

  if (isLoading) {
    return null;
  }

  // 🟡 手機端：結構跟 /vip-access 類似
  if (isMobile) {
    return (
      <div className="min-h-screen bg-[#fbf3e7] flex justify-center">
        <div className="w-full max-w-md flex flex-col bg-[#fbf3e7]">
          {/* 頂部頭圖 */}
          <div className="relative w-full">
            <div className="relative w-full h-[260px] overflow-hidden rounded-b-[52px]">
              <Image
                src={loginMobile}
                alt="VIP Service Center Login"
                fill
                priority
                className="object-cover object-bottom"
              />
            </div>
          </div>

          {/* 內容區 */}
          <div className="flex-1 px-7 pt-8 pb-12 flex flex-col">
            <div className="mb-6">
              <div
                className="text-[18px] font-serif tracking-[0.25em] mb-3"
                style={{ color: "#C59A4A" }}
              >
                WYNN PALACE
              </div>
              <h1
                className="text-[24px] leading-snug font-serif font-semibold mb-1"
                style={{ color: "#423E39" }}
              >
                Management Platform
              </h1>
              <p
                className="text-[12px] mt-1"
                style={{ color: "#9A9388" }}
              >
                Welcome back, please login to your account.
              </p>
            </div>

            {/* 表單卡片 */}
            <div
              className="rounded-2xl px-5 py-6"
              style={{ backgroundColor: "#fff9f0ff" }}
            >
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* EMAIL */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="email"
                    className="block text-[11px] font-semibold tracking-[0.2em]"
                    style={{ color: "#7D7870" }}
                  >
                    EMAIL ADDRESS
                  </label>
                  <input
                    id="email"
                    type="email"
                    placeholder="admin@hotel.test"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF6A33]"
                    style={{
                      borderColor: "#E4DDD2",
                      backgroundColor: "#FDFBF8",
                      color: "#423E39",
                    }}
                  />
                </div>

                {/* PASSWORD */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="password"
                    className="block text-[11px] font-semibold tracking-[0.2em]"
                    style={{ color: "#7D7870" }}
                  >
                    PASSWORD
                  </label>
                  <input
                    id="password"
                    type="password"
                    placeholder="Admin123!"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF6A33]"
                    style={{
                      borderColor: "#E4DDD2",
                      backgroundColor: "#FDFBF8",
                      color: "#423E39",
                    }}
                  />
                </div>

                {/* Remember / Forgot */}
                <div className="flex items-center justify-between pt-1 text-[11px]">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded border cursor-pointer"
                      style={{
                        borderColor: "#D4CCBF",
                        accentColor: "#C59A4A",
                      }}
                    />
                    <span style={{ color: "#6F6A63" }}>Remember me</span>
                  </label>

                  <button
                    type="button"
                    className="hover:underline"
                    style={{ color: "#B49146" }}
                  >
                    Forgot password?
                  </button>
                </div>

                {/* 錯誤提示 */}
                {error && (
                  <div className="text-xs text-red-600 bg-red-50 p-3 rounded-md">
                    {error}
                  </div>
                )}

                {/* 登录按钮 */}
                <button
                  type="submit"
                  className="w-full mt-1 py-3.5 rounded-full font-semibold tracking-[0.16em] text-[12px] uppercase transition-all hover:opacity-95"
                  style={{
                    background:
                      "linear-gradient(91deg, #F6E1B8 3.63%, #D6BB87 100%)",
                    color: "#444343",
                  }}
                >
                  LOGIN
                </button>
              </form>
            </div>

            {/* 页脚 */}
            <div
              className="mt-8 text-[10px] text-center"
              style={{ color: "#B7B0A4" }}
            >
              © 2025 Wynn Palace Service Center. | Powered by AcmePure Technology
              &amp; Services Limited
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 🟢 PC 端：保持你原來的兩欄佈局不變
  return (
    <div
      className="min-h-screen flex overflow-hidden"
      style={{ backgroundColor: "#FAF7F2" }}
    >
      {/* 左侧背景图 */}
      <div
        className="relative flex-[1.25] bg-no-repeat bg-left bg-cover"
        style={{
          backgroundImage: `url(${loginImg.src})`,
          backgroundColor: "#FAF7F2",
          backgroundPosition: "left center",
        }}
      />

      {/* 右侧登录区 */}
      <div
        className="flex-[1] flex items-center align-left relative"
        style={{ backgroundColor: "#FAF7F2" }}
      >
        {/* 底部右下角水印 */}
        <div className="absolute bottom-0 right-0 opacity-100 pointer-events-none select-none">
          <Image
            src={wynnWater}
            alt="Wynn watermark"
            className="h-46 w-auto"
            priority={false}
          />
        </div>

        <div className="w-full max-w-xl px-8 py-2">
          {/* 顶部标题区域 */}
          <div className="mb-10">
            <div
              className="text-[22px] font-serif tracking-[0.25em] mb-8"
              style={{ color: "#C59A4A" }}
            >
              WYNN PALACE
            </div>

            <h1
              className="text-[48px] leading-tight font-serif mb-3 font-semibold"
              style={{ color: "#423E39" }}
            >
              VIP Service
              <br />
              Management Center
            </h1>

            <p className="text-sm mt-2" style={{ color: "#9A9388" }}>
              Welcome Back, Please login to your account
            </p>
          </div>

          {/* 表单 */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* EMAIL */}
            <div className="space-y-2">
              <label
                htmlFor="email"
                className="block text-[11px] font-semibold tracking-[0.2em]"
                style={{ color: "#7D7870" }}
              >
                EMAIL ADDRESS
              </label>
              <input
                id="email"
                type="email"
                placeholder="admin@hotel.test"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF6A33]"
                style={{
                  borderColor: "#E4DDD2",
                  backgroundColor: "#FDFBF8",
                  color: "#423E39",
                }}
              />
            </div>

            {/* PASSWORD */}
            <div className="space-y-2">
              <label
                htmlFor="password"
                className="block text-[11px] font-semibold tracking-[0.2em]"
                style={{ color: "#7D7870" }}
              >
                PASSWORD
              </label>
              <input
                id="password"
                type="password"
                placeholder="Admin123!"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF6A33]"
                style={{
                  borderColor: "#E4DDD2",
                  backgroundColor: "#FDFBF8",
                  color: "#423E39",
                }}
              />
            </div>

            {/* Remember / Forgot */}
            <div className="flex items-center justify-between pt-1 text-xs">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border cursor-pointer"
                  style={{
                    borderColor: "#D4CCBF",
                    accentColor: "#C59A4A",
                  }}
                />
                <span style={{ color: "#6F6A63" }}>Remember me</span>
              </label>

              <button
                type="button"
                className="hover:underline"
                style={{ color: "#B49146" }}
              >
                Forgot password?
              </button>
            </div>

            {/* 错误提示 */}
            {error && (
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
                {error}
              </div>
            )}

            {/* 登录按钮 */}
            <button
              type="submit"
              className="w-full py-3.5 rounded-md font-semibold tracking-[0.16em] text-m uppercase transition-all hover:opacity-95"
              style={{
                background:
                  "linear-gradient(91deg, #F6E1B8 3.63%, #D6BB87 100%)",
                color: "#444343",
              }}
            >
              LOGIN
            </button>
          </form>

          {/* 页脚 */}
          <div className="mt-10 text-[11px]" style={{ color: "#B7B0A4" }}>
            © 2025 Wynn Palace Service Center. | Powered by AcmePure Technology
            &amp; Services Limited
          </div>
        </div>
      </div>
    </div>
  );
}
