import { EventBus } from './EventBus';

/**
 * Represents an action used to trigger state changes.
 */
export type Action = {
  type: string;
  payload?: any;
};

/**
 * A function that takes the current state and an action, and returns the next state.
 */
export type Reducer<TState> = (state: TState, action: Action) => TState;

/**
 * A function that is called when the state changes.
 */
export type StateListener<TState = any> = (state: TState) => void;

/**
 * A unidirectional, reactive data store.
 * Follows the principle: State is read-only, and changes are performed via dispatched actions.
 */
export class StateStore<TState> {
  private state: TState;
  private reducer: Reducer<TState>;
  private eventBus: EventBus;
  private readonly STATE_CHANGE_EVENT = 'CORE:STATE_CHANGED';

  /**
   * Creates a new StateStore.
   * @param reducer - Function that defines how state changes in response to actions.
   * @param initialState - The initial state of the application.
   * @param eventBus - The central event bus for notifying subscribers of state changes.
   */
  constructor(reducer: Reducer<TState>, initialState: TState, eventBus: EventBus) {
    this.reducer = reducer;
    this.state = initialState;
    this.eventBus = eventBus;
  }

  /**
   * Returns the current state.
   */
  public getState(): TState {
    return this.state;
  }

  /**
   * Dispatches an action to trigger a state transition.
   * @param action - The action to be processed by the reducer.
   */
  public dispatch(action: Action): void {
    this.state = this.reducer(this.state, action);
    this.eventBus.emit(this.STATE_CHANGE_EVENT, this.state);
  }

  /**
   * Returns a subscription function to listen for state changes.
   * @param listener - Callback function called with the new state.
   * @returns An unsubscribe function.
   */
  public subscribe(listener: StateListener<TState>): () => void {
    // Use the event bus to allow any part of the app to listen to state changes
    // through the standardized event name.
    const unsubscribe = this.eventBus.on(this.STATE_CHANGE_EVENT, listener);
    return unsubscribe;
  }
}