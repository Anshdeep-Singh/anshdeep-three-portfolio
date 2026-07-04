/**
 * Centralized Pub/Sub for cross-layer communication.
 * Follows the [DOMAIN]:[ACTION] naming convention.
 */
export type EventCallback<T = any> = (payload: T) => void;

export class EventBus {
  private listeners: Map<string, Set<EventCallback>> = new Map();

  /**
   * Subscribe to an event.
   * @param event - The event name (e.g., 'UI:OPEN_MODAL')
   * @param callback - Function to execute when event is emitted
   * @returns A function to unsubscribe
   */
  public on<T = any>(event: string, callback: EventCallback<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    // Return an unsubscribe function for easy cleanup
    return () => this.off(event, callback);
  }

  /**
   * Unsubscribe from an event.
   * @param event - The event name
   * @param callback - The callback to remove
   */
  public off<T = any>(event: string, callback: EventCallback<T>): void {
    this.listeners.get(event)?.delete(callback);
  }

  /**
   * Emit an event to all subscribers.
   * @param event - The event name
   * @param payload - The data to pass to subscribers
   */
  public emit<T = any>(event: string, payload?: T): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach((callback) => callback(payload));
    }
  }

  /**
   * Clear all event listeners.
   */
  public clear(): void {
    this.listeners.clear();
  }
}