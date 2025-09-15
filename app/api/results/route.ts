import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
    try {
        const url = new URL(req.url);
        const batchId = url.searchParams.get("batchId");
        const offerId = url.searchParams.get("offerId");

        let where: any = {};
        if (batchId) where.batchId = Number(batchId);
        if (offerId) where.batch = { offerId: Number(offerId) };

        const leads = await prisma.lead.findMany({
            where,
            include: { result: true },
        });

        const rows = leads.map((l: any) => ({
            name: l.name,
            role: l.role,
            company: l.company,
            industry: l.industry,
            location: l.location,
            intent: l.result?.intent ?? "Unknown",
            score: l.result?.score ?? null,
            reasoning: l.result?.reasoning ?? null,
        }));

        return NextResponse.json(rows);
    } catch (err: any) {
        console.error(err);
        return NextResponse.json({ error: err.message ?? "unknown" }, { status: 500 });
    }
}
