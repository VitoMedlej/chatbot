# Production Deployment Guide

## 🚀 Pre-Deployment Checklist

### Environment Setup
- [ ] Set up production environment variables (see `.env.example`)
- [ ] Configure proper JWT secret (32+ characters)
- [ ] Set up Supabase production database
- [ ] Configure OpenAI API keys with proper rate limits
- [ ] Set up domain/SSL certificates

### Database Setup
```sql
-- Run these scripts in order:
\i database-optimizations.sql
\i production-analytics.sql
```

### Security Configuration
- [ ] Enable Helmet security headers
- [ ] Configure CORS for production domains
- [ ] Set up rate limiting with Redis (recommended)
- [ ] Enable request logging and monitoring
- [ ] Configure Sentry for error tracking

### Performance Optimization
- [ ] Enable production logging level
- [ ] Set up Redis for caching and rate limiting
- [ ] Configure CDN for static assets
- [ ] Enable gzip compression
- [ ] Set up database connection pooling

## 🔧 Environment Variables

### Required Production Variables
```env
# Environment
NODE_ENV=production
PORT=3000

# API Configuration
API_BASE_URL=https://api.yourapp.com
FRONTEND_URL=https://yourapp.com

# Security
JWT_SECRET=your-super-secure-jwt-secret-32-chars-minimum
CORS_ORIGIN=https://yourapp.com,https://dashboard.yourapp.com

# Database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# OpenAI
OPENAI_API_KEY=sk-your-api-key
OPENAI_ORG_ID=org-your-org-id

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
EMBED_RATE_LIMIT_MAX=50

# Optional: Monitoring & Analytics
SENTRY_DSN=https://your-sentry-dsn
REDIS_URL=redis://localhost:6379
ENABLE_REQUEST_LOGGING=true
LOG_LEVEL=info
```

## 🐳 Docker Deployment

### Dockerfile
```dockerfile
FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY dist ./dist

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001
USER nextjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/embed/health || exit 1

# Start application
CMD ["node", "dist/index.js"]
```

### docker-compose.yml
```yaml
version: '3.8'
services:
  chatbot-api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    env_file:
      - .env
    restart: unless-stopped
    depends_on:
      - redis
    
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    restart: unless-stopped
    
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - chatbot-api
    restart: unless-stopped
```

## 🔧 Nginx Configuration

```nginx
server {
    listen 80;
    server_name api.yourapp.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.yourapp.com;
    
    # SSL Configuration
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    
    # Security headers
    add_header X-Frame-Options SAMEORIGIN;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    
    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req zone=api burst=20 nodelay;
    
    # Gzip compression
    gzip on;
    gzip_types text/plain application/json application/javascript text/css;
    
    location / {
        proxy_pass http://chatbot-api:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }
    
    # Special handling for embed widgets (allow embedding)
    location /api/embed/widget/ {
        proxy_pass http://chatbot-api:3000;
        add_header X-Frame-Options "";  # Allow embedding
        add_header Access-Control-Allow-Origin "*";
        
        # Cache widget files
        expires 1h;
        add_header Cache-Control "public, immutable";
    }
}
```

## 📊 Monitoring & Analytics

### Health Check Endpoints
- `GET /api/embed/health` - Embed system health
- `GET /api/health` - General API health

### Metrics to Monitor
- Response times (< 500ms target)
- Error rates (< 1% target)
- Rate limiting violations
- Database connection pool usage
- Memory and CPU usage
- Active embed sessions

### Alerting Setup
```javascript
// Example Sentry configuration
import * as Sentry from "@sentry/node";

if (config.monitoring.sentryDsn) {
  Sentry.init({
    dsn: config.monitoring.sentryDsn,
    environment: config.isProduction ? "production" : "development",
    tracesSampleRate: config.isProduction ? 0.1 : 1.0,
  });
}
```

## 🔐 Security Best Practices

### API Security
- ✅ JWT token validation on all protected endpoints
- ✅ Rate limiting per user/IP/API key
- ✅ Input validation and sanitization
- ✅ SQL injection prevention (using Supabase client)
- ✅ XSS protection headers
- ✅ CORS configuration

### Embed Security
- ✅ Domain validation for embed widgets
- ✅ API key-based authentication
- ✅ Rate limiting per chatbot
- ✅ Content Security Policy headers
- ✅ Session-based user identification

### Database Security
- ✅ Row Level Security (RLS) in Supabase
- ✅ Service role key for backend operations
- ✅ Encrypted connections
- ✅ Regular backups and disaster recovery

## 📈 Performance Optimization

### Caching Strategy
```javascript
// Redis caching for frequently accessed data
const cacheKey = `chatbot:${chatbotId}:config`;
const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);

// Cache for 1 hour
await redis.setex(cacheKey, 3600, JSON.stringify(data));
```

### Database Optimization
- Connection pooling (configured in Supabase)
- Proper indexing (see production-analytics.sql)
- Query optimization for analytics
- Automated cleanup of old data

### CDN Setup
- Static assets (widget files) via CDN
- Geographic distribution for global users
- Gzip compression for all text content

## 🚀 Deployment Steps

1. **Build the application**
   ```bash
   npm run build
   ```

2. **Run database migrations**
   ```sql
   -- In Supabase dashboard or psql
   \i database-optimizations.sql
   \i production-analytics.sql
   ```

3. **Deploy with Docker**
   ```bash
   docker-compose up -d
   ```

4. **Verify deployment**
   ```bash
   curl https://api.yourapp.com/api/embed/health
   ```

5. **Test embed widget**
   ```html
   <script src="https://api.yourapp.com/api/embed/widget/cb_1_xxx.js"></script>
   ```

## 📋 Post-Deployment

### Monitoring Setup
- [ ] Configure uptime monitoring
- [ ] Set up error alerting (Sentry, email, Slack)
- [ ] Monitor performance metrics
- [ ] Set up log aggregation

### User Documentation
- [ ] Update embed integration docs
- [ ] Create troubleshooting guide
- [ ] Document API rate limits
- [ ] Provide example implementations

### Backup & Recovery
- [ ] Database backups (Supabase handles this)
- [ ] Environment configuration backup
- [ ] SSL certificate renewal automation
- [ ] Disaster recovery plan

## 🔍 Troubleshooting

### Common Issues
1. **CORS errors**: Check CORS_ORIGIN environment variable
2. **Rate limiting**: Monitor rate limit metrics
3. **Widget not loading**: Check API_BASE_URL configuration
4. **Database timeouts**: Review connection pooling settings
5. **High memory usage**: Enable Redis for caching

### Debug Commands
```bash
# Check application logs
docker logs chatbot-api

# Monitor resource usage
docker stats

# Test API endpoints
curl -X POST https://api.yourapp.com/api/embed/chat \
  -H "Content-Type: application/json" \
  -d '{"apiKey":"cb_1_xxx","message":"test"}'
```
