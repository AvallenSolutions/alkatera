const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface FacilityData {
  facility_name: string;
  country: string;
  risk_level: 'high' | 'medium' | 'low';
  aware_factor: number;
  total_consumption_m3: number;
  scarcity_weighted_consumption_m3: number;
  net_consumption_m3: number;
  recycling_rate_percent: number;
  products_linked: string[];
}

interface RecommendationResponse {
  recommendations: string[];
  analysis: string;
  priority_action: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    
    if (!GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ 
          error: 'Gemini API not configured',
          recommendations: getDefaultRecommendations('medium'),
          analysis: 'AI analysis unavailable - using default recommendations',
          priority_action: 'Configure AI integration for personalised insights'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const facility: FacilityData = await req.json();

    const prompt = buildPrompt(facility);
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', errorText);
      return new Response(
        JSON.stringify({ 
          error: 'AI service temporarily unavailable',
          recommendations: getDefaultRecommendations(facility.risk_level),
          analysis: 'AI analysis unavailable - using default recommendations based on risk level',
          priority_action: getDefaultPriorityAction(facility.risk_level)
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    const parsedResponse = parseGeminiResponse(textContent, facility.risk_level);

    return new Response(
      JSON.stringify(parsedResponse),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating recommendations:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        recommendations: getDefaultRecommendations('medium'),
        analysis: 'Error generating AI recommendations',
        priority_action: 'Review facility water management practices'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function buildPrompt(facility: FacilityData): string {
  const hasWaterData = facility.total_consumption_m3 > 0;
  const hasProducts = facility.products_linked.length > 0;
  
  return `You are a water sustainability expert. Analyse this facility's water data and provide actionable recommendations.

FACILITY DATA:
- Name: ${facility.facility_name}
- Location: ${facility.country}
- Water Scarcity Risk: ${facility.risk_level.toUpperCase()}
- AWARE Factor: ${facility.aware_factor.toFixed(2)} (higher = more water-stressed region)
${hasWaterData ? `- Total Water Consumption: ${facility.total_consumption_m3.toLocaleString()} m³
- Scarcity-Weighted Impact: ${facility.scarcity_weighted_consumption_m3.toLocaleString()} m³ eq
- Net Consumption: ${facility.net_consumption_m3.toLocaleString()} m³
- Recycling Rate: ${facility.recycling_rate_percent.toFixed(1)}%` : '- No detailed water consumption data available'}
${hasProducts ? `- Products Manufactured: ${facility.products_linked.join(', ')}` : '- No products linked'}

CONTEXT:
- AWARE factors > 10 indicate extreme water stress
- AWARE factors 1-10 indicate moderate water stress
- AWARE factors < 1 indicate low water stress
- The beverage/food industry typically uses 2-5 m³ water per m³ product

Provide your response in this exact format:
ANALYSIS: [One paragraph analysing the facility's water situation based on the data]

PRIORITY_ACTION: [Single most important action to take]

RECOMMENDATION_1: [Specific, actionable recommendation]
RECOMMENDATION_2: [Specific, actionable recommendation]
RECOMMENDATION_3: [Specific, actionable recommendation]
RECOMMENDATION_4: [Specific, actionable recommendation]

Base your recommendations on the actual data provided. If data is limited, recommend data collection as a first step. Focus on practical, implementable actions appropriate for a ${facility.risk_level} risk facility.`;
}

function parseGeminiResponse(text: string, fallbackRiskLevel: string): RecommendationResponse {
  const recommendations: string[] = [];
  let analysis = '';
  let priority_action = '';

  const analysisMatch = text.match(/ANALYSIS:\s*(.+?)(?=PRIORITY_ACTION:|RECOMMENDATION_1:|$)/s);
  if (analysisMatch) {
    analysis = analysisMatch[1].trim();
  }

  const priorityMatch = text.match(/PRIORITY_ACTION:\s*(.+?)(?=RECOMMENDATION_1:|$)/s);
  if (priorityMatch) {
    priority_action = priorityMatch[1].trim();
  }

  for (let i = 1; i <= 5; i++) {
    const regex = new RegExp(`RECOMMENDATION_${i}:\\s*(.+?)(?=RECOMMENDATION_${i + 1}:|$)`, 's');
    const match = text.match(regex);
    if (match) {
      const rec = match[1].trim();
      if (rec && rec.length > 5) {
        recommendations.push(rec);
      }
    }
  }

  if (recommendations.length === 0) {
    return {
      recommendations: getDefaultRecommendations(fallbackRiskLevel as 'high' | 'medium' | 'low'),
      analysis: analysis || 'Unable to parse AI response - using default recommendations',
      priority_action: priority_action || getDefaultPriorityAction(fallbackRiskLevel as 'high' | 'medium' | 'low'),
    };
  }

  return {
    recommendations,
    analysis: analysis || 'Analysis based on facility water data and regional water stress indicators.',
    priority_action: priority_action || recommendations[0],
  };
}

function getDefaultRecommendations(riskLevel: 'high' | 'medium' | 'low'): string[] {
  switch (riskLevel) {
    case 'high':
      return [
        'Prioritise water efficiency measures and set aggressive reduction targets',
        'Explore alternative water sources including rainwater harvesting and recycled water',
        'Conduct a comprehensive water audit to identify highest-impact interventions',
        'Consider relocating water-intensive processes to lower-stress regions',
      ];
    case 'medium':
      return [
        'Implement real-time water monitoring systems to track consumption patterns',
        'Set water reduction targets of 10-15% within 12 months',
        'Investigate closed-loop water recycling for suitable processes',
        'Engage with local water authority on future water availability projections',
      ];
    case 'low':
      return [
        'Maintain efficient operations and continue monitoring water usage',
        'Document best practices for knowledge sharing with higher-risk sites',
        'Monitor regional climate projections for future water stress changes',
        'Explore opportunities to support water stewardship in the local watershed',
      ];
  }
}

function getDefaultPriorityAction(riskLevel: 'high' | 'medium' | 'low'): string {
  switch (riskLevel) {
    case 'high':
      return 'Immediately conduct a water audit and implement efficiency measures';
    case 'medium':
      return 'Install water monitoring systems to enable data-driven reduction strategies';
    case 'low':
      return 'Maintain current efficient practices while monitoring for regional changes';
  }
}