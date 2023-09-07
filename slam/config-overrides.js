module.exports = function override(config, env) {
    // To nullify built-in Node.js modules that are not required for frontend
    config.resolve.fallback = {
      fs: false,
      child_process: false,
    };
    return config;
  };
  