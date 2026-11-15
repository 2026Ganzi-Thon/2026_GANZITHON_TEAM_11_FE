import type { Support } from '../../api/contracts';
export type SupportResource = Support['resources'][number];
function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
/** Treat unavailable support data as an error, never as permission to submit. */
export function readSupport(value: unknown): Support | null {
  if (
    !record(value) ||
    typeof value.message !== 'string' ||
    !value.message.trim() ||
    !Array.isArray(value.resources)
  )
    return null;
  const resources: SupportResource[] = [];
  for (const resource of value.resources) {
    if (
      !record(resource) ||
      typeof resource.label !== 'string' ||
      !resource.label.trim() ||
      (resource.action !== 'call' &&
        resource.action !== 'open_contacts' &&
        resource.action !== 'open_url') ||
      !(resource.target === null || typeof resource.target === 'string')
    )
      return null;
    resources.push({
      label: resource.label,
      action: resource.action,
      target: resource.target,
    });
  }
  return { message: value.message, resources };
}
/** The payload selects an action, but cannot supply arbitrary native schemes. */
export function supportTarget(
  resource: SupportResource,
  platform: string,
): string | null {
  const target = resource.target;
  if (resource.action === 'open_contacts')
    return platform === 'android' && target === null
      ? 'content://com.android.contacts/contacts'
      : null;
  if (resource.action === 'call') {
    if (platform !== 'android' && platform !== 'ios') return null;
    if (!target) return null;
    const phone = target.startsWith('tel:') ? target.slice(4) : target;
    return /^\+?[0-9]{2,15}$/.test(phone) ? `tel:${phone}` : null;
  }
  if (
    resource.action === 'open_url' &&
    target &&
    target === target.trim() &&
    !/[\s\\]/.test(target)
  ) {
    try {
      const url = new URL(target);
      if (
        url.protocol === 'https:' &&
        url.hostname &&
        !url.username &&
        !url.password
      )
        return target;
    } catch {
      /* Invalid URLs remain unavailable. */
    }
  }
  return null;
}
