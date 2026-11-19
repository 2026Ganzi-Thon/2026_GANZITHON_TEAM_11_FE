import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState, type ComponentProps } from 'react';
import {
  CardWritingScreen,
  type CardWritingActions,
} from '../cards/CardWritingScreen';
import type { MyCardsWritingSource } from '../myCards/types';
import { SheepDetailScreen } from './SheepDetailScreen';

const owners = new WeakMap<
  MyCardsWritingSource,
  Map<string, CardWritingActions>
>();
/** Memory-only account ownership keeps sheep drafts through morning screen remounts. */
export function createSheepWritingSessions(source: MyCardsWritingSource) {
  let sessions = owners.get(source);
  if (!sessions) {
    sessions = new Map<string, CardWritingActions>();
    owners.set(source, sessions);
  }
  const records = sessions;
  return {
    get(sheepId: string) {
      let session = records.get(sheepId);
      if (!session) {
        session = source.createWritingSession();
        records.set(sheepId, session);
      }
      return session;
    },
    complete(sheepId: string, session: CardWritingActions) {
      if (records.get(sheepId) === session) records.delete(sheepId);
    },
  };
}
export function SheepDetailWritingFlow({
  writing,
  ...detail
}: Omit<ComponentProps<typeof SheepDetailScreen>, 'onWrite'> & {
  writing?: ReturnType<typeof createSheepWritingSessions>;
}) {
  const [writer, setWriter] = useState<CardWritingActions | null>(null);
  const current = useRef<CardWritingActions | null>(null);
  useEffect(
    () => () => {
      current.current = null;
    },
    [],
  );
  const close = () => {
    current.current = null;
    setWriter(null);
  };
  return (
    <>
      <SheepDetailScreen
        {...detail}
        onWrite={
          writing
            ? () => {
                const session = writing.get(detail.sheepId);
                current.current = session;
                setWriter(session);
              }
            : undefined
        }
      />
      <StatusBar style={writer ? 'light' : 'dark'} />
      {writer && writing && (
        <CardWritingScreen
          modal
          entryContext="sheep_detail"
          actions={writer}
          onBack={close}
          onDone={() => {
            if (current.current !== writer) return;
            writing.complete(detail.sheepId, writer);
            close();
          }}
        />
      )}
    </>
  );
}
