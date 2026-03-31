/**
 * Configuration validator
 * Validates environment variables and configuration before starting
 */

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateConfig(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required environment variables
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    errors.push('TELEGRAM_BOT_TOKEN is required');
  } else {
    // Validate token format: should be like "123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
    const tokenPattern = /^\d+:[A-Za-z0-9_-]+$/;
    if (!tokenPattern.test(botToken)) {
      errors.push('TELEGRAM_BOT_TOKEN has invalid format');
    }
  }

  // Check optional proxy configuration
  const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
  if (proxyUrl) {
    try {
      new URL(proxyUrl);
      warnings.push(`Using proxy: ${proxyUrl}`);
    } catch (e) {
      errors.push(`Invalid proxy URL: ${proxyUrl}`);
    }
  }

  // Check log level
  const logLevel = process.env.LOG_LEVEL;
  if (logLevel && !['debug', 'info', 'warn', 'error'].includes(logLevel)) {
    warnings.push(`Invalid LOG_LEVEL: ${logLevel}, using 'info' as default`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

export function printValidationResult(result: ValidationResult): void {
  if (result.errors.length > 0) {
    console.error('\n❌ Configuration Errors:');
    result.errors.forEach(err => console.error(`  - ${err}`));
  }

  if (result.warnings.length > 0) {
    console.warn('\n⚠️  Configuration Warnings:');
    result.warnings.forEach(warn => console.warn(`  - ${warn}`));
  }

  if (result.valid) {
    console.log('\n✅ Configuration is valid\n');
  } else {
    console.error('\n❌ Configuration validation failed\n');
    console.error('Please fix the errors above and try again.\n');
  }
}
