// データの読み込み（GET）
export const onRequestGet = async (context: any) => {
  const { env } = context;
  try {
    const { results } = await env.DB.prepare("SELECT state FROM board_state WHERE id = 'main'").all();
    const state = results[0]?.state || "{}";
    return new Response(state, { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response("{}", { headers: { "Content-Type": "application/json" } });
  }
};

// データの保存（POST）
export const onRequestPost = async (context: any) => {
  const { request, env } = context;
  const body = await request.text();
  await env.DB.prepare("UPDATE board_state SET state = ? WHERE id = 'main'").bind(body).run();
  return new Response("OK");
};