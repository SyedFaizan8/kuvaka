import { NextRequest, NextResponse } from "next/server";
import { parse } from "csv-parse/sync";
import prisma from "@/lib/prisma";

interface LeadRow {
    name: string;
    role: string;
    company: string;
    industry: string;
    location: string;
    linkedin_bio?: string;
}

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();

        const offerId = formData.get("offerId");
        const file = formData.get("file") as File | null;

        if (!offerId || !file) {
            return NextResponse.json(
                { error: `Missing ${!offerId ? !offerId && !file ? 'offerId and csv file' : 'offerId' : 'csv file'}` },
                { status: 400 }
            );
        }

        // ✅ Read CSV text from uploaded file
        const text = await file.text();

        // ✅ Parse CSV into objects
        const records = parse(text, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
        }) as LeadRow[];

        if (!records.length) {
            return NextResponse.json(
                { error: "CSV file is empty or invalid" },
                { status: 400 }
            );
        }

        // ✅ Create a Batch linked to the Offer
        const batch = await prisma.batch.create({
            data: { offerId: Number(offerId) },
        });

        // ✅ Insert leads in bulk
        await prisma.lead.createMany({
            data: records.map((r) => ({
                batchId: batch.id,
                name: r.name ?? "",
                role: r.role ?? "",
                company: r.company ?? "",
                industry: r.industry ?? "",
                location: r.location ?? "",
                linkedinBio: r.linkedin_bio ?? "",
            })),
        });

        return NextResponse.json({
            batchId: batch.id,
            insertedCount: records.length,
        });
    } catch (err: any) {
        console.error(err);
        return NextResponse.json(
            { error: err.message ?? "unknown" },
            { status: 500 }
        );
    }
}
