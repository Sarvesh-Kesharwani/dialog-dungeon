import { getDialogueFilterPayload } from "../server/learning.mjs";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const result = await getDialogueFilterPayload(req.body);
  return res.status(result.status).json(result.body);
}
