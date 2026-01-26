// Type declaration for ES2024 Promise.withResolvers
// Required for pdfjs-dist v4.x compatibility

export {};

declare global {
  interface PromiseConstructor {
    withResolvers<T>(): {
      promise: Promise<T>;
      resolve: (value: T | PromiseLike<T>) => void;
      reject: (reason?: unknown) => void;
    };
  }
}
