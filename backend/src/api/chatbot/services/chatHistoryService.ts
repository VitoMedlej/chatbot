import { supabase } from "@/server";

export async function saveMessage(userId: number, chatbotId: number, message: string, sender: "user" | "bot") {
    return supabase.from("chat_history").insert({
        user_id: userId,
        chatbot_id: chatbotId,
        message,
        sender,
    });
}

export async function getRecentMessages(userId: number, chatbotId: number, limit = 10) {
    const { data, error } = await supabase
        .from("chat_history")
        .select("message,sender")
        .eq("user_id", userId)
        .eq("chatbot_id", chatbotId)
        .order("created_at", { ascending: false })
        .limit(limit);
    if (error) throw error;
    return (data || []).reverse(); // oldest first
}