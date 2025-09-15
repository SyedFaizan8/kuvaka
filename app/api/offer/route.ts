import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json(); // expects { name, value_props, ideal_use_cases }
        const { name, value_props, ideal_use_cases } = body;
        if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

        const created = await prisma.offer.create({
            data: {
                name,
                valueProps: value_props ?? [],
                idealUseCases: ideal_use_cases ?? [],
            },
        });
        return NextResponse.json(created);
    } catch (err: any) {
        console.error(err);
        return NextResponse.json({ error: err.message ?? "unknown" }, { status: 500 });
    }
}
