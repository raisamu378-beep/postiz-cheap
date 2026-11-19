import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function getOwnedNiche(id, userId) {
  return prisma.niche.findFirst({ where: { id, userId } });
}

// PATCH: rename / restyle a niche
export async function PATCH(req, { params }) {
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
    const data = {};
    if (body.name !== undefined) {
      const name = String(body.name || "").trim();
      if (!name) return NextResponse.json({ error: "Niche name is required" }, { status: 400 });
      data.name = name;
    }
    if (body.emoji !== undefined) data.emoji = body.emoji ? String(body.emoji).slice(0, 8) : null;
    if (body.color !== undefined) data.color = String(body.color || "#612bd3");

    const updated = await prisma.niche.update({
      where: { id: niche.id },
      data,
      include: { accounts: true },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error?.code === "P2002") {
      return NextResponse.json({ error: "A niche with this name already exists" }, { status: 409 });
    }
    console.error("[NICHE_PATCH_ERROR]", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

// DELETE: remove a niche (its accounts detach, scheduled posts keep history)
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

    await prisma.niche.delete({ where: { id: niche.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[NICHE_DELETE_ERROR]", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
