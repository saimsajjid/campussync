import fs from 'fs';
import path from 'path';

const colorMap: Record<string, string> = {
  '#0369A1': 'var(--color-status-sky-text)',
  '#0F172A': 'var(--color-surface-dark)',
  '#15803D': 'var(--color-status-synced-text)',
  '#166534': 'var(--color-status-synced-dark)',
  '#16A34A': 'var(--color-status-success-emerald)',
  '#1D4ED8': 'var(--color-status-info-text)',
  '#1E293B': 'var(--color-text-dark)',
  '#1E3A8A': 'var(--color-primary-deep)',
  '#1E40AF': 'var(--color-primary-dark)',
  '#22C55E': 'var(--color-status-success-green)',
  '#3E6AE1': 'var(--color-primary-hover)',
  '#475569': 'var(--color-text-secondary)',
  '#4F7DF3': 'var(--color-primary)',
  '#64748B': 'var(--color-text-subtle)',
  '#6B7280': 'var(--color-text-muted)',
  '#92400E': 'var(--color-status-pending-dark)',
  '#94A3B8': 'var(--color-text-light)',
  '#991B1B': 'var(--color-status-danger-text)',
  '#9A3412': 'var(--color-status-orange-text)',
  '#9F1239': 'var(--color-status-rejected-text)',
  '#B45309': 'var(--color-status-pending-text)',
  '#B91C1C': 'var(--color-status-conflict-text)',
  '#BAE6FD': 'var(--color-status-sky-border)',
  '#BBF7D0': 'var(--color-status-synced-border)',
  '#BFDBFE': 'var(--color-status-info-border)',
  '#CBD5E1': 'var(--color-border-muted)',
  '#D97706': 'var(--color-status-warning-orange)',
  '#DBEAFE': 'var(--color-status-info-light)',
  '#DC2626': 'var(--color-status-danger-dark)',
  '#DCFCE7': 'var(--color-status-synced-bg)',
  '#E2E8F0': 'var(--color-border-light)',
  '#E5E7EB': 'var(--color-border-subtle)',
  '#EBF0FF': 'var(--color-primary-light)',
  '#EF4444': 'var(--color-status-danger-red)',
  '#EFF6FF': 'var(--color-status-info-bg)',
  '#F0F9FF': 'var(--color-status-sky-light)',
  '#F0FDF4': 'var(--color-status-success-bg)',
  '#F1F5F9': 'var(--color-surface-slate-100)',
  '#F4F6FA': 'var(--color-surface-bg)',
  '#F59E0B': 'var(--color-status-warning-amber)',
  '#F8FAFC': 'var(--color-surface-muted)',
  '#FDE68A': 'var(--color-status-pending-border)',
  '#FECACA': 'var(--color-status-conflict-border)',
  '#FECDD3': 'var(--color-status-rejected-border)',
  '#FED7AA': 'var(--color-status-orange-border)',
  '#FEE2E2': 'var(--color-status-conflict-bg)',
  '#FEF2F2': 'var(--color-status-danger-subtle)',
  '#FEF3C7': 'var(--color-status-pending-bg)',
  '#FFEDD5': 'var(--color-status-orange-light)',
  '#FFF1F2': 'var(--color-status-rejected-bg)',
};

// Create lookup normalized to upper case
const normalizedMap = new Map<string, string>();
for (const [hex, cssVar] of Object.entries(colorMap)) {
  normalizedMap.set(hex.toUpperCase(), cssVar);
}

function processDirectory(dirPath: string) {
  const items = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dirPath, item.name);
    if (item.isDirectory()) {
      processDirectory(fullPath);
    } else if (item.isFile() && item.name.endsWith('.tsx')) {
      replaceColorsInFile(fullPath);
    }
  }
}

function replaceColorsInFile(filePath: string) {
  let content = fs.readFileSync(filePath, 'utf-8');
  let replacedCount = 0;

  // Match # followed by 6 hex characters
  const updatedContent = content.replace(/#([0-9a-fA-F]{6})/g, (match) => {
    const upper = match.toUpperCase();
    if (normalizedMap.has(upper)) {
      replacedCount++;
      return normalizedMap.get(upper)!;
    }
    return match;
  });

  if (replacedCount > 0) {
    fs.writeFileSync(filePath, updatedContent, 'utf-8');
    console.log(`Updated ${path.relative(process.cwd(), filePath)}: ${replacedCount} color replacements`);
  }
}

console.log('Replacing hardcoded hex colors in components with CSS variables from tokens.css...');
processDirectory(path.resolve('web/src/components'));
processDirectory(path.resolve('web/src/pages'));
replaceColorsInFile(path.resolve('web/src/App.tsx'));
console.log('Finished token replacements.');
