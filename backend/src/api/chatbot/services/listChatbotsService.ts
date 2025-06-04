import { ServiceResponse } from "@/common/models/serviceResponse";
import { StatusCodes } from "http-status-codes";
import { supabase } from "@/server";

// Returns all chatbots for a user_id, ServiceResponse format
export async function listUserChatbots(req: any): Promise<ServiceResponse<any[]>> {
  try {
    const user_id = req.query.user_id || req.body.user_id;
    if (!user_id) {
      return ServiceResponse.failure("Missing user_id.", [], StatusCodes.BAD_REQUEST);
    }
    const { data, error } = await supabase
      .from("chatbots")
      .select("*")
      .eq("user_id", user_id);

    if (error) {
      return ServiceResponse.failure(error.message, [], StatusCodes.INTERNAL_SERVER_ERROR);
    }
    return ServiceResponse.success("Chatbots retrieved.", data || []);
  } catch (err: any) {
    return ServiceResponse.failure(err.message, [], StatusCodes.INTERNAL_SERVER_ERROR);
  }
}