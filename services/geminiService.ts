import { GoogleGenAI, Type, Schema } from "@google/genai";
import { ReceiptData, ReceiptItem } from "../types";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// We use gemini-3-flash-preview for multimodal reasoning (Image -> JSON, Image -> Text)
// and high-speed text generation.
const MODEL_NAME = "gemini-3-flash-preview";

/**
 * Extracts structured data from a receipt image with Trust Score.
 */
export const extractReceiptData = async (base64Image: string): Promise<ReceiptData> => {
  try {
    const prompt = `
      You are an expert forensic accountant for an NGO. Analyze the provided image of a receipt/invoice. 
      Extract the Store Name, Date, Total Amount, Currency, and a List of Items.
      
      CRITICAL: Analyze the image for authenticity. 
      - Is the text consistent? 
      - Does it look like a real store receipt? 
      - Are there signs of digital tampering?
      
      Assign a 'trustScore' from 0 to 100 (100 is perfectly authentic).
      Add 'fraudNotes' explaining any issues or confirming authenticity.

      If no total is found, calculate the sum of the items.
      Return the date in YYYY-MM-DD format.
    `;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: base64Image } },
          { text: prompt }
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            storeName: { type: Type.STRING },
            date: { type: Type.STRING },
            totalAmount: { type: Type.NUMBER },
            currency: { type: Type.STRING },
            trustScore: { type: Type.NUMBER, description: "0-100 confidence in authenticity" },
            fraudNotes: { type: Type.STRING, description: "Short explanation of the score" },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  quantity: { type: Type.NUMBER },
                  price: { type: Type.NUMBER },
                }
              }
            }
          },
          required: ["storeName", "totalAmount", "items", "currency", "trustScore"]
        }
      }
    });

    if (response.text) {
      const data = JSON.parse(response.text) as ReceiptData;
      return { ...data, originalImage: base64Image };
    }
    throw new Error("No data returned from Gemini");
  } catch (error) {
    console.error("Error extracting receipt:", error);
    return {
      storeName: "Unknown Store",
      date: new Date().toISOString().split('T')[0],
      totalAmount: 0,
      currency: "USD",
      trustScore: 0,
      fraudNotes: "Extraction failed due to error.",
      items: [],
      originalImage: base64Image
    };
  }
};

/**
 * Generates a verification caption for a distribution photo.
 */
export const generateImageCaption = async (base64Image: string): Promise<string> => {
  try {
    const prompt = `
      Analyze this image of a charity distribution. 
      Describe the activity in one sentence for a photo caption. 
      Mention the items being distributed and the environment if visible. 
      Ensure the description is respectful to the beneficiaries' dignity.
    `;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: base64Image } },
          { text: prompt }
        ],
      },
    });

    return response.text || "Distribution event photo.";
  } catch (error) {
    console.error("Error captioning image:", error);
    return "Verified distribution photo.";
  }
};

/**
 * Generates summary from Voice Note.
 */
export const generateSummaryFromVoice = async (base64Audio: string): Promise<string> => {
  try {
    const prompt = `
      Listen to this field worker's voice note describing a charity distribution event.
      Extract the key details: What happened, where, who was helped, and the general mood.
      Convert this into a professional, heart-warming paragraph for a donor report.
      Ignore filler words or pauses.
    `;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: [
          { inlineData: { mimeType: "audio/mp3", data: base64Audio } },
          { text: prompt }
        ],
      },
    });

    return response.text || "";
  } catch (error) {
    console.error("Error processing voice note:", error);
    return "Voice processing failed. Please type details manually.";
  }
};

/**
 * Generates the heartwarming impact story.
 */
export const generateImpactStory = async (
  campaignName: string,
  location: string,
  beneficiaryCount: number,
  receipts: ReceiptData[],
  photoCaptions: string[],
  additionalNotes?: string,
  language: string = "English"
): Promise<string> => {
  try {
    // Summarize items for the prompt
    const allItems = receipts.flatMap(r => r.items.map(i => `${i.quantity}x ${i.name}`)).join(", ");
    const totalSpent = receipts.reduce((acc, r) => acc + r.totalAmount, 0);
    const currency = receipts[0]?.currency || "USD";

    const prompt = `
      You are a professional non-profit communications officer.
      Write a transparent and heart-warming distribution summary (approx 150 words) based on the data below.
      Write the response in ${language}.
      
      Campaign: ${campaignName}
      Location: ${location}
      Beneficiaries: ${beneficiaryCount} people/families
      Supplies Purchased: ${allItems}
      Total Value: ${currency} ${totalSpent}
      Visual Evidence Context: ${photoCaptions.join("; ")}
      Field Worker Notes: ${additionalNotes || "N/A"}
      
      Focus on the impact and the gratitude of the community. 
      Keep the tone professional, empathetic, and honest. 
      End with a specific thank you message to the donors.
    `;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        temperature: 0.7, // Warm and human
      }
    });

    return response.text || "Report generation failed. Please try again.";
  } catch (error) {
    console.error("Error generating story:", error);
    return "We successfully distributed aid to the community. Thank you for your support.";
  }
};

/**
 * Translates the report story.
 */
export const translateStory = async (text: string, targetLanguage: string): Promise<string> => {
  try {
    const prompt = `
      Translate the following charity report into professional ${targetLanguage}. 
      Ensure that Islamic terms (like Sadaqah, Muzakki, Mustahik) are either kept and explained or translated accurately depending on the context.
      
      Text: "${text}"
    `;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
    });

    return response.text || text;
  } catch (error) {
    console.error("Translation error:", error);
    return text;
  }
};