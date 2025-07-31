const randomString = (length) =>
  Array(length)
    .fill("")
    .map(
      () =>
        "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"[
          Math.floor(Math.random() * 62)
        ]
    )
    .join("");

module.exports = randomString;
