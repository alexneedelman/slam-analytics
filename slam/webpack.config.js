const webpack = require('webpack');

module.exports = {
  // Your other webpack configuration options...
  plugins: [
    new webpack.IgnorePlugin(/fs/),
    new webpack.IgnorePlugin(/child_process/),
  ],
};
