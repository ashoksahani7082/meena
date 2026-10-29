async function redisCommand(command) {
  const url = process.env.KV_REST_API_URL, token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error("Redis environment variables are not configured");
  const r = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(command) });
  const d = await r.json(); if (!r.ok || d.error) throw new Error(d.error || "Redis command failed"); return d.result;
}
async function sendMetaSubscribe(a, eventTime, eventId) {
  const accessToken = process.env.META_CAPI_ACCESS_TOKEN, pixelId = process.env.META_PIXEL_ID || "2355246845293608";
  const version = process.env.META_GRAPH_API_VERSION || "v24.0", testCode = process.env.META_TEST_EVENT_CODE;
  if (!accessToken) throw new Error("META_CAPI_ACCESS_TOKEN is not configured");
  const userData = {};
  if (a?.fbp) userData.fbp = a.fbp;
  if (a?.fbc) userData.fbc = a.fbc;
  if (a?.click_id) {
    const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(a.click_id));
    userData.external_id = Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,"0")).join("");
  }
  const payload = { data: [{ event_name:"Subscribe", event_time:eventTime, event_id:eventId,
    action_source:"website", event_source_url:a?.landing_url || process.env.MEENA_LANDING_URL || "https://example.com/",
    user_data:userData }] };
  if (testCode) payload.test_event_code = testCode;
  const r = await fetch(`https://graph.facebook.com/${version}/${pixelId}/events?access_token=${encodeURIComponent(accessToken)}`, {
    method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify(payload)
  });
  const d=await r.json(); if(!r.ok||d.error) throw new Error(d.error?.message||"Meta CAPI request failed"); return d;
}
export default async function handler(req,res) {
  if(req.method!=="POST") return res.status(405).json({ok:false,error:"Method not allowed"});
  try {
    const update=req.body||{};
    if(update?.chat_join_request) {
      const q=update.chat_join_request;
      const expectedChatId = process.env.MEENA_TELEGRAM_CHAT_ID || "-1003928691639";
      if(String(q.chat?.id)!==String(expectedChatId)) {
        console.warn("Ignoring join request for a different Telegram chat", q.chat?.id);
        return res.status(200).json({ok:true});
      }
      const invite=q.invite_link?.invite_link||null;
      let a=null;
      if(invite){const raw=await redisCommand(["GET",`invite:${invite}`]);if(raw){try{a=JSON.parse(raw)}catch{a=null}}}
      const subscriber={telegram_user_id:q.from?.id||null,telegram_username:q.from?.username||null,chat_id:q.chat?.id||null,
        join_request_at:q.date?new Date(q.date*1000).toISOString():new Date().toISOString(),invite_link:invite,
        source:a?.source||null,campaign:a?.campaign||null,medium:a?.medium||null,content:a?.content||null,term:a?.term||null,
        click_id:a?.click_id||null,fbp:a?.fbp||null,fbc:a?.fbc||null};
      const recordId=`${Date.now()}_${q.from?.id||"unknown"}`;
      await redisCommand(["SET",`meena:subscriber:${recordId}`,JSON.stringify(subscriber),"EX",7776000]);
      if(a?.click_id) {
        const eventId=`meena_subscriber_${a.click_id}`;
        try { const result=await sendMetaSubscribe(a,q.date||Math.floor(Date.now()/1000),eventId);
          console.log("Meena Meta CAPI Subscribe sent",{event_id:eventId,click_id:a.click_id,events_received:result.events_received});
        } catch(e) { console.error("Meena Meta CAPI Subscribe failed:",e.message); }
      } else console.warn("Join request has no matching ad click attribution; Subscribe event not sent");
      console.log("Meena Telegram join request saved",{chat_id:subscriber.chat_id,user_id:subscriber.telegram_user_id,
        username:subscriber.telegram_username,source:subscriber.source,campaign:subscriber.campaign,click_id:subscriber.click_id});
    }
    return res.status(200).json({ok:true});
  } catch(e) { console.error("Meena Telegram webhook error:",e); return res.status(500).json({ok:false}); }
}