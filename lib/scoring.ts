import type { Offer } from "../app/generated/prisma";

export function roleScore(role: string) {
    const r = role?.toLowerCase() ?? "";
    const decisionMakerKeywords = [
        "ceo",
        "chief",
        "cto",
        "cfo",
        "coo",
        "founder",
        "co-founder",
        "vp",
        "vice president",
        "head of",
        "director",
        "owner",
    ];
    const influencerKeywords = ["manager", "lead", "principal", "senior", "growth", "product", "marketing"];

    for (const kw of decisionMakerKeywords) if (r.includes(kw)) return 20;
    for (const kw of influencerKeywords) if (r.includes(kw)) return 10;
    return 0;
}

export function industryScore(industry: string, offer: Offer) {
    const ind = (industry || "").toLowerCase().trim();
    if (!ind) return 0;

    const ideals = (offer.idealUseCases || []).map((s) => s.toLowerCase());
    // Exact match
    for (const ideal of ideals) {
        if (ind === ideal) return 20;
    }
    // substring / adjacent
    for (const ideal of ideals) {
        if (ind.includes(ideal) || ideal.includes(ind) || ind.split(" ").some(w => ideal.includes(w) || w && ideal.includes(w))) {
            return 10;
        }
    }
    return 0;
}

export function completenessScore(lead: {
    name?: string;
    role?: string;
    company?: string;
    industry?: string;
    location?: string;
    linkedinBio?: string | null;
}) {
    const required = ["name", "role", "company", "industry", "location"];
    for (const f of required) {
        if (!lead[f as keyof typeof lead] || (lead[f as keyof typeof lead] as string).trim() === "") return 0;
    }
    return 10;
}
