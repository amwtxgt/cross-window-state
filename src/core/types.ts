/** Options accepted by `createRuntimeState` on both main and renderer. */
export interface RuntimeStateOptions {
  /**
   * Reject `.set()` and proxy writes with a console error. Useful for shared
   * read-only views of a state owned elsewhere.
   */
  readonly?: boolean
}

/** Options accepted by `createStorageState` on both main and renderer. */
export interface StorageStateOptions {
  /**
   * Reuse an existing store even when the passed `defaults` differ from the
   * ones it was created with. Without this, a mismatch throws.
   */
  skipDefaultsCheck?: boolean
  /** Write retries after a failed save. Default 3. */
  maxRetries?: number
  /** Delay between write retries in ms. Default 1000. */
  retryDelay?: number
  /**
   * Subdirectory under Electron's `userData` for state files.
   * Default `cross-window-state`.
   */
  dir?: string
}
