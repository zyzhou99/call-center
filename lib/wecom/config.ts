export const wecomConfig = {
  corpId: process.env.WECOM_CORP_ID!,
  agentId: process.env.WECOM_AGENT_ID!,
  secret: process.env.WECOM_APP_SECRET!,
  callbackToken: process.env.WECOM_CALLBACK_TOKEN,
  callbackAesKey: process.env.WECOM_ENCODING_AES_KEY,
};

// 简单防呆：启动时报错，避免你忘了填 env 还不知道
export function assertWecomEnv() {
  const miss: string[] = [];
  if (!wecomConfig.corpId) miss.push("WECOM_CORP_ID");
  if (!wecomConfig.secret) miss.push("WECOM_APP_SECRET");
  if (miss.length) throw new Error(`Missing env: ${miss.join(", ")}`);
}
