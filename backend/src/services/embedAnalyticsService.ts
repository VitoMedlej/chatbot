import { supabase } from "@/server";
import { env } from "@/common/utils/envConfig";

// Production monitoring and analytics service
export class EmbedAnalyticsService {
  private static instance: EmbedAnalyticsService;
  
  public static getInstance(): EmbedAnalyticsService {
    if (!EmbedAnalyticsService.instance) {
      EmbedAnalyticsService.instance = new EmbedAnalyticsService();
    }
    return EmbedAnalyticsService.instance;
  }

  /**
   * Track embed usage for analytics and billing
   */
  async trackEmbedUsage(data: {
    apiKey: string;
    chatbotId: number;
    event: 'message_sent' | 'widget_loaded' | 'session_started';
    metadata?: Record<string, any>;
  }): Promise<void> {
    try {
      if (env.NODE_ENV !== 'production') {
        console.info('[ANALYTICS]', data);
        return;
      }

      // Store in analytics table for dashboard and billing
      await supabase
        .from('embed_analytics')
        .insert({
          api_key: data.apiKey,
          chatbot_id: data.chatbotId,
          event_type: data.event,
          metadata: data.metadata || {},
          created_at: new Date().toISOString(),
        });

    } catch (error) {
      // Don't fail the main request if analytics fails
      console.error('[ANALYTICS ERROR]', error);
    }
  }

  /**
   * Get usage statistics for a chatbot (for dashboard)
   */
  async getChatbotUsageStats(chatbotId: number, timeframe: '24h' | '7d' | '30d' = '7d') {
    try {
      const hoursBack = timeframe === '24h' ? 24 : timeframe === '7d' ? 168 : 720;
      const fromDate = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from('embed_analytics')
        .select('event_type, created_at, metadata')
        .eq('chatbot_id', chatbotId)
        .gte('created_at', fromDate)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Aggregate statistics
      const stats = {
        totalMessages: data?.filter(d => d.event_type === 'message_sent').length || 0,
        totalSessions: data?.filter(d => d.event_type === 'session_started').length || 0,
        totalWidgetLoads: data?.filter(d => d.event_type === 'widget_loaded').length || 0,
        timeframe,
        generatedAt: new Date().toISOString(),
      };

      return { success: true, data: stats };
    } catch (error) {
      console.error('Error getting usage stats:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Monitor embed performance and health
   */
  async getEmbedHealthMetrics() {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

      // Get recent activity
      const { data: recentActivity, error } = await supabase
        .from('embed_analytics')
        .select('api_key, event_type, created_at')
        .gte('created_at', oneHourAgo);

      if (error) throw error;

      // Calculate health metrics
      const metrics = {
        activeApiKeys: new Set(recentActivity?.map(a => a.api_key)).size,
        totalEvents: recentActivity?.length || 0,
        messagesPerHour: recentActivity?.filter(a => a.event_type === 'message_sent').length || 0,
        lastActivity: recentActivity?.[0]?.created_at || null,
        status: (recentActivity?.length || 0) > 0 ? 'active' : 'idle',
        timestamp: new Date().toISOString(),
      };

      return { success: true, data: metrics };
    } catch (error) {
      console.error('Error getting health metrics:', error);
      return { 
        success: false, 
        data: { 
          status: 'error', 
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Unknown error'
        } 
      };
    }
  }
}

// Export singleton instance
export const embedAnalytics = EmbedAnalyticsService.getInstance();
