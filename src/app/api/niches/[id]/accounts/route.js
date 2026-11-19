import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const ALLOWED_PLATFORMS = ["youtube", "facebook", "instagram", "tiktok"];

async function getOwnedNiche(id, userId) {
  return prisma.niche.findFirst({ where: { id, userId } });
}

// POST: attach (or replace) the account used for one platform of a niche
export async function POST(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { id } = await params;
    const niche = await getOwnedNiche(id, session.user.id);
    if (!niche) {
      return NextResponse.json({ error: "Niche not found" }, { status: 404 });
    }

    const body = await req.json();
    const platform = String(body.platform || "").toLowerCase();
    const accountId = parseInt(body.accountId, 10);

    if (!ALLOWED_PLATFORMS.includes(platform)) {
      return NextResponse.json({ error: `Unsupported platform: ${platform}` }, { status: 400 });
    }
    if (!Number.isFinite(accountId)) {
      return NextResponse.json({ error: "Valid accountId is required" }, { status: 400 });
    }

    const accountName = String(body.accountName || `${niche.name} ${platform}`).slice(0, 200);

    const saved = await prisma.nicheAccount.upsert({
      where: { nicheId_platform: { nicheId: niche.id, platform } },
      update: { accountId, accountName },
      create: { nicheId: niche.id, platform, accountId, accountName },
    });

    return NextResponse.json(saved, { status: 201 });
  } catch (error) {
    console.error("[NICHE_ACCOUNT_POST_ERROR]", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

// DELETE: detach the account of one platform
export async function DELETE(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { id } = await params;
    const niche = await getOwnedNiche(id, session.user.id);
    if (!niche) {
      return NextResponse.json({ error: "Niche not found" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const platform = String(searchParams.get("platform") || "").toLowerCase();
    if (!ALLOWED_PLATFORMS.includes(platform)) {
      return NextResponse.json({ error: `Unsupported platform: ${platform}` }, { status: 400 });
    }

    await prisma.nicheAccount.deleteMany({ where: { nicheId: niche.id, platform } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[NICHE_ACCOUNT_DELETE_ERROR]", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
