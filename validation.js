function isNumber(x) {
  return typeof x === 'number' && !Number.isNaN(x);
}
module.exports = { isNumber };
