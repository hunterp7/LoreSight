import type { IncomingMessage, ServerResponse } from "node:http";
import { handleNodeRequest } from "../server/src/index.js";

export default function mcp(req: IncomingMessage, res: ServerResponse) {
  const originalUrl = req.url ?? "/";
  req.url = `/mcp${new URL(originalUrl, "http://vercel.local").search}`;
  return handleNodeRequest(req, res);
}
