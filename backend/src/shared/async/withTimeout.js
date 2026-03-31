/**
 * @template T
 * @param {Promise<T>} promise
 * @param {number} timeoutMs
 * @param {string} [message]
 * @returns {Promise<T>}
 */
export function withTimeout(promise, timeoutMs, message = "operation_timeout") {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), timeoutMs)
    })
  ])
}
