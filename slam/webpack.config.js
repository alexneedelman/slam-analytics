const webpack = require('webpack');

module.exports = {
  resolve: {
    fallback: {
      fs: false,
      child_process: false
    }
  },
  plugins: [
    new webpack.IgnorePlugin({ resourceRegExp: /^fs$/, contextRegExp: /javascript-lp-solver/ }),
    new webpack.IgnorePlugin({ resourceRegExp: /^child_process$/, contextRegExp: /javascript-lp-solver/ })
  ]
};
