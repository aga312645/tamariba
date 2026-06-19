// 保存 (POST)
export async function onRequestPost(context: any) {
  const { env, request } = context;
  const data = await request.json();
  
  // WHERE id = 1 で固定し、スナップショットを上書きする
  await env.DB.prepare(
    "INSERT INTO board (id, snapshot) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET snapshot = ?"
  ).bind(JSON.stringify(data), JSON.stringify(data)).run();

  return new Response("OK");
}

// 取得 (GET)
export async function onRequestGet(context: any) {
  const { env } = context;
  const result = await env.DB.prepare("SELECT snapshot FROM board WHERE id = 1").first();
  
  return new Response(result ? result.snapshot : "{}", {
    headers: { 'Content-Type': 'application/json' }
  });
}