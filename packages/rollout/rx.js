const { merge, Observable } = require('rxjs');
const { filter } = require('rxjs/operators');
const execa = require('execa');

function fromAsyncIterator(iterable) {
  return new Observable(subscriber => {
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

const split = seperator => stream =>
  new Observable(observer => {
    let line;

    return stream.subscribe(x => {
      const parts = x.split(seperator);
      observer.next(line + parts.shift());
      line = parts.pop();
      parts.forEach(observer.next);
    });
  });

const exec = (cmd, args) => {
  // Use `Observable` support if merged https://github.com/sindresorhus/execa/pull/26
  const cp = execa(cmd, args);

  return merge(
    fromAsyncIterator(cp.stdout),
    fromAsyncIterator(cp.stderr),
  ).pipe(filter(Boolean));
};

module.exports = {
  fromAsyncIterator,
  split,
  exec,
};
