import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { guardAiCall, corsHeaders } from "../_shared/ai-guard.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { symptoms, vehicle, services_catalog, parts_catalog, shop_id } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const promptKey = JSON.stringify({ s: symptoms, v: vehicle?.make + "/" + vehicle?.model + "/" + vehicle?.year });
    const guard = await guardAiCall({
      req,
      shopId: shop_id,
      functionName: "ai-diagnosis",
      prompt: promptKey,
      metadata: { vehicle: vehicle?.model ?? null },
    });
    if (!guard.ok) return guard.response;

    // Cache hit — serve immediately
    if (guard.cached) {
      return new Response(JSON.stringify(guard.cached), {
        headers: { ...corsHeaders, "Content-Type": "application/json", "X-AI-Cached": "1" },
      });
    }

    const vehicleInfo = vehicle
      ? `Vehicle: ${vehicle.make} ${vehicle.model} (${vehicle.year}), ${vehicle.fuel}, ${vehicle.mileage?.toLocaleString() || '?'} km`
      : "Vehicle info not available";

    const catalogInfo = services_catalog?.length
      ? `\nAvailable services in catalog:\n${services_catalog.map((s: any) => `- ${s.name} (€${s.default_price})`).join("\n")}`
      : "";

    const partsInfo = parts_catalog?.length
      ? `\nAvailable parts in stock:\n${parts_catalog.map((p: any) => `- ${p.name} (ref: ${p.reference || 'N/A'}, €${p.sale_price}, stock: ${p.stock_quantity})`).join("\n")}`
      : "";

    const systemPrompt = `You are an expert automotive mechanic AI assistant for a professional garage management system (GarageFlow).
Your role is to analyze reported symptoms and provide a structured diagnosis.

ALWAYS respond in the SAME LANGUAGE as the symptoms input. If symptoms are in Portuguese, respond in Portuguese. If in English, respond in English. If in Spanish, respond in Spanish.

You must return a JSON response using the tool provided. Be specific, practical, and cost-aware.
${vehicleInfo}
${catalogInfo}
${partsInfo}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Customer reported symptoms: "${symptoms}"\n\nPlease provide a complete diagnosis.` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "provide_diagnosis",
              description: "Provide a structured vehicle diagnosis based on reported symptoms.",
              parameters: {
                type: "object",
                properties: {
                  diagnosis_summary: {
                    type: "string",
                    description: "Brief summary of the likely issue (2-3 sentences)"
                  },
                  possible_causes: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        cause: { type: "string" },
                        probability: { type: "string", enum: ["high", "medium", "low"] },
                        explanation: { type: "string" }
                      },
                      required: ["cause", "probability"],
                      additionalProperties: false
                    }
                  },
                  recommended_services: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        service: { type: "string" },
                        priority: { type: "string", enum: ["urgent", "recommended", "optional"] },
                        estimated_hours: { type: "number" }
                      },
                      required: ["service", "priority"],
                      additionalProperties: false
                    }
                  },
                  parts_needed: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        part_name: { type: "string" },
                        quantity: { type: "number" },
                        notes: { type: "string" }
                      },
                      required: ["part_name", "quantity"],
                      additionalProperties: false
                    }
                  },
                  safety_warning: {
                    type: "string",
                    description: "Safety warning if the issue is dangerous. Null if not critical."
                  },
                  estimated_severity: {
                    type: "string",
                    enum: ["low", "medium", "high", "critical"]
                  }
                },
                required: ["diagnosis_summary", "possible_causes", "recommended_services", "parts_needed", "estimated_severity"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "provide_diagnosis" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No diagnosis generated");

    const diagnosis = JSON.parse(toolCall.function.arguments);
    await guard.saveCache(diagnosis);
    return new Response(JSON.stringify(diagnosis), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-diagnosis error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
