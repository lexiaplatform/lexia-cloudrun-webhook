import axios from "axios";

const DPK_URL = (process.env.DPK_AGENT_URL || "").replace(/\/$/, "");
const DPK_SECRET = process.env.DPK_SHARED_SECRET || "";

export async function dpkChat(params: {
  session_id: string;
  text: string;
  message_id?: string;
  context?: string;
}) {
  if (!DPK_URL) throw new Error("DPK_AGENT_URL is not set");

  const { data } = await axios.post(
    `${DPK_URL}/chat`,
    {
      session_id: params.session_id,
      text: params.text,
      message_id: params.message_id,
      context: params.context,
    },
    {
      headers: DPK_SECRET ? { "x-dpk-secret": DPK_SECRET } : {},
      timeout: 60000,
    }
  );

  return data as { reply: string };
}
