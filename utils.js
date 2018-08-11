module.exports.promiseLimit = function(collection = [], limit, operator) {
  return collection
    .reduce((acc, e, i) => {
      if (i % limit === 0) {
        acc.push([e]);
      } else {
        acc[i / limit | 0].push(e);
      }

      return acc;
    }, [])
    .reduce((acc, chunk) => acc.then(() => Promise.all(chunk.map((e) => operator(e)))) , Promise.resolve());
}
