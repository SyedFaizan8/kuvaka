// app/api/score/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { roleScore, industryScore, completenessScore } from "@/lib/scoring";
import { callGeminiRaw, parseGeminiIntent } from "@/lib/gemini";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { batchId, offerId } = body;
        if (!batchId || !offerId) return NextResponse.json({ error: "batchId and offerId required" }, { status: 400 });

        const offer = await prisma.offer.findUnique({ where: { id: Number(offerId) } });
        if (!offer) return NextResponse.json({ error: "offer not found" }, { status: 404 });

        const leads = await prisma.lead.findMany({ where: { batchId: Number(batchId) } });

        const results = [];
        for (const lead of leads) {
            // Rule layer (max 50)
            const rRole = roleScore(lead.role);
            const rIndustry = industryScore(lead.industry, offer);
            const rCompleteness = completenessScore(lead);
            const ruleScoreTotal = rRole + rIndustry + rCompleteness; // 0-50

            // Build prompt for Gemini
            const prompt = `
                    You are a sales qualification assistant.
                    Product/Offer: ${offer.name}
                    Value propositions: ${offer.valueProps.join("; ")}
                    Ideal use cases: ${offer.idealUseCases.join("; ")}

                    Prospect:
                    Name: ${lead.name}
                    Role: ${lead.role}
                    Company: ${lead.company}
                    Industry: ${lead.industry}
                    Location: ${lead.location}
                    LinkedIn Bio: ${lead.linkedinBio || "N/A"}

                    Task: Classify intent as exactly one of: High, Medium, Low.
                    Respond in this exact format:

                    INTENT: <High|Medium|Low>
                    REASON: <One or two sentence explanation why.>

                    Only output those two lines (INTENT and REASON).
                    `;

            // Call Gemini
            let aiText = null;
            try {
                const aiResp = await callGeminiRaw(prompt);
                aiText = aiResp.text ?? JSON.stringify(aiResp.raw).slice(0, 1000);
            } catch (e: any) {
                console.error("Gemini error for lead", lead.id, e?.message ?? e);
                aiText = null;
            }
            const parsed = parseGeminiIntent(aiText);

            const aiPoints = parsed.intent === "High" ? 50 : parsed.intent === "Medium" ? 30 : 10;
            let finalScore = ruleScoreTotal + aiPoints;
            if (finalScore > 100) finalScore = 100;

            const reasoning = `Rule: role ${rRole}, industry ${rIndustry}, completeness ${rCompleteness}. AI: ${parsed.explanation}`;

            // upsert LeadResult
            const saved = await prisma.leadResult.upsert({
                where: { leadId: lead.id },
                update: {
                    intent: parsed.intent,
                    score: finalScore,
                    reasoning,
                },
                create: {
                    leadId: lead.id,
                    intent: parsed.intent,
                    score: finalScore,
                    reasoning,
                },
            });

            results.push({
                leadId: lead.id,
                name: lead.name,
                role: lead.role,
                company: lead.company,
                intent: parsed.intent,
                score: finalScore,
                reasoning,
            });
        }

        return NextResponse.json({ success: true, results });
    } catch (err: any) {
        console.error(err);
        return NextResponse.json({ error: err.message ?? "unknown" }, { status: 500 });
    }
}
