import { useEffect, useRef } from 'react';

export type EventTone = 'info' | 'warn' | 'block' | 'host';

export interface DemoEvent {
    id: number;
    time: string;
    label: string;
    detail: string;
    tone: EventTone;
}

const TONE_COLOR: Record<EventTone, string> = {
    info: 'var(--ts-cyan)',
    warn: 'var(--ts-amber)',
    block: 'var(--ts-pink)',
    host: 'var(--ts-violet)',
};

/**
 * Rolling log of embed events and host triggers. Kept deliberately raw — the
 * point of the demo is to show which SDK events fire and when, so the labels
 * are the literal enum names rather than friendly prose.
 */
export const EventStream = ({ events }: { events: DemoEvent[] }) => {
    const endRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        endRef.current?.scrollIntoView({ block: 'nearest' });
    }, [events.length]);

    return (
        <div className="events">
            {events.length === 0 && (
                <span className="events__empty">
                    // listening for Spotter quota events…
                </span>
            )}
            {events.map((event) => (
                <div className="event" key={event.id}>
                    <span
                        className="event__dot"
                        style={{ background: TONE_COLOR[event.tone] }}
                    />
                    <span className="event__time">{event.time}</span>
                    <span style={{ color: TONE_COLOR[event.tone] }}>{event.label}</span>
                    <span className="event__detail">{event.detail}</span>
                </div>
            ))}
            <div ref={endRef} />
        </div>
    );
};
