'use client';

import type { TrackedEntityType } from '@/generated/graphql';
import type { useDiscordWebhooks } from '@/hooks/useDiscordWebhooks';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';

export default function DiscordWebhookDialog({
  open,
  onClose,
  type,
  id,
  webhooks,
}: {
  open: boolean;
  onClose: () => void;
  type: TrackedEntityType;
  id: number;
  webhooks: ReturnType<typeof useDiscordWebhooks>;
}) {
  const [url, setUrl] = useState('');
  const { statusOf, webhookOf, set, remove, pending, error } = webhooks;
  const status = statusOf(type, id);
  const connected = status !== 'none';
  const webhook = webhookOf(type, id);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    await set(type, id, url.trim());
    setUrl('');
  };

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <div aria-hidden="true" className="fixed inset-0 bg-black/40" />
      <div className="fixed inset-0 flex items-start justify-center p-4 overflow-y-auto sm:p-6">
        <DialogPanel className="float w-full max-w-xl my-8">
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
            <DialogTitle className="text-lg font-medium text-white">
              Discord webhook
            </DialogTitle>
            <button
              type="button"
              onClick={onClose}
              className="button button-ghost button-icon"
            >
              <span className="sr-only">Close</span>
              <XMarkIcon aria-hidden="true" className="size-6" />
            </button>
          </div>

          <div className="p-6 space-y-4">
            {connected && (
              <div className="flex items-center gap-3 text-sm text-white/70">
                <span>{webhook?.name ?? 'Unnamed webhook'}</span>
                <span className="text-xs tracking-wide text-white/50">
                  {status === 'broken' ? 'BROKEN' : 'CONNECTED'}
                </span>
              </div>
            )}

            <form onSubmit={submit} className="space-y-3">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://discord.com/api/webhooks/…"
                aria-label="Discord webhook URL"
                autoComplete="off"
                className="input"
              />
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={pending || !url.trim()}
                  className="button button-primary button-sm"
                >
                  {connected ? 'REPLACE' : 'CONNECT'}
                </button>
                {connected && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => remove(type, id)}
                    className="button button-outline button-sm"
                  >
                    REMOVE
                  </button>
                )}
              </div>
            </form>

            {error && (
              <p role="alert" className="text-xs text-ink-faint">
                {error}
              </p>
            )}

            {!connected && (
              <p className="text-xs text-white/50">
                In Discord: channel settings → Integrations → Webhooks → New
                Webhook → Copy Webhook URL.
              </p>
            )}
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
