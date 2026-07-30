import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "5mb" }));

// Initialize Gemini AI Client
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
};

// Health Check API
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "VLearn AI Tutor Server" });
});

// AI Tutor Chat API
app.post("/api/tutor/chat", async (req, res) => {
  try {
    const { message, selectedText, pageContext, slideTitle, chatHistory, language } = req.body;

    const isVietnamese = language === "VI" || /[\u00C0-\u024F\u1EA0-\u1EF9]/.test(message || "") || language !== "EN";

    const ai = getGeminiClient();

    if (!ai) {
      // Intelligent mock response generator if GEMINI_API_KEY is missing
      const mockReply = generateFallbackResponse(message, selectedText, pageContext, isVietnamese);
      return res.json({ reply: mockReply, source: "mock" });
    }

    const systemInstruction = `You are VLearn Tutor, a context-aware learning assistant for students studying lecture slides and course material.
Language: ${isVietnamese ? "Vietnamese (primary)" : "English"}.
Current Slide Page: Slide ${pageContext || 1}
Slide Title / Subject: ${slideTitle || "COMP2010 - Lecture Material"}
Selected Text Highlighted by Student: "${selectedText || "None"}"

Guidelines:
1. Provide concise, encouraging, clear, and structured answers (use markdown bullet points, bold key terms, short paragraphs).
2. If the user asks about the highlighted text, explain it clearly with an example or context from the slide.
3. If asked for a summary, offer key takeaways in 3 quick bullet points.
4. Keep the tone friendly, academic, professional, and helpful.
`;

    // Construct conversation prompt
    let prompt = "";
    if (selectedText) {
      prompt += `[Student highlighted text on Slide ${pageContext}]: "${selectedText}"\n`;
    }
    prompt += `Student Question: ${message}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    const reply = response.text || (isVietnamese ? "Xin lỗi, tôi chưa thể trả lời câu hỏi này ngay lúc này." : "Sorry, I couldn't generate a response right now.");

    res.json({ reply, source: "gemini" });
  } catch (error: any) {
    console.error("Gemini Tutor Chat error:", error);
    const isVietnamese = req.body.language === "VI" || true;
    const fallbackReply = generateFallbackResponse(req.body.message, req.body.selectedText, req.body.pageContext, isVietnamese);
    res.json({ reply: fallbackReply, source: "fallback_error" });
  }
});

function generateFallbackResponse(message: string, selectedText: string | undefined, pageContext: number | undefined, isVietnamese: boolean): string {
  const q = (message || "").toLowerCase();

  if (selectedText) {
    if (isVietnamese) {
      return `**Giải thích thuật ngữ vừa bôi đen:**\n\n> "${selectedText}"\n\n- **Ý nghĩa chính:** Đây là khái niệm trọng tâm trên **Trang slide ${pageContext || 1}**. Khái niệm này chuyển đổi các yêu cầu kinh doanh còn mơ hồ thành các định nghĩa rõ ràng cho hệ thống AI.\n- **Ứng dụng:** Giúp đội ngũ kỹ sư và thiết kế xác định rõ mục tiêu, chỉ số đo lường (KPI) và các trường hợp biên của mô hình AI.\n\nBạn có muốn mình đưa ra ví dụ thực tế về thuật ngữ này không?`;
    } else {
      return `**Explanation for selected text:**\n\n> "${selectedText}"\n\n- **Core Concept:** This is a key topic on **Slide ${pageContext || 1}**. It addresses transforming ambiguous requirements into concrete AI problem definitions.\n- **Practical Application:** Helps engineering and design teams clarify target metrics, input/output data, and constraints.\n\nWould you like a real-world example or quick quiz on this topic?`;
    }
  }

  if (q.includes("tóm tắt") || q.includes("summary") || q.includes("slide")) {
    if (isVietnamese) {
      return `**Tóm tắt Slide ${pageContext || 1}:**\n\n1. **Xác định bài toán AI:** Chuyển đổi từ nhu cầu mơ hồ của doanh nghiệp thành **Problem Statement** cụ thể.\n2. **Tác giả / Giảng viên:** Mai Anh Nguyen (Blue) - Instructor COMP2010.\n3. **Mục tiêu buổi học:** Nắm vững quy trình thiết kế sản phẩm AI trong thực tế (**AI in Action - Day 02**).\n\nBạn có cần tóm tắt chi tiết các slide tiếp theo không?`;
    } else {
      return `**Summary for Slide ${pageContext || 1}:**\n\n1. **Define the AI Problem:** Moving from vague user requests to a well-defined **Problem Statement**.\n2. **Instructor:** Mai Anh Nguyen (Blue) - COMP2010 Course.\n3. **Core Learning Objective:** Master the practical framework for AI product design (**AI in Action - Day 02**).\n\nLet me know if you want me to expand on any specific section!`;
    }
  }

  if (isVietnamese) {
    return `Cảm ơn bạn đã đặt câu hỏi! Trên **Slide ${pageContext || 1}**, điểm quan trọng nhất là làm thế nào để biến ý tưởng AI ban đầu thành bài toán kỹ thuật rõ ràng.\n\n💡 **Gợi ý:** Bạn có thể bôi đen một đoạn văn bản bất kỳ trên slide để mình giải thích chi tiết hơn nhé!`;
  } else {
    return `Thanks for asking! Regarding **Slide ${pageContext || 1}**, the primary takeaway is clarifying technical problem boundaries for AI applications.\n\n💡 **Tip:** You can highlight any text on the slide to get an instant explanation from VLearn Tutor!`;
  }
}

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`VLearn AI Tutor Server running on http://localhost:${PORT}`);
  });
}

startServer();
