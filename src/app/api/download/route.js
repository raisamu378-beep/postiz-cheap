import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

function isPrivateHost(host) {
  const h = String(host || "").toLowerCase();
  if (!h) return true;
  if (h === "localhost" || h === "::1" || h.endsWith(".local") || h.endsWith(".internal")) return true;
  if (/^(10\.|127\.|169\.254\.|192\.168\.)/.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  if (/^(0\.|\[::1\]|metadata\.google\.internal)/.test(h)) return true;
  return false;
}

export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const mediaUrl = searchParams.get("url");
  if (!mediaUrl) return NextResponse.json({ error: "Missing url" }, { status: 400 });

  let parsed;
  try {
    parsed = new URL(mediaUrl);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }
  if (!/^https?:$/.test(parsed.protocol) || isPrivateHost(parsed.hostname)) {
    return NextResponse.json({ error: "Url not allowed" }, { status: 400 });
  }

  try {
    const res = await fetch(parsed.toString(), { redirect: "follow" });
    if (!res.ok) throw new Error("Failed to fetch media");

    const contentType = res.headers.get("content-type") || "video/mp4";
    if (/^text\/html/i.test(contentType)) {
      return NextResponse.json({ error: "Unsupported content" }, { status: 415 });
    }

    const buffer = await res.arrayBuffer();
    const filename = parsed.pathname.split("/").pop() || `download_${Date.now()}.mp4`;

    return new Response(Buffer.from(buffer), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename.replace(/["\\\r\n]/g, "")}"`,
      },
    });
  } catch (err) {
    console.error("CORS proxy download error:", err);
    return NextResponse.redirect(parsed.toString());
  }
}
