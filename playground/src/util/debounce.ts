import { WatchSource } from 'vue';

const animationFrameHandlers: Set<() => void> = new Set();

requestAnimationFrame(function animationFrameLoop() {
  animationFrameHandlers.forEach((handler) => handler());
  requestAnimationFrame(animationFrameLoop);
});

export function watchAsyncViaAnimationFrame<T>(source: WatchSource, cb: (newValue: T, oldValue: T | undefined) => void, options?: { immediate?: boolean }) {
  let oldValue: T | undefined;
  const handle = () => {
    const newValue = source instanceof Function ? source() : source.value;
    const prevOldValue = oldValue;
    if (newValue !== oldValue) {
      oldValue = newValue;
      cb(newValue, prevOldValue);
    }
  };
  animationFrameHandlers.add(handle);

  const stop = () => {
    animationFrameHandlers.delete(handle);
  };

  if (options?.immediate) {
    handle();
  }

  return stop;
}
