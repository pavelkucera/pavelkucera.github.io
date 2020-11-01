---
title: Caching Executing Promises
layout: post
tags: [blog, javascript, typescript, async, promise, lock, node, nodejs]
---

# {{ page.title }}

In this post I will show you how to cache executing promises.
Caching of executing promises, rather than just caching the result of a promise, is useful when the promise is expensive, takes a while to finish and is invoked often.
The caching will be achieved by using locks, and the locks will be implemented using promises, and relying on properties of JavaScript's event loop.

## The Problem
Assume we have a function `expensiveOperation` which performs a myriad of async actions and takes at least a minute to return.
Then we have a function `cacheExpensiveOperation` which calls `expensiveOperation`, caches its result and returns the cached result on its subsequent calls. As in the following code snippet:

<label for="mn-definition-improvements" class="margin-toggle">&#8853;</label>
<input type="checkbox" id="mn-definition-improvements" class="margin-toggle"/>
<span class="marginnote">
  Implementation note.
  Using null to figure out if the expensive operation ran is dangerous if the result of the cached operation can be null.
  It would be safer to e.g. create a Symbol representing a value of the (local) bottom type.
  I am not using this approach to simplify the example. 
</span>
```typescript
const expensiveOperation = async (): Promise<number> => {
  // ...
}

let expensiveOperationResult = null
const cacheExpensiveOperation = async () => {
  if (expensiveOperationResult !== null) {
    return expensiveOperationResult
  }

  expensiveOperationResult = await expensiveOperation() 
  return expensiveOperationResult
}
```

Although `cacheExpensiveOperation` caches the result of `expensiveOperation`, the cache mechanism won't be employed till after `cacheExpensiveOperation` returns for the first time.
So if we trigger `cacheExpensiveOperation` multiple times at once and do not wait for the result, we trigger `expensiveOperation` multiple times as well. As in the following snippet:

<label for="mn-definitionImprovements" class="margin-toggle">&#8853;</label>
<input type="checkbox" id="mn-definitionImprovements" class="margin-toggle"/>
<span class="marginnote">
  In the _real world_, this would happen if the cache operation is e.g. triggered on a webpage with tons of traffic.
  First _X_ visitors, who enter the webpage when the cache is empty, trigger the expensive operation _X_ times.
</span>
```typescript
// calls expensiveOperation twice
const [value1, value2] = await Promise.all([
  cacheExpensiveOperation(),
  cacheExpensiveOperation(),
])
```

The cache would only get employed if we call `cacheExpensiveOperation` multiple times as in here:
```typescript
// calls expensiveOperation only once
const value1 = await cacheExpensiveOperation();
const value2 = await cacheExpensiveOperation();
```

This is the problem we want to address.
We want `cacheExpensiveOperation` to call `expensiveOperation` at most once, even when there are multiple concurrent calls to the function. Which is where we arrive to locks.

## Using Locks

[Locks](https://en.wikipedia.org/wiki/Lock_(computer_science)) are a fairly standard way of enforcing certain limits on accessing a shared resource (the `expensiveOperation`).
To cut down on the length of this article, I am going to assume that you are familiar with locks and their uses.
Hence, I can now show you how to implement a lock using promises, and properties of the JavaScript event loop.

### High-level Solution
Conceptually, we want to change execution `cacheExpensiveOperation` from:
1. Return a cached result if it exists
1. Otherwise, run `expensiveOperation` and save its result
 
To:
1. Return a cached result if it exists
1. If there is a lock, asynchronously wait till it is unlocked/removed.
1. Otherwise, create a lock, run `expensiveOperation`, save its result and remove the lock.

However, with JavaScript & promises, we can be less explicit.
As JavaScript is single-threaded in its synchronous code, we can achieve behaviour similar to locks just using promises.

### Implementing a Promise-based Lock
As suggested in the previous section, if we can store a call to `expensiveOperation` in a promise, concurrent calls to `cacheExpensiveOperation` can use the same promise to return the value.
And storing a call `expensiveOperation` just means assigning a promise to a variable without waiting for the result.
Lo and behold:

```typescript
let expensiveOperationPromise = null
let expensiveOperationResult = null

const cacheExpensiveOperation = async () => {
  if (expensiveOperationResult !== null) {
    return expensiveOperationResult
  }

  if (expensiveOperationPromise !== null) {
    return await expensiveOperationPromise
  }

  expensiveOperationPromise = expensiveOperation() // no await here
  expensiveOperationResult = await expensiveOperationPromise
  expensiveOperationPromise = null
  return expensiveOperationResult 
}
```

Let's go through how this works.
The caching mechanism used for the result of `expensiveOperation` has not changed---if we have cached a result, we return it without any waiting.

The caching mechanism for the promise itself relies on how the event loop works:
<label for="mn-terminology" class="margin-toggle">&#8853;</label>
<input type="checkbox" id="mn-terminology" class="margin-toggle"/>
<span class="marginnote">
  I am likely not using the best terminology here.
  Please do let me know how to fix it.
  I also do some very hand-wavy explanations, which are trying to shorten the explanation.
</span>
1. Since JavaScript is single-threaded in its synchronous code, there cannot be multiple "first calls" to a function. Thus, there will always be a single first call to `cacheExpensiveOperation` that will block till its first asynchronous operation (simplified: till its first `await`).

1. The first call to `cacheExpensiveOperation()` creates a promise which:
   1. Calls `expensiveOperation`.
   1. Stores the promise in `expensiveOperationPromise` variable.
   1. Is "suspended" till the `expensiveOperationPromise` resolves to a value, as it calls `await` on that promise.
   
1. If, in the meantime, we trigger `cacheExpensiveOperation` again, `expensiveOperationPromise` contains a value and thus the call will `await` on the existing promise and won't resolve till the underlying promise resolves (or rejects).

1. The first (and only) call to `expensiveOperation` resolves:
   1. All promises waiting for this promise to resolve can now continue execution, using the result.
   1. The first call to `cacheExpensiveOperation` stores this result in `expensiveOperationResult`.
   
1. Any consequent calls to `cacheExpensiveOperation` use `expensiveOperationResult` to return the cached value.

Hopefully that makes sense.
But even if it doesn't, we can [test this behaviour](https://gist.github.com/pavelkucera/453acf622dc3cad29455ef93ccf49c23).

### Tradeoffs
Although I find this solution working and rather elegant, as with every piece of code, there are some tradeoffs:

1. Returning _the same_ promise from different calls to `cacheExpensiveOperation` means that the result of the promise will be referenced from multiple places.
   This can lead to hard-to-spot bugs since we now introduce shared state.

1. Understanding this approach requires a fair amount of knowledge about JavaScript's event loop.
   As such, it might be hard to understand, and it should be heavily commented.
   You probably also want to abstract this away into some `lock` or `cachePromise`.
