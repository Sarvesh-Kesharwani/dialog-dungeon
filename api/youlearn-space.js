import { getYoulearnSpacePayload } from "../server/learning.mjs";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const result = await getYoulearnSpacePayload(req.query);
  return res.status(result.status).json(result.body);
}
