#!/usr/bin/env node

/**
 * Environment Validation Script
 * Validates environment configuration for different deployment stages
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Colors for console output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Required environment variables for each environment
const requiredVars = {
  development: [
    'VITE_AZURE_CLIENT_ID',
    'VITE_GITHUB_CLIENT_ID',
    'VITE_GOOGLE_CLIENT_ID',
    'VITE_DIFY_API_BASE_URL',
    'VITE_OAUTH_REDIRECT_URI',
  ],
  staging: [
    'VITE_AZURE_CLIENT_ID',
    'VITE_AZURE_TENANT_ID',
    'VITE_GITHUB_CLIENT_ID',
    'VITE_GOOGLE_CLIENT_ID',
    'VITE_DIFY_API_BASE_URL',
    'VITE_OAUTH_REDIRECT_URI',
    'VITE_GIT_COMMIT',
  ],
  production: [
    'VITE_AZURE_CLIENT_ID',
    'VITE_AZURE_TENANT_ID',
    'VITE_GITHUB_CLIENT_ID',
    'VITE_GOOGLE_CLIENT_ID',
    'VITE_DIFY_API_BASE_URL',
    'VITE_OAUTH_REDIRECT_URI',
    'VITE_GIT_COMMIT',
  ],
};

// Optional environment variables with defaults
const optionalVars = {
  VITE_MODE: 'production',
  NODE_ENV: 'production',
};

// Validation rules for environment variables
const validationRules = {
  VITE_AZURE_CLIENT_ID: {
    pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    description: 'Must be a valid UUID format',
  },
  VITE_AZURE_TENANT_ID: {
    pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    description: 'Must be a valid UUID format',
  },
  VITE_GITHUB_CLIENT_ID: {
    pattern: /^[a-zA-Z0-9]{20}$/,
    description: 'Must be a 20-character alphanumeric string',
  },
  VITE_GOOGLE_CLIENT_ID: {
    pattern: /^[0-9]+-[a-zA-Z0-9]+\.apps\.googleusercontent\.com$/,
    description: 'Must be a valid Google OAuth client ID',
  },
  VITE_DIFY_API_BASE_URL: {
    pattern: /^https?:\/\/.+/,
    description: 'Must be a valid HTTP/HTTPS URL',
  },
  VITE_OAUTH_REDIRECT_URI: {
    pattern: /^https?:\/\/.+\/callback$/,
    description: 'Must be a valid HTTP/HTTPS URL ending with /callback',
  },
  VITE_GIT_COMMIT: {
    pattern: /^[a-f0-9]{7,40}$/,
    description: 'Must be a valid Git commit hash (7-40 characters)',
  },
};

// Security checks
const securityChecks = {
  production: {
    VITE_OAUTH_REDIRECT_URI: {
      mustUseHttps: true,
      allowedDomains: [], // Add your production domains
    },
    VITE_DIFY_API_BASE_URL: {
      mustUseHttps: true,
      allowedDomains: [], // Add your API domains
    },
  },
  staging: {
    VITE_OAUTH_REDIRECT_URI: {
      mustUseHttps: true,
      allowedDomains: [], // Add your staging domains
    },
    VITE_DIFY_API_BASE_URL: {
      mustUseHttps: true,
      allowedDomains: [], // Add your staging API domains
    },
  },
};

/**
 * Load environment variables from file
 */
function loadEnvFile(environment) {
  const envFile = `.env.${environment}`;
  const envPath = path.resolve(process.cwd(), envFile);
  
  if (!fs.existsSync(envPath)) {
    log('yellow', `Warning: Environment file ${envFile} not found`);
    return {};
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  const envVars = {};
  
  envContent.split('\n').forEach(line => {
    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.startsWith('#')) {
      const [key, ...valueParts] = trimmedLine.split('=');
      if (key && valueParts.length > 0) {
        envVars[key.trim()] = valueParts.join('=').trim();
      }
    }
  });
  
  return envVars;
}

/**
 * Validate environment variable format
 */
function validateFormat(key, value) {
  const rule = validationRules[key];
  if (!rule) return { valid: true };
  
  const valid = rule.pattern.test(value);
  return {
    valid,
    message: valid ? null : `Invalid format: ${rule.description}`,
  };
}

/**
 * Perform security checks
 */
function performSecurityChecks(environment, envVars) {
  const checks = securityChecks[environment];
  if (!checks) return { passed: true, warnings: [] };
  
  const warnings = [];
  
  Object.entries(checks).forEach(([key, rules]) => {
    const value = envVars[key];
    if (!value) return;
    
    // Check HTTPS requirement
    if (rules.mustUseHttps && !value.startsWith('https://')) {
      warnings.push(`${key}: Should use HTTPS in ${environment} environment`);
    }
    
    // Check allowed domains
    if (rules.allowedDomains && rules.allowedDomains.length > 0) {
      const url = new URL(value);
      if (!rules.allowedDomains.includes(url.hostname)) {
        warnings.push(`${key}: Domain ${url.hostname} not in allowed list`);
      }
    }
  });
  
  return {
    passed: warnings.length === 0,
    warnings,
  };
}

/**
 * Validate environment configuration
 */
function validateEnvironment(environment) {
  log('blue', `\n=== Validating ${environment} environment ===`);
  
  // Load environment variables
  const fileVars = loadEnvFile(environment);
  const processVars = process.env;
  const envVars = { ...fileVars, ...processVars };
  
  // Check required variables
  const required = requiredVars[environment] || [];
  const missing = [];
  const invalid = [];
  
  required.forEach(key => {
    const value = envVars[key];
    
    if (!value) {
      missing.push(key);
      return;
    }
    
    // Validate format
    const validation = validateFormat(key, value);
    if (!validation.valid) {
      invalid.push({ key, message: validation.message });
    }
  });
  
  // Check optional variables
  Object.entries(optionalVars).forEach(([key, defaultValue]) => {
    if (!envVars[key]) {
      log('yellow', `Warning: ${key} not set, using default: ${defaultValue}`);
    }
  });
  
  // Perform security checks
  const securityResult = performSecurityChecks(environment, envVars);
  
  // Report results
  let hasErrors = false;
  
  if (missing.length > 0) {
    hasErrors = true;
    log('red', '\n❌ Missing required environment variables:');
    missing.forEach(key => log('red', `  - ${key}`));
  }
  
  if (invalid.length > 0) {
    hasErrors = true;
    log('red', '\n❌ Invalid environment variables:');
    invalid.forEach(({ key, message }) => log('red', `  - ${key}: ${message}`));
  }
  
  if (securityResult.warnings.length > 0) {
    log('yellow', '\n⚠️  Security warnings:');
    securityResult.warnings.forEach(warning => log('yellow', `  - ${warning}`));
  }
  
  if (!hasErrors) {
    log('green', `\n✅ ${environment} environment validation passed`);
  }
  
  return {
    valid: !hasErrors,
    missing,
    invalid,
    warnings: securityResult.warnings,
  };
}

/**
 * Generate environment template
 */
function generateTemplate(environment) {
  const required = requiredVars[environment] || [];
  const template = [];
  
  template.push(`# ${environment.toUpperCase()} Environment Configuration`);
  template.push(`# Generated on ${new Date().toISOString()}`);
  template.push('');
  
  // Add required variables
  template.push('# Required Variables');
  required.forEach(key => {
    const rule = validationRules[key];
    if (rule) {
      template.push(`# ${rule.description}`);
    }
    template.push(`${key}=`);
    template.push('');
  });
  
  // Add optional variables
  template.push('# Optional Variables (with defaults)');
  Object.entries(optionalVars).forEach(([key, defaultValue]) => {
    template.push(`# Default: ${defaultValue}`);
    template.push(`${key}=${defaultValue}`);
    template.push('');
  });
  
  return template.join('\n');
}

/**
 * Main function
 */
function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const environment = args[1] || 'production';
  
  switch (command) {
    case 'validate':
      const result = validateEnvironment(environment);
      process.exit(result.valid ? 0 : 1);
      break;
      
    case 'template':
      const template = generateTemplate(environment);
      const filename = `.env.${environment}.template`;
      fs.writeFileSync(filename, template);
      log('green', `✅ Template generated: ${filename}`);
      break;
      
    case 'all':
      let allValid = true;
      ['development', 'staging', 'production'].forEach(env => {
        const result = validateEnvironment(env);
        if (!result.valid) allValid = false;
      });
      process.exit(allValid ? 0 : 1);
      break;
      
    default:
      console.log(`
Usage: node scripts/validate-env.js <command> [environment]

Commands:
  validate [env]    Validate environment configuration (default: production)
  template [env]    Generate environment template file
  all              Validate all environments

Environments:
  development      Development environment
  staging          Staging environment  
  production       Production environment (default)

Examples:
  node scripts/validate-env.js validate production
  node scripts/validate-env.js template staging
  node scripts/validate-env.js all
`);
      process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export {
  validateEnvironment,
  generateTemplate,
  loadEnvFile,
};