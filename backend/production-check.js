#!/usr/bin/env node

/**
 * Production Readiness Checker
 * Run this script before deploying to production
 */

// Check if built version exists
const fs = require('fs');
const path = require('path');

if (!fs.existsSync('./dist')) {
  console.error('❌ Build directory not found. Please run "npm run build" first.');
  process.exit(1);
}

const { config } = require('./dist/config/environment.js');
const { supabase } = require('./dist/server.js');

const checks = [];

async function runProductionChecks() {
  console.log('🚀 Running Production Readiness Checks...\n');

  // Environment Configuration Checks
  console.log('📋 Environment Configuration:');
  checkEnvironmentVar('NODE_ENV', 'production');
  checkEnvironmentVar('API_BASE_URL', null, true);
  checkEnvironmentVar('FRONTEND_URL', null, true);
  checkJWTSecret();
  checkDatabaseConfig();
  checkOpenAIConfig();
  
  // Security Checks
  console.log('\n🔐 Security Configuration:');
  checkCORSConfig();
  checkRateLimiting();
  checkSecurityHeaders();
  
  // Database Checks
  console.log('\n🗄️ Database Configuration:');
  await checkDatabaseConnection();
  await checkRequiredTables();
  
  // Performance Checks
  console.log('\n⚡ Performance Configuration:');
  checkCaching();
  checkLogging();
  
  // Display Results
  console.log('\n📊 Results Summary:');
  const passed = checks.filter(c => c.status === 'PASS').length;
  const failed = checks.filter(c => c.status === 'FAIL').length;
  const warnings = checks.filter(c => c.status === 'WARN').length;
  
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⚠️  Warnings: ${warnings}`);
  
  if (failed > 0) {
    console.log('\n🚨 Critical issues found! Please fix before deploying to production.');
    process.exit(1);
  } else if (warnings > 0) {
    console.log('\n⚠️  Some warnings found. Review recommended improvements.');
  } else {
    console.log('\n🎉 All checks passed! Ready for production deployment.');
  }
}

function addCheck(name, status, message) {
  checks.push({ name, status, message });
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  console.log(`  ${icon} ${name}: ${message}`);
}

function checkEnvironmentVar(name, expectedValue = null, required = false) {
  const value = process.env[name];
  
  if (!value && required) {
    addCheck(name, 'FAIL', 'Required environment variable not set');
    return;
  }
  
  if (expectedValue && value !== expectedValue) {
    addCheck(name, 'FAIL', `Expected '${expectedValue}', got '${value}'`);
    return;
  }
  
  if (value) {
    addCheck(name, 'PASS', `Set to '${value.substring(0, 20)}${value.length > 20 ? '...' : ''}'`);
  } else {
    addCheck(name, 'WARN', 'Not set (optional)');
  }
}

function checkJWTSecret() {
  const secret = process.env.JWT_SECRET;
  
  if (!secret) {
    addCheck('JWT_SECRET', 'FAIL', 'JWT secret not set');
    return;
  }
  
  if (secret.length < 32) {
    addCheck('JWT_SECRET', 'FAIL', 'JWT secret too short (minimum 32 characters)');
    return;
  }
  
  if (secret === 'your-super-secure-jwt-secret') {
    addCheck('JWT_SECRET', 'FAIL', 'Using default JWT secret (security risk)');
    return;
  }
  
  addCheck('JWT_SECRET', 'PASS', `Strong secret (${secret.length} characters)`);
}

function checkDatabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !anonKey || !serviceKey) {
    addCheck('Database Config', 'FAIL', 'Missing Supabase configuration');
    return;
  }
  
  if (!url.startsWith('https://')) {
    addCheck('Database Config', 'FAIL', 'Supabase URL should use HTTPS');
    return;
  }
  
  addCheck('Database Config', 'PASS', 'Supabase configuration present');
}

function checkOpenAIConfig() {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    addCheck('OpenAI Config', 'FAIL', 'OpenAI API key not set');
    return;
  }
  
  if (!apiKey.startsWith('sk-')) {
    addCheck('OpenAI Config', 'FAIL', 'Invalid OpenAI API key format');
    return;
  }
  
  addCheck('OpenAI Config', 'PASS', 'OpenAI API key configured');
}

function checkCORSConfig() {
  const corsOrigin = process.env.CORS_ORIGIN;
  
  if (!corsOrigin) {
    addCheck('CORS Config', 'WARN', 'CORS origin not set (will allow all origins)');
    return;
  }
  
  if (corsOrigin === '*') {
    addCheck('CORS Config', 'WARN', 'CORS allows all origins (security risk in production)');
    return;
  }
  
  addCheck('CORS Config', 'PASS', `CORS configured for: ${corsOrigin}`);
}

function checkRateLimiting() {
  const windowMs = process.env.RATE_LIMIT_WINDOW_MS;
  const maxRequests = process.env.RATE_LIMIT_MAX_REQUESTS;
  
  if (!windowMs || !maxRequests) {
    addCheck('Rate Limiting', 'WARN', 'Rate limiting not configured (using defaults)');
    return;
  }
  
  addCheck('Rate Limiting', 'PASS', `${maxRequests} requests per ${parseInt(windowMs) / 1000 / 60} minutes`);
}

function checkSecurityHeaders() {
  const helmetEnabled = process.env.HELMET_ENABLED !== 'false';
  
  if (!helmetEnabled) {
    addCheck('Security Headers', 'WARN', 'Helmet security headers disabled');
    return;
  }
  
  addCheck('Security Headers', 'PASS', 'Helmet security headers enabled');
}

async function checkDatabaseConnection() {
  try {
    const { data, error } = await supabase.from('chatbots').select('id').limit(1);
    
    if (error) {
      addCheck('Database Connection', 'FAIL', `Cannot connect: ${error.message}`);
      return;
    }
    
    addCheck('Database Connection', 'PASS', 'Successfully connected to database');
  } catch (error) {
    addCheck('Database Connection', 'FAIL', `Connection error: ${error.message}`);
  }
}

async function checkRequiredTables() {
  const requiredTables = ['chatbots', 'document_chunks', 'chatbot_knowledge'];
  
  try {
    for (const table of requiredTables) {
      const { error } = await supabase.from(table).select('*').limit(1);
      
      if (error) {
        addCheck(`Table: ${table}`, 'FAIL', `Table missing or inaccessible: ${error.message}`);
      } else {
        addCheck(`Table: ${table}`, 'PASS', 'Table exists and accessible');
      }
    }
  } catch (error) {
    addCheck('Required Tables', 'FAIL', `Error checking tables: ${error.message}`);
  }
}

function checkCaching() {
  const redisUrl = process.env.REDIS_URL;
  
  if (!redisUrl) {
    addCheck('Caching', 'WARN', 'Redis not configured (performance impact)');
    return;
  }
  
  addCheck('Caching', 'PASS', 'Redis caching configured');
}

function checkLogging() {
  const logLevel = process.env.LOG_LEVEL;
  const requestLogging = process.env.ENABLE_REQUEST_LOGGING;
  
  if (logLevel === 'debug') {
    addCheck('Logging', 'WARN', 'Debug logging enabled (performance impact)');
  } else if (logLevel === 'info' && requestLogging === 'true') {
    addCheck('Logging', 'PASS', 'Production logging configured');
  } else {
    addCheck('Logging', 'WARN', 'Logging configuration may need adjustment');
  }
}

// Run the checks
runProductionChecks().catch(error => {
  console.error('Error running production checks:', error);
  process.exit(1);
});
