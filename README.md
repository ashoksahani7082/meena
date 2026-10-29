# Meena Telegram Landing Page

Blue / sky-blue / white glass UI with animated 3D background. The landing page creates a unique Telegram invite link per CTA click, stores ad attribution in Redis, and sends Meta Conversions API `Subscribe` only when a matching Telegram join-request webhook arrives.

## Meena project IDs

- Meta Pixel / dataset ID: `2355246845293608`
- Telegram channel ID: `-1003928691639`

These IDs are configured as code defaults. The matching Vercel environment variables can override them.

## Required Vercel environment variables

- `TELEGRAM_BOT_TOKEN` — bot token; the bot must be an administrator of the target channel and allowed to create invite links.
- `MEENA_TELEGRAM_CHAT_ID` — numeric Telegram channel ID; defaults to `-1003928691639`.
- `KV_REST_API_URL` — Redis REST URL.
- `KV_REST_API_TOKEN` — Redis REST token.
- `META_PIXEL_ID` — the Meena project's Meta Pixel / dataset ID; defaults to `2355246845293608` for server-side events.
- `META_CAPI_ACCESS_TOKEN` — Meta Conversions API access token.
- `MEENA_LANDING_URL` — optional deployed landing page URL.
- `META_GRAPH_API_VERSION` — optional; defaults to `v24.0`.
- `META_TEST_EVENT_CODE` — optional; set only while testing in Events Manager.

## Setup

1. Import this repository into Vercel and deploy it.
2. Add the secret environment variables above in Vercel and redeploy.
3. The browser Pixel ID is already set in `index.html` to `2355246845293608`.
4. Add the Telegram bot as a channel administrator with permission to invite users.
5. Set the bot webhook to `https://YOUR-DEPLOYMENT.vercel.app/api/telegram` and enable the `chat_join_request` update. Example request:

```text
https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=https://YOUR-DEPLOYMENT.vercel.app/api/telegram&allowed_updates=["chat_join_request"]
```

6. Test with a fresh landing-page URL carrying UTM parameters. Click the button and submit a join request through that generated invite link.
7. Check Vercel logs and Meta Events Manager Test Events. Remove `META_TEST_EVENT_CODE` after testing.

## Event logic

- PageView fires in the browser using Pixel ID `2355246845293608`.
- A click creates a unique Telegram invite and stores UTM, `_fbp`, `_fbc`, and click ID in Redis.
- The server fires `Subscribe` only for a join request whose invite link maps to a stored click ID. Organic joins or unmapped links are logged but do not fire this event.
- Telegram join request is not the same as an approved/accepted membership; the event represents the request, matching the requested flow.

Do not commit API tokens or access tokens to this repository.