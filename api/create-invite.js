export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.MEENA_TELEGRAM_CHAT_ID || "-1003928691639";
  const redisUrl = process.env.KV_REST_API_URL;
  const redisToken = process.env.KV_REST_API_TOKEN;
  if (!token) return res.status(500).json({ ok: false, error: "TELEGRAM_BOT_TOKEN is not configured" });
  if (!redisUrl || !redisToken) return res.status(500).json({ ok: false, error: "Redis environment variables are not configured" });
  try {
    const body = req.body || {};
    const clean = (v, max = 200) => typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
    const clickId = crypto.randomUUID().replaceAll("-", "");
    const attribution = {
      click_id: clickId, source: clean(body.source), campaign: clean(body.campaign),
      medium: clean(body.medium), content: clean(body.content), term: clean(body.term),
      landing_referrer: clean(body.landing_referrer, 120), landing_url: clean(body.landing_url, 1000),
      fbp: clean(body.fbp, 200), fbc: clean(body.fbc, 200),
      user_agent: clean(body.user_agent, 500), created_at: new Date().toISOString()
    };
    const tg = await fetch(`https://api.telegram.org/bot${token}/createChatInviteLink`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, name: `meena_${clickId.slice(0, 20)}`,
        expire_date: Math.floor(Date.now()/1000) + 7*24*60*60, creates_join_request: true })
    });
    const tgData = await tg.json();
    if (!tg.ok || !tgData.ok || !tgData.result?.invite_link) {
      console.error("Telegram invite creation failed", tgData);
      return res.status(502).json({ ok: false, error: tgData.description || "Could not create Telegram invite link" });
    }
    const inviteLink = tgData.result.invite_link;
    console.log("Meena Telegram invite created", { click_id: clickId, chat_id: chatId, source: attribution.source, campaign: attribution.campaign });
    const rr = await fetch(redisUrl, { method: "POST", headers: {
      Authorization: `Bearer ${redisToken}`, "content-type": "application/json"
    }, body: JSON.stringify(["SET", `invite:${inviteLink}`, JSON.stringify({ ...attribution, invite_link: inviteLink }), "EX", 691200]) });
    const rd = await rr.json();
    if (!rr.ok || rd.error) { console.error("Redis mapping save failed", rd); return res.status(502).json({ ok: false, error: "Could not save attribution mapping" }); }
    console.log("Meena invite attribution saved", { click_id: clickId, source: attribution.source, campaign: attribution.campaign });
    return res.status(200).json({ ok: true, invite_link: inviteLink, click_id: clickId });
  } catch (e) {
    console.error("Create invite error:", e);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
}