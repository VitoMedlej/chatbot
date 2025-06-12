import {RequestHandler} from "express";
import {env} from "../utils/envConfig";
import {ServiceResponse} from "../models/serviceResponse";
import {StatusCodes} from "http-status-codes";
import {handleServiceResponse} from "../utils/httpHandlers";
import jwt from "jsonwebtoken";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client for JWT verification
const supabaseUrl = env.SUPABASE_URL;
const supabaseServiceKey = env.SUPABASE_SERVICE_KEY; // Service role key for server-side auth
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const authenticateRequest : RequestHandler = async (req, res, next) => {
    const isProd = Boolean(env.NODE_ENV === 'production');
    
    // Extract token from Authorization header
    const authHeader = req.headers["authorization"];
    const authToken = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;
    
    if (!authToken) {
        const serviceResponse = ServiceResponse.failure("Authentication required - token missing", null, StatusCodes.UNAUTHORIZED);
        return handleServiceResponse(serviceResponse, res);
    }

    try {
        // Verify the Supabase JWT token
        const { data: { user }, error } = await supabase.auth.getUser(authToken);
        
        if (error || !user) {
            const serviceResponse = ServiceResponse.failure("Invalid or expired authentication token", null, StatusCodes.UNAUTHORIZED);
            return handleServiceResponse(serviceResponse, res);
        }
        
        // Add user info to request for use in controllers
        req.user = {
            id: user.id,
            email: user.email || '',
            role: user.user_metadata?.role || 'user',
            // Add any additional user metadata from Supabase
            metadata: user.user_metadata || {}
        };
        
        next();
    } catch (error: any) {
        console.error('Auth verification error:', error);
        const serviceResponse = ServiceResponse.failure(
            "Authentication verification failed", 
            null, 
            StatusCodes.UNAUTHORIZED
        );
        return handleServiceResponse(serviceResponse, res);
    }
};

export default authenticateRequest;
