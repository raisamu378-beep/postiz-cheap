import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET: list niches with their connected accounts
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const niches = await prisma.niche.findMany({
      where: { userId: session.user.id },
      include: { accounts: true },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(niches);
  } catch (error) {
    console.error("[NICHES_GET_ERROR]", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

// POST: create a niche
export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    const name = String(body.name || "").trim();
    if (!name) {
      return NextResponse.json({ error: "Niche name is required" }, { status: 400 });
    }

    const niche = await prisma.niche.create({
      data: {
        userId: session.user.id,
        name,
        emoji: body.emoji ? String(body.emoji).slice(0, 8) : null,
        color: body.color ? String(body.color) : "#612bd3",
      },
      include: { accounts: true },
    });

    return NextResponse.json(niche, { status: 201 });
  } catch (error) {
    if (error?.code === "P2002") {
      return NextResponse.json({ error: "A niche with this name already exists" }, { status: 409 });
    }
    console.error("[NICHES_POST_ERROR]", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
