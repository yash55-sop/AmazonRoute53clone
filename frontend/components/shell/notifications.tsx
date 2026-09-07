"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import Flashbar, {
  type FlashbarProps,
} from "@cloudscape-design/components/flashbar";

type NoticeType = "success" | "error" | "warning" | "info";
interface NotificationContextValue {
  notify(type: NoticeType, header: string, content?: string): void;
}
const NotificationContext = createContext<NotificationContextValue | null>(
  null,
);

export function NotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [items, setItems] = useState<FlashbarProps.MessageDefinition[]>([]);
  const nextNoticeId = useRef(0);
  const notify = useCallback(
    (type: NoticeType, header: string, content?: string) => {
      const id = `notice-${++nextNoticeId.current}`;
      setItems((current) => [
        ...current,
        {
          id,
          type,
          header,
          content,
          dismissible: true,
          onDismiss: () =>
            setItems((all) => all.filter((item) => item.id !== id)),
        },
      ]);
    },
    [],
  );
  const value = useMemo(() => ({ notify }), [notify]);
  return (
    <NotificationContext.Provider value={value}>
      {items.length > 0 && (
        <div className="global-flash">
          <Flashbar items={items} />
        </div>
      )}
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const value = useContext(NotificationContext);
  if (!value)
    throw new Error(
      "useNotifications must be used within NotificationProvider",
    );
  return value;
}
