export const SENSITIVE_KEY_PATTERN = /(?:sk-|Bearer |token\s*[:=]\s*|password\s*[:=]\s*|secret\s*[:=]\s*|apikey\s*[:=]\s*|api_key\s*[:=]\s*|AWS_SECRET_ACCESS_KEY\s*[:=]\s*|GITHUB_TOKEN\s*[:=]\s*|ghp_|gho_|ghu_|ghs_|xoxb-|xoxp-|xoxs-|AZURE_[A-Z_]*\s*[:=]\s*|DATABASE_URL\s*[:=]\s*|AKIA|sk-ant-api[a-zA-Z0-9_-]+|sk_live_[a-zA-Z0-9_]+|rk_live_[a-zA-Z0-9_]+|SG\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+|npm_[a-zA-Z0-9]{30,}|dpl_[a-zA-Z0-9]{30,}|hvs\.[a-zA-Z0-9_-]+)[^\s'",;)}\]]{2,}/i;

const SENSITIVE_VALUE_REGEX = new RegExp(SENSITIVE_KEY_PATTERN.source, "gi");

export function redactObject(obj: unknown, depth = 0, maxDepth = 15): unknown {
  if (depth > maxDepth || obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj === "string") {
    return obj.replace(SENSITIVE_VALUE_REGEX, "[REDACTED]");
  }
  
  if (typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => redactObject(item, depth + 1, maxDepth));
  }

  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      redacted[key] = "[REDACTED]";
    } else {
      redacted[key] = redactObject(value, depth + 1, maxDepth);
    }
  }
  return redacted;
}
