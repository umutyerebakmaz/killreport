'use client';

import DiscordWebhookDialog from '@/components/DiscordWebhook/DiscordWebhookDialog';
import type { TrackedEntityType } from '@/generated/graphql';
import { useDiscordWebhooks } from '@/hooks/useDiscordWebhooks';
import { useState } from 'react';

const LABELS = {
  none: 'DISCORD',
  connected: 'DISCORD · CONNECTED',
  broken: 'DISCORD · BROKEN',
} as const;

/*
 * Opens the Discord webhook dialog for one character, corporation or alliance.
 * Unlike TrackButton it stays visible for your own character and for
 * automatically tracked entities.
 */
export default function DiscordWebhookButton({
  type,
  id,
}: {
  type: TrackedEntityType;
  id: number;
}) {
  const [open, setOpen] = useState(false);
  const webhooks = useDiscordWebhooks();
  if (!webhooks.signedIn || webhooks.loading) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="button button-outline button-sm"
      >
        {LABELS[webhooks.statusOf(type, id)]}
      </button>
      <DiscordWebhookDialog
        open={open}
        onClose={() => setOpen(false)}
        type={type}
        id={id}
        webhooks={webhooks}
      />
    </>
  );
}
