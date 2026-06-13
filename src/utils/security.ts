export interface SecurityLog {
  timestamp: string;
  threatType: string;
  blockedContent: string;
}

export const logSecurityIncident = (threatType: string, blockedContent: string) => {
  try {
    const logsStr = localStorage.getItem('security_logs') || '[]';
    const logs: SecurityLog[] = JSON.parse(logsStr);
    
    logs.unshift({
      timestamp: new Date().toISOString(),
      threatType,
      blockedContent: sanitizeInput(blockedContent)
    });
    
    if (logs.length > 200) {
      logs.length = 200;
    }
    
    localStorage.setItem('security_logs', JSON.stringify(logs));
  } catch (e) {
    console.error('Failed to save security log:', e);
  }
};

export const isMaliciousInput = (input: string): boolean => {
  if (!input) return false;
  const lowerInput = input.toLowerCase();
  
  // Basic XSS and SQL Injection patterns
  const patterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /onerror=/gi,
    /onload=/gi,
    /<iframe/gi,
    /\b(select\b.*\bfrom\b|delete\b.*\bfrom\b|drop\b.*\btable\b|insert\b.*\binto\b|update\b.*\bset\b)\b/gi,
  ];

  return patterns.some(pattern => pattern.test(lowerInput));
};

export const sanitizeInput = (input: string): string => {
  if (!input) return '';
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};

export const checkFileSecurity = async (file: File): Promise<{ isSafe: boolean; hash?: string; message?: string }> => {
  try {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    console.log(`[Security] File hash calculated for ${file.name}: ${hashHex}`);
    
    const response = await fetch(`/api/check-hash/${hashHex}`);
    if (!response.ok) {
      console.warn('Backend API returned non-ok status, assuming safe or handling gracefully.');
      return { isSafe: true, hash: hashHex };
    }

    const data = await response.json();
    if (!data.isSafe) {
      return { isSafe: false, hash: hashHex, message: `VirusTotal: Zararlı aktivite tespit edildi (Malicious: ${data.maliciousCount})` };
    }
    
    return { isSafe: true, hash: hashHex };
  } catch (error) {
    console.error('Error calculating file hash or checking security:', error);
    return { isSafe: false, message: 'Dosya güvenlik taraması sırasında bir hata oluştu.' };
  }
};
