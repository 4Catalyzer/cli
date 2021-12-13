import { execa } from 'execa';
import rxjs from 'rxjs';
import { filter } from 'rxjs/operators';

const { merge, Observable } = rxjs;

function fromAsyncIterator(iterable) {
  return new Observable((subscriber) => {
    const iterator = iterable[Symbol.asyncIterator]();

    async function readIterable() {
      for await (const value of iterator) {
        subscriber.next(value);
        if (subscriber.closed) {
          break;
        }
      }

      subscriber.complete();
    }

    readIterable().catch(subscriber.error);

    // Finalize the iterator if it happens to be a Generator
    if (typeof iterator.return === 'function') {
      subscriber.add(() => {
        if (iterator.return) {
          iterator.return();
        }
      });
    }

    return subscriber;
  });
}

const split = (separator) => (stream) =>
  new Observable((observer) => {
    let line = '';

    return stream.subscribe((x) => {
      const parts = x.split(separator);
      if (parts.length === 1) {
        line += parts[0];
        return;
      }

      observer.next(line + String(parts.shift()));
      line = parts.pop();
      parts.forEach(observer.next);
    });
  });

const exec = (cmd, args) => {
  const cp = execa(cmd, args, { env: { FORCE_COLOR: true } });

  return merge(
    fromAsyncIterator(cp.stdout),
    fromAsyncIterator(cp.stderr),
    cp, // include the promise, so that the stream errors when it fails
  ).pipe(filter(Boolean));
};

export { fromAsyncIterator, split, exec };
