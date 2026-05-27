import { getSyncPayload, saveSyncPayload } from "../server/learning.mjs";

export default async function handler(req, res) {
  if (req.method === "GET") {
    const result = await getSyncPayload(req.query);
    return res.status(result.status).json(result.body);
  }

  if (req.method === "POST") {
    const result = await saveSyncPayload(req.body);
    return res.status(result.status).json(result.body);
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
