'use client';

import TrackButton from '@/components/Tracker/TrackButton';
import EveImage from '@/components/ui/EveImage';
import { TrackedEntityType } from '@/generated/graphql';
import {
  groupTrackDialogEntries,
  type TrackDialogEntry,
} from '@/utils/trackDialogEntries';
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Tab,
  TabGroup,
  TabList,
  TabPanel,
  TabPanels,
} from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';

const TABS = [
  {
    type: TrackedEntityType.Character,
    label: 'CHARACTERS',
    kind: 'character',
    path: 'characters',
  },
  {
    type: TrackedEntityType.Corporation,
    label: 'CORPORATIONS',
    kind: 'corporation',
    path: 'corporations',
  },
  {
    type: TrackedEntityType.Alliance,
    label: 'ALLIANCES',
    kind: 'alliance',
    path: 'alliances',
  },
] as const;

export default function TrackDialog({
  open,
  onClose,
  entries,
  title,
}: {
  open: boolean;
  onClose: () => void;
  entries: TrackDialogEntry[];
  title: string;
}) {
  const groups = groupTrackDialogEntries(entries);

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <div aria-hidden="true" className="fixed inset-0 bg-black/40" />
      <div className="fixed inset-0 flex items-start justify-center p-4 overflow-y-auto sm:p-6">
        <DialogPanel className="float w-full max-w-xl my-8">
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
            <DialogTitle className="text-lg font-medium text-white">
              {title}
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

          <TabGroup>
            <TabList className="flex gap-4 px-6 pt-3 border-b border-white/10">
              {TABS.map((t) => (
                <Tab
                  key={t.type}
                  className="pb-2 text-xs tracking-wide text-white/60 data-[selected]:text-white data-[selected]:border-b data-[selected]:border-white"
                >
                  {t.label} ({groups[t.type].length})
                </Tab>
              ))}
            </TabList>
            <TabPanels>
              {TABS.map((t) => {
                let lastSection: string | undefined;
                return (
                  <TabPanel key={t.type} className="p-6 space-y-2">
                    {groups[t.type].map((e) => {
                      const heading =
                        e.section && e.section !== lastSection
                          ? e.section
                          : null;
                      lastSection = e.section;
                      return (
                        <div key={e.id}>
                          {heading && (
                            <div className="mt-2 mb-1 text-xs tracking-wide text-white/50">
                              {heading}
                            </div>
                          )}
                          <div className="flex items-center gap-3">
                            <EveImage
                              kind={t.kind}
                              id={e.id}
                              name={e.name}
                              size={32}
                              className="rounded"
                            />
                            <Link
                              href={`/${t.path}/${e.id}?tab=killmails`}
                              className="flex-1 truncate text-white hover:underline"
                            >
                              {e.name}
                            </Link>
                            {e.role && (
                              <span className="text-xs text-white/50">
                                {e.role}
                              </span>
                            )}
                            <TrackButton type={t.type} id={e.id} size="xs" />
                          </div>
                        </div>
                      );
                    })}
                  </TabPanel>
                );
              })}
            </TabPanels>
          </TabGroup>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
